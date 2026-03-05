# agents.md

This document defines the rules an agent must follow when working in this monorepo (NestJS, MongoDB, Redis, Hive parsing). All changes must be production-ready.

## 1. General principles

- Prefer simplicity over cleverness.
- Avoid premature abstraction.
- Keep modules loosely coupled.
- Prefer explicit over implicit behavior.

## 2. Architecture

### 2.1 Layering

- Repository pattern is mandatory (base: `MongoRepository<TDocument>` in `@waivio-core-services/clients`).
- App-specific repositories:
  - Location: `apps/<app>/src/repositories/`
  - Must extend the base repository where appropriate.
- Domain logic (parsers, handlers):
  - Location: `apps/<app>/src/domain/`
- Configuration:
  - Location: `apps/<app>/src/config/`
- Constants:
  - Location: `apps/<app>/src/constants/`
- Controllers must not contain business logic.
- Repositories must not contain business logic (data access only).

### 2.2 Module boundaries

- Apps (`apps/*`) must not depend on other apps.
- Shared logic must live in `libs/`.
- Libs must not import from apps.
- Avoid circular dependencies.
- Each lib must have a clear responsibility:
  - `@odl/clients` - database, cache, and blockchain clients (Mongo, Redis, Hive)
  - `@odl/common` - shared utilities
  - `@odl/processors` - blockchain processing logic
  - `@odl/domain-constants` - domain constants (object types, field names, supposed updates)

### 2.3 App structure

Inside `apps/<app>/src/`:

- `config/` - env validation (Zod), config factories
- `constants/` - app-specific constants
- `domain/` - business logic, parsers, handlers, schemas
- `repositories/` - app-specific repository implementations

## 3. Repository vs Service layer

### 3.1 Repository rules (data access only)

Repository code:

- Builds MongoDB queries and aggregation pipelines:
  - `$match`, `$lookup`, `$set`, `$push`, filters, projections, lookups, etc.
- Knows collection names, document structure, indexes.
- Returns typed data and hides Mongoose/MongoDB internals.
- Contains no business decisions and no orchestration.

### 3.2 Service rules (business logic only)

Service/domain code:

- Contains formulas, calculations, decisions, orchestration.
- Calls repository methods and never builds pipelines or raw Mongo filters.
- Coordinates multiple repositories when needed.

### 3.3 Red flags (must fix)

Move to repository:

- Service contains `$match`, `$lookup`, `$set`, `$push`.
- Service references collection names (example: `'waiv-stakes'`).

Move to service/domain:

- Repository contains `if/else` business decisions.
- Repository calls other repositories (orchestration belongs in service/domain).

## 4. Monorepo structure

- Nx monorepo (configured in `nx.json`).
- `apps/` - runnable NestJS applications (example: hive-parser, api-service, objects-bot)
- `libs/` - reusable NestJS libraries (clients, common, processors)

Rules:

- Apps can import from libs only via `@odl/*`.
- Libs can import from other libs only via barrel exports (`index.ts`).
- Never import deep internal files from another lib.
- Each project has a `project.json` defining targets (build, serve, test, lint).

Correct:

- `import { MongoRepository, MongoClientFactory } from '@odl/clients';`
- `import { JsonHelper } from '@odl/common';`
- `import { HiveProcessorModule } from '@waivio-core-services/processors';`

Wrong:

- `import { MongoRepository } from '@odl/clients/mongo-client/mongo.repository';`

Indexing rules:

- Every lib must have a barrel `index.ts` at `libs/<lib>/src/index.ts`.
- Every sub-module within a lib should have its own `index.ts`.

## 5. Package management

### 5.1 Root-level dependencies

- Single root `package.json` (Nx monorepo) for development.
- Use `npm install` / `npm update` at workspace root.
- Never manually write versions into `package.json`.
- Shared dependencies managed at root level.
- Keep dependency graph minimal.

**Key runtime dependencies (shared at root):**

- `@nestjs/*`, `mongoose`, `ioredis`, `@hiveio/dhive`, `zod`, `rxjs`, `ws`, `lodash`

### 5.2 Project-level dependencies

Each project (app/lib) can generate its own `package.json`:

