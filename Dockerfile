FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache libc6-compat

RUN corepack enable && corepack prepare pnpm@11.19.0 --activate
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Copy the repository runtime, then build /public from the same shell used by GitHub Pages.
COPY --chown=node:node . .
RUN node scripts/build-public.mjs \
  && rm -rf tests docs .github \
  && find . -maxdepth 1 -type d -name 'preview-v*' -exec rm -rf {} +

ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:3000/health/ready >/dev/null || exit 1
CMD ["pnpm","start"]
