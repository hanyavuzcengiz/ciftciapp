# Monorepo kökünden: docker build -f services/listing-service/Dockerfile .
FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY services/listing-service/package.json ./
RUN npm install

COPY services/listing-service/ ./
RUN npx prisma generate && npx tsc -p tsconfig.json

ENV NODE_ENV=production
ENV PORT=3002
EXPOSE 3002

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