- **Libraries**:
  - Libraries with workspace dependencies (e.g., `clients` depends on `common`) are bundled by apps during app builds
  - Standalone libraries without dependencies (e.g., `common`) can have build targets with `generatePackageJson: true`
  - Libraries are not built separately - they're included in app builds via webpack bundling
  - Generated `package.json` for apps includes all workspace library dependencies
- **Applications**:
  - Webpack generates `package.json` automatically during build
  - Generated files appear in `dist/apps/<app-name>/`
  - Use `prune-lockfile` target to generate minimal dependencies for deployment
  - App builds automatically include and bundle dependent libraries

**Project dependency graph (declared in `project.json`):**

- `hive-parser` → depends on: `clients`, `common`, `processors`
- `processors` → depends on: `clients`, `common`
- `clients` → depends on: `common`
- `common` → no internal dependencies

**Implicit dependencies:**

- Declared via `implicitDependencies` in each project's `project.json`
- Helps Nx understand the project graph for:
  - Build ordering (`dependsOn: ["^build"]`)
  - Affected calculations
  - Caching strategies
- Nx automatically builds dependencies before dependents

### 5.3 Dependency pruning for deployment

**For applications:**

- **Automatic**: Webpack generates `package.json` automatically during `nx build <app>`
  - Only includes packages that are actually imported/used in the code
  - Unused packages from root `package.json` are automatically excluded
  - Generated file: `dist/apps/<app>/package.json`
- **Lockfile** (optional): Use `nx run <app>:generate-lockfile` for reproducible Docker builds
  - Generates `package-lock.json` from the webpack-generated `package.json`
  - Ensures consistent dependency versions in Docker
  - Generated file: `dist/apps/<app>/package-lock.json`

**For libraries:**

- Build generates `package.json` with only required dependencies
- Use for publishing or bundling libraries separately

**Commands:**

- `nx build <app>` - Builds app and auto-generates `package.json` (includes only used packages)
- `nx run <app>:generate-lockfile` - Generates `package-lock.json` for reproducible Docker builds (optional)
- `nx run <app>:prune` - Runs both `generate-lockfile` and `copy-workspace-modules`

**Docker workflow:**

1. **Build**: `nx build <app>`
   - ✅ Automatically generates `dist/apps/<app>/package.json`
   - ✅ Only includes packages that are actually imported/used
   - ✅ Unused packages are automatically excluded
   - ✅ No manual `package.json` creation needed!

2. **Lockfile** (optional): `nx run <app>:generate-lockfile`
   - Generates `package-lock.json` from the webpack-generated `package.json`
   - Ensures consistent dependency versions in Docker
   - Recommended for production Docker builds

3. **Docker**: Copy `dist/apps/<app>/` directory and run `npm ci --only=production`

**Example:**

```bash
# Build (generates package.json automatically)
nx build hive-parser

# Optional: Generate lockfile for Docker
nx run hive-parser:generate-lockfile

# Docker: dist/apps/hive-parser/ contains everything needed
cd dist/apps/hive-parser
npm ci --only=production
node main.js
```

**Docker build:**

```bash
# Build Docker image
docker build -f apps/<app>/Dockerfile -t <app>:latest .

# Run container
docker run <app>:latest
```

See `apps/<app>/Dockerfile` for the actual Dockerfile (Node.js 24.12.0-alpine3.23).

### 5.4 Dependency management rules

**Development:**

- Use root `node_modules` for all development work
- Install new dependencies at root: `npm install <package>`
- Nx resolves dependencies from root during development

**Production/Deployment:**

- Use generated `package.json` files from `dist/` directories
- Run `npm install --production` in `dist/apps/<app>/` for deployment
- Each app/lib can be deployed independently with minimal dependencies

**Adding new dependencies:**

1. Install at root: `npm install <package>`
2. If app-specific, document in project README or comments
3. Build will automatically include in generated `package.json` if used
4. For deployment, use `prune-lockfile` to generate minimal set

**Version conflicts:**

- Monitor for version mismatches between root and project-level
- Prefer resolving at root level when possible
- Use project-level only when necessary for deployment isolation

## 6. Type safety and validation

- TypeScript strict null checks enabled (`strictNullChecks: true`).
- `noImplicitAny` is currently false:
  - Prefer explicit types for new code.
  - Avoid widening `any` usage.
- `@typescript-eslint/no-explicit-any` is off:
  - Use `any` only when truly necessary (example: Mongoose internals).
  - Prefer `unknown` for new code.

