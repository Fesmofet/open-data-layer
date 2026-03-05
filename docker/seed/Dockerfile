FROM node:20-alpine
WORKDIR /app
COPY tools/seed/package.json tools/seed/run.js ./
RUN npm install --omit=dev
CMD ["node", "run.js"]
