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
# V7 全站免费开关（构建期注入前端；默认 off = fail-safe，恢复付费时传 epay 重建）
ARG NEXT_PUBLIC_PAYMENT_MODE=off
ENV NEXT_PUBLIC_PAYMENT_MODE=${NEXT_PUBLIC_PAYMENT_MODE}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma:generate && pnpm build

# ---------- worker ----------
FROM build AS worker
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
USER nextjs

# ---------- migrate / seed ----------
# 保留构建阶段的 pnpm、Prisma CLI 和 tsx，供生产初始化任务使用；不进入精简 app 镜像。
FROM build AS migrate
ENV NODE_ENV=production

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
