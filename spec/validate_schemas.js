#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const SCHEMAS_DIR = path.join(__dirname, "schemas");
const requiredByAction = {
  object_create: ["v", "action", "object_id", "object_type", "creator", "transaction_id"],
  create_committee: ["v", "action", "network", "app", "committee_id", "threshold", "members"],
  update_create: ["v", "action", "update_id", "object_id", "update_type", "creator", "transaction_id"],
  update_vote: ["v", "action", "update_id", "voter", "vote", "transaction_id"],
  rank_vote: ["v", "action", "update_id", "voter", "rank", "transaction_id"],
};

let failed = 0;

function checkSchema(name) {
  const file = path.join(SCHEMAS_DIR, name + ".json");
  if (!fs.existsSync(file)) {
    console.error("Missing schema:", file);
    failed++;
    return;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    console.error("Invalid JSON:", file, e.message);
    failed++;
    return;
  }
  const required = data.required || [];
  const action = data.properties && data.properties.action && data.properties.action.const;
  const expected = requiredByAction[action];
  if (expected) {
    for (const r of expected) {
      if (!required.includes(r)) {
        console.error(file, "missing required:", r);
        failed++;
      }
    }
  }
  if (data.required && !Array.isArray(data.required)) {
    console.error(file, "required must be array");
    failed++;
  }
}

["object_create", "object_type_create", "object_type_update", "create_committee", "update_create", "update_vote", "rank_vote"].forEach(checkSchema);

if (failed) {
  process.exit(1);
}
console.log("Schema checks OK");
