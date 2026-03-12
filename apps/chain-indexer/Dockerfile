FROM node:24.12.0-alpine3.23 AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
COPY nx.json tsconfig.base.json ./
COPY apps/chain-indexer ./apps/chain-indexer
COPY libs ./libs

RUN pnpm install --frozen-lockfile

RUN pnpx nx run chain-indexer:prune-lockfile

FROM node:24.12.0-alpine3.23 AS production

WORKDIR /app

RUN npm install -g pnpm

COPY --from=builder /app/dist/apps/chain-indexer ./

RUN pnpm install --frozen-lockfile --prod && \
    pnpm store prune && \
    rm -rf /tmp/* /var/tmp/*

CMD ["node", "main.js"]
