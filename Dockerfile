FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --chown=node:node package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --chown=node:node server.mjs ./
COPY --chown=node:node lib ./lib
COPY --chown=node:node sql ./sql
COPY --chown=node:node public ./public
COPY --chown=node:node assets ./assets
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1
CMD ["npm","start"]
