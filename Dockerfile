FROM node:26-alpine
WORKDIR /app
RUN apk add --no-cache libc6-compat

COPY --chown=node:node package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy the repository runtime, then build /public from the same shell used by GitHub Pages.
COPY --chown=node:node . .
RUN node scripts/build-public.mjs \
  && rm -rf tests docs .github \
  && find . -maxdepth 1 -type d -name 'preview-v*' -exec rm -rf {} +

ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:3000/health/ready >/dev/null || exit 1
CMD ["npm","start"]
