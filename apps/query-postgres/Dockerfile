FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json nx.json ./
COPY apps ./apps
COPY libs ./libs
RUN pnpm install --frozen-lockfile
RUN pnpm nx run query-postgres:build --skip-nx-cache

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist/apps/query-postgres ./
RUN npm install --omit=dev
EXPOSE 3002
CMD ["node", "main.js"]
