# 宝宝辅食记录 App

部署在绿联 NAS 上的家庭宝宝辅食记录工具，纯 Docker 一键启动。

## 功能

- 快速记录辅食（食物多选 + 食量 + 过敏反应）
- 时间线查看（按日期分组）
- 食材库管理（增删改、分类、搜索）
- 食材多样性统计 + 过敏记录追踪
- 问 AI（把所选时段的辅食 + 事件记录作为上下文发给 DeepSeek，聊宝宝状态和搭配建议；对话记录本地留存）
- 多人共用（爸爸/妈妈一键切换，无账号）
- PWA（手机浏览器添加到主屏幕，像 App 一样启动）
- 移动端响应式

## 技术栈

- 前端：Vue 3 + Vite + Vant UI + Pinia + vite-plugin-pwa
- 后端：Node.js + Express + Prisma + SQLite
- 部署：Docker Compose

## 目录结构

```
baby-food-tracker/
├── docker-compose.yml       # 一键启动
├── api/                     # 后端
│   ├── prisma/schema.prisma
│   ├── src/
│   │   ├── index.js         # 入口
│   │   ├── seed.js          # 初始食材库
│   │   ├── db.js
│   │   ├── middleware/
│   │   └── routes/          # foods / records / stats / ai
│   ├── data/                 # SQLite 文件位置
│   └── Dockerfile
└── web/                     # 前端
    ├── src/
    │   ├── views/           # QuickRecord / Timeline / Foods / Stats / AIChat
    │   ├── stores/
    │   ├── api/
    │   └── router/
    ├── public/              # manifest + icons
    ├── nginx.conf
    └── Dockerfile
```

## 本地启动（开发用）

需要：Docker Desktop

```bash
cd baby-food-tracker
docker compose up -d --build
```

浏览器打开 http://localhost:8088

首次启动会自动：
1. 跑 Prisma 迁移创建数据库
2. 注入种子数据（爸爸/妈妈 + 33 个常用食材）
3. 启动前后端

## 数据持久化

SQLite 文件保存在 `./api/data/baby-food.db`。**备份 = 复制这一个文件**。

```bash
# 手动备份
cp api/data/baby-food.db backup/baby-food-$(date +%F).db
```

## 绿联 NAS 部署

完整点选步骤见 [DEPLOY.md](./DEPLOY.md)，和绿联官方 [Docker 玩法](https://www.ugnas.com/play/cid-6.html) 的「项目 / Compose」一致。

最短路径：

1. 应用中心安装 **Docker**，并在 **镜像 → 设置** 里加上国内加速源（否则拉 `node` / `nginx` 容易失败）。
2. 电脑执行 `make pack`，把 `baby-food-tracker-nas.zip` 传到 NAS 的 `docker/baby-food-tracker` 并解压（不要上传 `node_modules`）。
3. Docker → **项目** → **创建**，名称 `baby-food-tracker`，路径选刚解压的目录，确认 `8088:80` 后 **立即部署**。
4. 浏览器打开 `http://<NAS_IP>:8088`；手机连家里 Wi-Fi 后「添加到主屏幕」。
5. 想用「问 AI」：在 `docker/baby-food-tracker/` 新建 `.env`，写入 `AI_API_KEY=sk-...`（外加 `AI_BASE_URL=https://api.deepseek.com/v1`、`AI_MODEL=deepseek-chat`），再 **重新部署**。详见 [DEPLOY.md 第 6 步](./DEPLOY.md#6-配置-ai-问答deepseek)。

数据在 `docker/baby-food-tracker/api/data/baby-food.db`，备份复制这一个文件即可。

## 日常运维

```bash
# 查看日志
docker compose logs -f

# 重启
docker compose restart

# 停止
docker compose down

# 升级（改完代码后）
docker compose up -d --build

# 进入容器排查
docker exec -it baby-food-api sh
```

## 开发模式

本机需要 Node.js 20+。一键启动：

```bash
make
# 浏览器打开 http://localhost:5173
```

会自动装依赖、同步 SQLite、注入种子数据，并同时拉起前后端（前端 `5173`，API `3088`）。`Ctrl+C` 停止，或另开终端执行 `make stop`。端口被占用时可用 `PORT=3090 make`。

「问 AI」的模型 Key 填在 **`api/.env`** 的 `AI_API_KEY`（默认已指向 DeepSeek），`make` 会自动读出来注入后端；临时换可以用 `AI_API_KEY=sk-xxx make`。也可直接把三行导出到 shell 环境。

也可以分两个终端手动跑：

```bash
# 后端
cd api
npm install
npx prisma db push
node src/seed.js
node --watch src/index.js

# 前端（新开终端）
cd web
npm install
npm run dev
```

## API 列表

详见 [PLAN.md](./PLAN.md#4-api-设计)

## 数据备份策略

NAS 上建议配置绿联自带的"备份任务"，把 `/volume1/docker/baby-food-tracker/api/data/` 同步到另一个盘或外接存储，每周一次即可。