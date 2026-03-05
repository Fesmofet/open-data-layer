/**
 * Deterministic seed for 1M+ places into MongoDB and PostgreSQL.
 * Usage: MONGO_URI=... DATABASE_URL=... SEED_COUNT=1000000 SEED_SEED=42 node run.js
 */
import { MongoClient } from 'mongodb';
import pg from 'pg';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/odl-query';
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/odl_query';
const SEED_COUNT = parseInt(process.env.SEED_COUNT || '1000000', 10);
const SEED_SEED = parseInt(process.env.SEED_SEED || '42', 10);
const BATCH = parseInt(process.env.SEED_BATCH || '10000', 10);

const TAGS = ['restaurant', 'cafe', 'park', 'museum', 'shop', 'hotel', 'beach', 'hike', 'city', 'nature'];

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function* generatePlaces(count, rng) {
  for (let i = 0; i < count; i++) {
    const lng = -180 + rng() * 360;
    const lat = -90 + rng() * 180;
    const numTags = Math.floor(rng() * 5) + 1;
    const tags = [];
    const used = new Set();
    while (tags.length < numTags) {
      const t = TAGS[Math.floor(rng() * TAGS.length)];
      if (!used.has(t)) {
        used.add(t);
        tags.push(t);
      }
    }
    const name = `Place ${i}`;
    const body = `Description for place ${i} with tags ${tags.join(' ')}.`;
    const updateBodyExact = JSON.stringify({ name, body, tags });
    let rejectedBy = null;
    if (i % 10 === 0) rejectedBy = `user-${i % 1000}`;
    else if (i % 20 === 1) rejectedBy = `admin-${(i % 5) + 1}`;
    yield {
      objectId: `place-${i}`,
      objectType: 'place',
      creator: `user-${i % 1000}`,
      name,
      body,
      updateBodyExact,
      rejectedBy,
      lng,
      lat,
      tags,
    };
  }
}

async function seedMongo(client, count, rng) {
  const db = client.db();
  const placesRead = db.collection('places_read');
  const placeObjects = db.collection('place_objects');
  const placeUpdates = db.collection('place_updates');

  // Make seeding idempotent for repeated benchmark runs.
  await placesRead.deleteMany({});
  await placeObjects.deleteMany({});
  await placeUpdates.deleteMany({});

  await placesRead.createIndex({ objectId: 1 }, { unique: true });
  await placesRead.createIndex({ map: '2dsphere' });
  await placesRead.createIndex({ tags: 1 });
  await placesRead.createIndex({ updateBodyExact: 1 }, { sparse: true });
  await placesRead.createIndex({ name: 'text', body: 'text' });
  await placeObjects.createIndex({ objectId: 1 }, { unique: true });
  await placeUpdates.createIndex({ objectId: 1, updateType: 1 });
  // Self-heal legacy index from older seed versions (global 2dsphere on value).
  try {
    await placeUpdates.dropIndex('value_2dsphere');
  } catch {
    // ignore if index does not exist
  }
  await placeUpdates.createIndex(
    { value: '2dsphere' },
    { partialFilterExpression: { updateType: 'map' } }
  );
  await placeUpdates.createIndex({ updateBodyExact: 1 }, { sparse: true });
  await placeUpdates.createIndex({ value: 'text', body: 'text' });

  let inserted = 0;
  let batchRead = [];
  let batchObjects = [];
  let batchUpdates = [];

  for (const p of generatePlaces(count, rng)) {
    batchRead.push({
      objectId: p.objectId,
      objectType: p.objectType,
      creator: p.creator,
      name: p.name,
      map: { type: 'Point', coordinates: [p.lng, p.lat] },
      tags: p.tags,
      body: p.body,
      updateBodyExact: p.updateBodyExact,
      rejectedBy: p.rejectedBy,
    });
    batchObjects.push({ objectId: p.objectId, objectType: p.objectType, creator: p.creator });
    batchUpdates.push(
      { objectId: p.objectId, updateType: 'name', value: p.name, body: p.body, updateBodyExact: p.updateBodyExact, rejectedBy: p.rejectedBy },
      { objectId: p.objectId, updateType: 'map', value: { type: 'Point', coordinates: [p.lng, p.lat] } },
      { objectId: p.objectId, updateType: 'tags', value: p.tags }
    );
    if (batchRead.length >= BATCH) {
      await placesRead.insertMany(batchRead);
      await placeObjects.insertMany(batchObjects);
      await placeUpdates.insertMany(batchUpdates);
      inserted += batchRead.length;
      console.log(`Mongo: ${inserted}/${count}`);
      batchRead = [];
      batchObjects = [];
      batchUpdates = [];
    }
  }
  if (batchRead.length) {
    await placesRead.insertMany(batchRead);
    await placeObjects.insertMany(batchObjects);
    await placeUpdates.insertMany(batchUpdates);
    inserted += batchRead.length;
  }
  console.log(`Mongo done: ${inserted} places`);
}

