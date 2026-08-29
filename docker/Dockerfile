# ---------- deps ----------
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# ---------- build ----------
FROM node:20-alpine AS build
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma:generate && pnpm build

# ---------- worker ----------
FROM build AS worker
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
USER nextjs

# ---------- run ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
COPY --from=build --chown=nextjs:nodejs /app/node_modules/.pnpm/@prisma+client@5.18.0_prisma@5.18.0/node_modules/.prisma ./node_modules/.pnpm/@prisma+client@5.18.0_prisma@5.18.0/node_modules/.prisma
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
