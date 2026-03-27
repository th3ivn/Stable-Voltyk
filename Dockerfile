FROM node:20-alpine AS builder
WORKDIR /app
# Fonts for schedule image rendering (satori requires font files)
RUN apk add --no-cache fontconfig font-noto
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine
WORKDIR /app
# Fonts for schedule image rendering (satori requires font files)
RUN apk add --no-cache fontconfig font-noto
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY drizzle/ ./drizzle/
EXPOSE 3000
CMD ["node", "dist/index.js"]