async function seedPostgres(pool, count, rng) {
  const client = await pool.connect();
  try {
    // Make seeding idempotent for repeated benchmark runs.
    await client.query('TRUNCATE TABLE place_updates, place_objects, places_read RESTART IDENTITY');

    let inserted = 0;
    let batchRead = [];
    let batchObjects = [];
    let batchUpdates = [];

    const flush = async () => {
      if (batchRead.length === 0) return;
      const batch = batchRead;
      await client.query(
        `INSERT INTO places_read (object_id, object_type, creator, name, map, tags, body, update_body_exact, rejected_by)
         SELECT o, ot, c, n, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, string_to_array(tg, ','), b, ube, rb
         FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::float8[], $6::float8[], $7::text[], $8::text[], $9::text[], $10::text[]) AS t(o,ot,c,n,lng,lat,tg,b,ube,rb)
         ON CONFLICT (object_id) DO NOTHING`,
        [
          batch.map((r) => r.objectId),
          batch.map((r) => r.objectType),
          batch.map((r) => r.creator),
          batch.map((r) => r.name),
          batch.map((r) => r.lng),
          batch.map((r) => r.lat),
          batch.map((r) => r.tags.join(',')),
          batch.map((r) => r.body ?? null),
          batch.map((r) => r.updateBodyExact ?? null),
          batch.map((r) => r.rejectedBy ?? null),
        ]
      );
      await client.query(
        `INSERT INTO place_objects (object_id, object_type, creator)
         SELECT * FROM unnest($1::text[], $2::text[], $3::text[]) AS t(o,ot,c)
         ON CONFLICT (object_id) DO NOTHING`,
        [batchObjects.map((r) => r.objectId), batchObjects.map((r) => r.objectType), batchObjects.map((r) => r.creator)]
      );
      const names = batchUpdates.filter((u) => u.valueText != null);
      const maps = batchUpdates.filter((u) => u.lng != null);
      const tagRows = batchUpdates.filter((u) => u.valueTags != null);
      if (names.length) {
        await client.query(
          `INSERT INTO place_updates (object_id, update_type, value_text, body, update_body_exact, rejected_by) SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[]) AS t(o,u,v,b,ube,rb)`,
          [
            names.map((u) => u.objectId),
            names.map((u) => u.updateType),
            names.map((u) => u.valueText),
            names.map((u) => u.body ?? null),
            names.map((u) => u.updateBodyExact ?? null),
            names.map((u) => u.rejectedBy ?? null),
          ]
        );
      }
      if (maps.length) {
        await client.query(
          `INSERT INTO place_updates (object_id, update_type, value_geo) SELECT o, u, ST_SetSRID(ST_MakePoint(a, b), 4326)::geography FROM unnest($1::text[], $2::text[], $3::float8[], $4::float8[]) AS t(o,u,a,b)`,
          [maps.map((u) => u.objectId), maps.map((u) => u.updateType), maps.map((u) => u.lng), maps.map((u) => u.lat)]
        );
      }
      if (tagRows.length) {
        await client.query(
          `INSERT INTO place_updates (object_id, update_type, value_tags)
           SELECT o, u, string_to_array(v, ',')
           FROM unnest($1::text[], $2::text[], $3::text[]) AS t(o,u,v)`,
          [tagRows.map((u) => u.objectId), tagRows.map((u) => u.updateType), tagRows.map((u) => u.valueTags.join(','))]
        );
      }
      inserted += batch.length;
      console.log(`Postgres: ${inserted}/${count}`);
      batchRead = [];
      batchObjects = [];
      batchUpdates = [];
    };

    for (const p of generatePlaces(count, rng)) {
      batchRead.push({
        objectId: p.objectId,
        objectType: p.objectType,
        creator: p.creator,
        name: p.name,
        body: p.body,
        updateBodyExact: p.updateBodyExact,
        rejectedBy: p.rejectedBy,
        lng: p.lng,
        lat: p.lat,
        tags: p.tags,
      });
      batchObjects.push({ objectId: p.objectId, objectType: p.objectType, creator: p.creator });
      batchUpdates.push(
        { objectId: p.objectId, updateType: 'name', valueText: p.name, body: p.body, updateBodyExact: p.updateBodyExact, rejectedBy: p.rejectedBy },
        { objectId: p.objectId, updateType: 'map', lng: p.lng, lat: p.lat },
        { objectId: p.objectId, updateType: 'tags', valueTags: p.tags }
      );
      if (batchRead.length >= BATCH) await flush();
    }
    await flush();
    console.log(`Postgres done: ${inserted} places`);
  } finally {
    client.release();
  }
}

async function main() {
  const rng = mulberry32(SEED_SEED);
  console.log(`Seeding ${SEED_COUNT} places (seed=${SEED_SEED}, batch=${BATCH})...`);

  const mongoClient = new MongoClient(MONGO_URI);
  await mongoClient.connect();
  const pool = new pg.Pool({ connectionString: DATABASE_URL });

  try {
    await seedMongo(mongoClient, SEED_COUNT, rng);
    const rng2 = mulberry32(SEED_SEED);
    await seedPostgres(pool, SEED_COUNT, rng2);
  } finally {
    await mongoClient.close();
    await pool.end();
  }
  console.log('Seed complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
