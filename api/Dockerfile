# 多阶段构建
FROM node:20-alpine AS builder
WORKDIR /app

# 时区 + OpenSSL：prisma generate 依赖 openssl 探测正确的 musl engine
RUN apk add --no-cache tzdata openssl && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone && \
    apk del tzdata

# 装所有依赖（prisma CLI 需要在 migrate 时用）
COPY package*.json ./
COPY prisma ./prisma
RUN npm install
RUN npx prisma generate

COPY src ./src

# 运行阶段
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache tzdata openssl && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone && \
    apk del tzdata

ENV TZ=Asia/Shanghai \
    NODE_ENV=production \
    PORT=3000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY package.json ./

# 在最终镜像里再 generate 一次，确保 query engine 与运行时 openssl/架构一致
RUN npx prisma generate

EXPOSE 3000

# 容器启动：同步 SQLite schema → 种子 → 服务
# 用 db push 而不是 migrate deploy：仓库不提交 migrations，NAS 上也能首次建库
CMD ["sh", "-c", "npx prisma db push --skip-generate && node src/seed.js && node src/index.js"]
