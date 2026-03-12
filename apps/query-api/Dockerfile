FROM node:24.12.0-alpine3.23 AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
COPY nx.json tsconfig.base.json ./
COPY apps/query-api ./apps/query-api
COPY libs ./libs

RUN pnpm install --frozen-lockfile

RUN pnpx nx run query-api:prune-lockfile

FROM node:24.12.0-alpine3.23 AS production

WORKDIR /app

RUN npm install -g pnpm

COPY --from=builder /app/dist/apps/query-api ./

RUN pnpm install --frozen-lockfile --prod && \
    pnpm store prune && \
    rm -rf /tmp/* /var/tmp/*

CMD ["node", "main.js"]
