FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package*.json ./
RUN npm install --omit=dev
COPY server.mjs ./
COPY lib ./lib
COPY sql ./sql
COPY public ./public
COPY assets ./assets
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1
CMD ["npm","start"]
