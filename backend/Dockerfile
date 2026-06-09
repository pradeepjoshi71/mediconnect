FROM node:20-alpine

# Install postgresql-client for pg_dump (required by backupScheduler.js in production)
# Install curl for health checks
RUN apk add --no-cache postgresql16-client curl

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Create backup output directory — will be overridden by volume mount in production
RUN mkdir -p /backups

ENV NODE_ENV=production

EXPOSE 5000

CMD ["node", "src/server.js"]