Use Zod for runtime validation of:

- Environment variables (see `apps/<app>/src/config/env.validation.ts`).
- Blockchain payloads (custom JSON operations).
- HTTP request bodies.

Never trust external input:

- Blockchain data, API requests, env vars.

Validate environment at startup:

- Use `ConfigModule.forRoot({ validate })` pattern.

## 7. Configuration

- No hardcoded secrets.
- All configuration via environment variables.
- Each app must have:
  - `config/env.validation.ts` - Zod schema + validate function
  - `config/<app>.config.ts` - config factory (default export function)
- Use `@nestjs/config` with:
  - `ConfigModule.forRoot({ isGlobal: true, validate, load })`
- Fail fast on invalid configuration (Zod throws on parse failure).
- `.env` files are gitignored.

## 8. Logging and observability

- Use NestJS `Logger` from `@nestjs/common`.
- Create logger per class: `new Logger(ClassName.name)`.
- No `console.log` in production code.
- Do not log secrets or connection strings.
- Log errors with context (at minimum): `this.logger.error(error.message)`.

## 9. Error handling

- Repository base class catches and logs errors and returns `null` / empty arrays (established pattern).
- Domain/service layer must check for `null` returns from repositories and handle appropriately.
- Use typed error classes for domain errors when needed.
- Map domain errors to HTTP responses in controllers.
- Do not expose stack traces to clients.
- Fail fast for unrecoverable errors (invalid config, missing connections).

## 10. Testing

- Jest with `ts-jest`.
- Unit tests: `*.spec.ts` (co-located with source).
- E2E tests: `*.e2e-spec.ts` (in `apps/<app>/test/`).
- Domain/business logic must be unit-testable without NestJS container.
- Mock infrastructure (repositories, clients).
- Test behavior, not implementation.

Commands:

- `nx test <project>` - run tests for a project
- `nx test <project> --watch` - watch mode
- `nx test <project> --coverage` - with coverage

## 11. Performance

- Blockchain processing is the hot path:
  - Avoid blocking operations in parsers.
- MongoDB pool is pre-configured (example: `maxPoolSize 20`, `minPoolSize 2`).
- Redis URL rotation is handled by `UrlRotationService` in `@waivio-core-services/clients`.
- Be mindful of memory when processing blocks sequentially.
- Avoid unnecessary allocations in block/transaction loops.

## 12. Security

- Validate and sanitize all input (blockchain JSON, API requests).
- Protect against injection in MongoDB queries.
- Avoid mass assignment: use explicit field mapping.
- Prevent prototype pollution when parsing custom JSON from blockchain.
- Connection strings and secrets only via env vars, never committed.

## 13. Documentation

- Prefer latest official docs:
  - NestJS v11: https://docs.nestjs.com
  - Mongoose v9: https://mongoosejs.com/docs
  - Zod: https://zod.dev
  - `@hiveio/dhive`: https://github.com/openhive-network/dhive
- Use context7 MCP when available.
- Do not rely on outdated blog posts.

## 14. Code style

- ESLint flat config (`eslint.config.mjs`) with typescript-eslint + Prettier.
- Prettier: single quotes, trailing commas (all), auto endOfLine.
- Unused vars must be prefixed with `_`.
- Floating promises: warn.
- Prefer small focused functions.
- Prefer composition over inheritance (except `MongoRepository` base class).
- Use descriptive names.
- Avoid deep nesting (prefer early returns).
- Avoid magic numbers (use constants).
- No dead or commented-out code.
- Comments in English only.

## 15. Build and run

### 15.1 Building projects

**Libraries:**

- `nx build <lib>` - Builds library using `@nx/js:tsc` executor
- Generates `package.json` automatically if `generatePackageJson: true` is set
- Output: `dist/libs/<lib-name>/`
- Dependencies: Automatically builds dependent libs first (`dependsOn: ["^build"]`)
- **Note**: Libraries with workspace dependencies (e.g., `clients` depends on `common`) are typically built as part of app builds. Standalone library builds work best for libraries without workspace dependencies.

**Applications:**

- `nx build <app>` - Builds app using webpack via `@nx/webpack`
- Generates `package.json` automatically via webpack config
- Output: `dist/apps/<app-name>/`
- Dependencies: Automatically builds dependent libs first

