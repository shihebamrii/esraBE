# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# نسخو package files
COPY package*.json ./

# نركبو الـ dependencies
RUN npm ci --only=production

# Production stage
FROM node:20-alpine

WORKDIR /app

# نعملو user غير root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# نسخو من الـ builder
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

# نبدلو للـ user
USER nodejs

# نعرضو البورت
EXPOSE 5000

# نشغلو التطبيق
CMD ["node", "server.js"]