**Build order:**

- Nx automatically determines build order based on `implicitDependencies`
- Example: Building `hive-parser` will build `common` → `clients` → `processors` → `hive-parser`

### 15.2 Development

- Dev: `nx serve <project>` (continuous mode with watch)
- Uses root `node_modules` for all dependencies
- Hot reload enabled for apps

### 15.3 Production

**Build and deploy:**

- Build: `nx build <app>` (production build)
  - Automatically generates `dist/apps/<app>/package.json` with only used packages
  - No manual `package.json` creation needed
  - Unused packages are automatically excluded
- Prune dependencies: `nx run <app>:prune-lockfile` (optional, for Docker optimization)
  - Generates minimal `package.json` + `package-lock.json`
  - Recommended for Docker images to minimize size
- Deploy: `cd dist/apps/<app> && npm ci --only=production && node main`
- Docker: See `apps/<app>/Dockerfile.example` for multi-stage build setup

**Key points:**

- ✅ No manual `package.json` creation - webpack generates it automatically
- ✅ Only imported/used packages are included - unused packages excluded automatically
- ✅ Perfect for Docker - minimal dependencies = smaller images
- ✅ Each app has its own `tsconfig.app.json` extending root `tsconfig.base.json`
- ✅ Each lib has its own `tsconfig.lib.json`
- ✅ Project configuration in `project.json` (targets: build, serve, test, lint)
- ✅ Use `nx run <project>:<target>` for explicit target execution

## 16. Git and changes

- Do not introduce breaking changes silently.
- Keep commits focused.
- Update types when modifying contracts.
- Refactor safely.
- Do not commit `.env` files or secrets.

## 17. Architecture extensions and execution rules

### 17.1 Boundary enforcement

- Project tags (`type:app`, `type:lib`, `scope:shared`, `scope:infra`, `scope:domain`) are set in each project's `project.json`.
- Module boundaries are enforced by ESLint rule `@nx/enforce-module-boundaries` with `depConstraints`: apps may depend only on libs; `scope:shared` libs have no internal lib deps; `scope:infra` may depend on `scope:shared`; `scope:domain` may depend on `scope:infra` and `scope:shared`.
- Do not add dependencies that violate these constraints.

### 17.2 Repository vs domain (strict)

- Repositories must perform data access only (queries, writes, projections). No business rules (e.g. "is user blacklisted", "find or create department") in the repository layer.
- Move such logic to domain services that use repositories. Repositories expose primitives (e.g. `findOneByName`, `create`); domain services implement decisions and orchestration.

### 17.3 Strategy-based decomposition

- Large orchestrator services (e.g. many field-specific handlers in one class) should be split into a thin orchestrator and multiple strategy classes implementing a common interface (e.g. `supports(context)` and `execute(context)`).
- Add new behavior by adding new strategy classes rather than expanding a single large service.

### 17.4 Event-driven coordination

- Use NestJS `EventEmitter2` (`@nestjs/event-emitter`) for in-process domain events when coordinating side effects (notifications, import updates, cache updates, external API calls).
- Emit typed domain events from core handlers (e.g. `object.created`, `object.field.updated`); subscribe with dedicated handlers so core logic stays decoupled from side effects.
- Keep event payloads typed and handlers idempotent where possible.

### 17.5 Capability slicing

- Structure code so that capabilities (e.g. object processing, notifications, import integrations) have clear boundaries and communicate via contracts or events. This allows future extraction into separate processes or services without large rewrites.

### 17.6 New apps and libs (Nx generators only)

- Do not create new apps or libraries by manually adding folders and config. Always scaffold via Nx generators (e.g. `nx g @nx/js:library --name=... --directory=... --no-interactive`). Use the `nx-generate` skill when scaffolding.
- This keeps `project.json`, `tsconfig`, and dependency graph consistent.

### 17.7 Domain constants and shared libs

- Domain-specific constants (object types, field names, supposed updates, translations) belong in `@waivio-core-services/domain-constants` or another domain-scoped lib.
- Keep `@odl/common` generic (utilities, non-domain constants). Keep `@waivio-core-services/clients` infrastructure-only (no domain business rules or domain-specific schemas ownership).

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- New apps and libs MUST be created only through Nx generators (e.g. `nx g @nx/js:library ...`). Do not create them by hand.
- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools.

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
