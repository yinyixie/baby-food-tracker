# 宝宝辅食记录 App — 实施计划

> 部署目标：绿联 NAS（DH2600 / 6800 等支持 Docker 的型号）
> 用途：家人共同记录 1 岁+ 宝宝的日常饮食、过敏反应、食材多样性
> 技术栈：Vue 3 + Express + SQLite + PWA + Docker Compose

---

## 0. 一句话总览

一个 PWA 单页应用，跑在绿联 NAS 的 Docker 里，手机浏览器添加到主屏幕就能像 App 一样用；两个人通过「角色切换」区分记录；食材用预设 + 多选方式让单次记录 < 30 秒。

---

## 1. 目录结构

```
baby-food-tracker/
├── PLAN.md                       ← 本文档
├── README.md
├── docker-compose.yml            ← 一键启动整个应用
├── .env.example
├── api/                          ← 后端
│   ├── Dockerfile
│   ├── package.json
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── index.js              ← Express 入口
│   │   ├── routes/
│   │   │   ├── foods.js
│   │   │   ├── records.js
│   │   │   ├── recorders.js
│   │   │   └── stats.js
│   │   └── middleware/
│   │       └── error.js
│   └── data/                     ← SQLite 文件（运行时生成，git ignore）
└── web/                          ← 前端（PWA）
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── public/
    │   ├── manifest.json
    │   └── icons/                ← 192/512 png，应用图标
    └── src/
        ├── main.js
        ├── App.vue
        ├── router.js
        ├── stores/
        │   ├── recorder.js       ← Pinia：当前角色
        │   └── foods.js          ← Pinia：食材库缓存
        ├── composables/
        │   └── useApi.js
        ├── views/
        │   ├── RecordView.vue    ← 快速记录（首页）
        │   ├── TimelineView.vue
        │   ├── FoodsView.vue
        │   └── StatsView.vue
        └── components/
            ├── RecorderSwitch.vue
            ├── FoodPicker.vue
            ├── MealTypeChips.vue
            └── RecordCard.vue
```

---

## 2. 数据库设计（Prisma schema）

```prisma
// api/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Recorder {
  id        Int      @id @default(autoincrement())
  name      String   @unique          // "爸爸" / "妈妈"
  emoji     String                    // "👨" / "👩"
  color     String                    // "#1677ff" 等，用于 UI 区分
  records   Record[]
  createdAt DateTime @default(now())
}

model Food {
  id        Int      @id @default(autoincrement())
  name      String   @unique
  category  String                    // "主食" / "蔬菜" / "水果" / "肉类" / "蛋奶" / "其他"
  emoji     String                    // 🍚 🥦 🍎 ...
  isActive  Boolean  @default(true)
  notes     String?
  items     RecordItem[]
  createdAt DateTime @default(now())
}

model Record {
  id           Int      @id @default(autoincrement())
  recordedAt   DateTime                // 实际喂食时间（用户填）
  recorderId   Int
  recorder     Recorder @relation(fields: [recorderId], references: [id])
  mealType     String                  // "早餐" / "午餐" / "晚餐" / "加餐"
  appetite     String                  // "好" / "一般" / "不好"
  reaction     String                  // "无" / "轻微" / "明显" / "严重"
  reactionNote String?
  note         String?
  items        RecordItem[]
  createdAt    DateTime @default(now())

  @@index([recordedAt])
  @@index([recorderId])
}

model RecordItem {
  id       Int    @id @default(autoincrement())
  recordId Int
  record   Record @relation(fields: [recordId], references: [id], onDelete: Cascade)
  foodId   Int
  food     Food   @relation(fields: [foodId], references: [id])
  amount   String                       // "少量" / "适量" / "大量"
}
```

**初始化数据（seed）**：
- Recorder：插入 "爸爸 👨" 和 "妈妈 👩"
- Food：插入常见辅食 30-40 条，按分类划分

---

## 3. API 设计

Base URL：`http://<nas-ip>:8088/api`

| Method | Path | 说明 |
|---|---|---|
| GET    | `/recorders`                       | 角色列表 |
| GET    | `/foods?category=&q=`              | 食材列表（支持分类/模糊搜索） |
| POST   | `/foods`                           | 新增食材 `{name, category, emoji}` |
| PATCH  | `/foods/:id`                       | 更新食材 |
| DELETE | `/foods/:id`                       | 软删除（isActive=false） |
| GET    | `/records?from=&to=&recorderId=&limit=` | 记录列表 |
| POST   | `/records`                         | 新增记录（含 items） |
| GET    | `/records/:id`                     | 单条详情 |
| PATCH  | `/records/:id`                     | 更新 |
| DELETE | `/records/:id`                     | 删除 |
| GET    | `/stats/weekly`                    | 本周食材分类汇总、品种数 |
| GET    | `/stats/diversity`                 | 最近 7 天食材多样性 |
| GET    | `/stats/reactions`                 | 过敏反应历史 |

**POST /records 请求体示例**：
```json
{
  "recordedAt": "2026-09-11T08:30:00",
  "recorderId": 1,
  "mealType": "早餐",
  "appetite": "好",
  "reaction": "无",
  "reactionNote": null,
  "note": "今天自己抓勺子",
  "items": [
    { "foodId": 3, "amount": "适量" },
    { "foodId": 7, "amount": "少量" }
  ]
}
```

---

## 4. 页面与交互详细

### 4.1 快速记录页（首页 `/`）

```
┌───────────────────────────────┐
│  2026-09-11 周五    👨 爸爸 ▼ │  ← 日期 + 角色切换
├───────────────────────────────┤
│  🍚 早餐  🌞午餐  🌙晚餐  ➕加餐 │  ← 餐次 chip（单选）
├───────────────────────────────┤
│  食材（共 5 种）            ▼  │  ← 折叠面板，点击展开选择器
│  [× 米饭 适量] [× 苹果 少量]   │
│  + 添加食材                    │  ← 点击弹出 FoodPicker
├───────────────────────────────┤
│  食量总评                      │
│  ○ 好  ●一般  ○不好            │  ← Radio
├───────────────────────────────┤
│  过敏反应                      │
│  ● 无  ○轻微  ○明显  ○严重     │  ← Radio
│  [过敏反应备注输入框]          │  ← 仅在 ≠无 时显示
├───────────────────────────────┤
│  备注                          │
│  [多行输入框]                  │
├───────────────────────────────┤
│  [       保 存 记 录       ]  │  ← 大按钮
└───────────────────────────────┘
```

**FoodPicker（弹层）**：
- 顶部 Tab：主食/蔬菜/水果/肉类/蛋奶/其他/全部
- 每个 Tab 下：emoji + 名称的方格，点击选中（再点取消）
- 选中项右侧显示「少量/适量/大量」快速切换
- 底部固定「确定」按钮

**角色切换**：
- 点击 Header 右上角的角色按钮 → 底部弹出 ActionSheet：👨 爸爸 / 👩 妈妈
- 选择后写 `localStorage.babyFoodRecorder = {id, name, emoji}`
- 每次新增记录时带上 recorderId

### 4.2 时间线 `/timeline`

```
┌───────────────────────────────┐
│  ◀  2026-09-11 周五  ▶        │  ← 日期选择器，可左右切
├───────────────────────────────┤
│  📍 今天 9月11日               │
│   🍚 08:30 早餐 · 爸爸        │
│      米饭、苹果、西兰花        │
│      食量：好  反应：无 ✓      │
│      [备注：自己抓勺子]       │
│   ──────────────────────     │
│   🌞 12:00 午餐 · 妈妈        │
│      ...                      │
├───────────────────────────────┤
│  📍 昨天 9月10日               │
│   ...                         │
└───────────────────────────────┘
```

**交互**：长按卡片 → 弹出操作菜单（编辑/删除）

### 4.3 食材库 `/foods`

```
┌───────────────────────────────┐
│  食材库               ＋ 新增 │
├───────────────────────────────┤
│ [全部][主食][蔬菜][水果]...    │  ← Tab 栏
├───────────────────────────────┤
│ 🍚 米饭              [编辑]    │
│ 🥦 西兰花            [编辑]    │
│ 🍎 苹果              [编辑]    │
│ 🥕 胡萝卜            [编辑]    │
│ ...                           │
└───────────────────────────────┘
```

**新增/编辑食材弹层**：
- 名称输入
- 分类下拉
- Emoji 选择器（用 input + 预览）

### 4.4 统计 `/stats`

- **本周概览**：本周记录次数、食材料类数、新食材数
- **食材多样性**（饼图）：各分类占比
- **高频食材 TOP 10**：列表
- **过敏记录**：仅显示 reaction ≠ 无 的记录时间线

---

## 5. PWA 配置要点

`web/public/manifest.json`：
```json
{
  "name": "宝宝辅食记录",
  "short_name": "辅食记录",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1677ff",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

`web/index.html` head 区需要：
```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#1677ff">
<meta name="apple-mobile-web-app-capable" content="yes">
```

构建用 `vite-plugin-pwa`，自动生成 service worker（缓存 app shell）。

---

## 6. Docker 部署

### 6.1 docker-compose.yml

见同级 `docker-compose.yml` 文件。要点：
- API 容器：暴露 3000，仅内网访问（通过 web 反向代理）
- Web 容器：暴露 8088（NAS 端口映射）
- 数据卷：`./api/data:/data`，SQLite 文件落在 NAS 硬盘
- 时区：`TZ=Asia/Shanghai`

### 6.2 web 容器内 nginx 关键配置

```nginx
location /api/ {
    proxy_pass http://api:3000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

location / {
    root /usr/share/nginx/html;
    try_files $uri $uri/ /index.html;   # SPA history 模式
}
```

---

## 7. 绿联 NAS 部署步骤

按 UGOS Pro 图形界面逐步操作，见 [DEPLOY.md](./DEPLOY.md)（对齐官方 [Docker 玩法](https://www.ugnas.com/play/cid-6.html)）。

摘要：应用中心安装 Docker → 配置镜像加速 → `make pack` 上传到 `docker/baby-food-tracker` → Docker **项目** 创建并立即部署 → 访问 `http://<nas-ip>:8088`。

### 外网访问（如需）

绿联 NAS 自带「DDNS」+「反向代理」功能：
- 反向代理：把外网 443 → 内网 8088
- HTTPS：申请证书后挂上
- DDNS：花生壳 / 阿里云 DDNS 等

> ⚠️ 注意：绿联 NAS 不同固件版本「反向代理」位置不同，旧版在「控制面板 → 网络 → 反向代理」，新版叫「容器管理 / 反向代理」。

---

## 8. 开发顺序建议（Cursor 中操作）

> 用 Cursor 时，建议按「**先可跑，再扩展**」原则，每步都验证可跑再下一步。

### Phase 1：脚手架 + Docker 可跑（0.5 天）
1. `Cursor` 打开 `baby-food-tracker` 文件夹
2. 创建 `api/package.json`、`api/Dockerfile`、`api/src/index.js`（最简 Express）
3. 创建 `web/package.json`、`web/Dockerfile`、`web/nginx.conf`、`web/index.html`
4. 创建根目录 `docker-compose.yml`
5. 本地 `docker compose up -d --build`，浏览器访问 `http://localhost:8088` 能看到 "Hello"
6. ✅ 验收：能看到页面

### Phase 2：数据层（0.5 天）
1. 写 `schema.prisma`
2. `api/src/index.js` 接入 Prisma Client
3. 写 seed 脚本（角色 + 30 个食材）
4. 写食材 CRUD API
5. 用 curl 验证每个 API
6. ✅ 验收：`GET /api/foods` 能返回食材列表

### Phase 3：核心记录页（1 天）
1. 用 `npm create vue@latest` 或手动建 `web/src/`
2. 装 `vant`（移动端组件库）、`pinia`、`vue-router`、`axios`
3. 写 `RecordView.vue`（首页）+ `FoodPicker.vue` 弹层
4. 接入 API，能保存记录
5. ✅ 验收：完整跑通「选食材 → 保存 → 看时间线」

### Phase 4：其他页面（1 天）
1. `TimelineView.vue` —— 拉取 records，按日期分组渲染
2. `FoodsView.vue` —— 食材管理（增删改）
3. `RecorderSwitch.vue` —— 角色切换
4. ✅ 验收：四个页面路由都能跳转，刷新不丢失角色

### Phase 5：统计 + PWA（0.5 天）
1. 写 `stats.js` 路由（4 个端点）
2. `StatsView.vue` 用简单的 CSS 饼图（不引图表库）
3. 装 `vite-plugin-pwa`，配置 manifest + icons
4. ✅ 验收：手机上能看到「添加到主屏幕」选项，点击图标能全屏启动

### Phase 6：NAS 部署（0.5 天）
1. 把整个项目目录复制到 NAS `/volume1/docker/baby-food-tracker`
2. 绿联 Docker → 创建项目 → 构建启动
4. 手机连 WiFi 访问、添加主屏幕
5. ✅ 验收：完整流程能用一周不出问题

---

## 9. 验收清单（最终）

- [ ] `docker compose up -d` 一行命令能启动
- [ ] 局域网访问 `http://nas-ip:8088` 能看到首页
- [ ] 食材库至少有 30 个预置食材，可增删改
- [ ] 一次完整记录（选 3 种食材 + 选食量 + 过敏）能在 30 秒内完成
- [ ] 时间线按日期分组，长按可编辑/删除
- [ ] 角色切换在刷新页面后仍保持
- [ ] 统计页能展示本周食材数和分类占比
- [ ] 手机 Safari/Chrome 能"添加到主屏幕"
- [ ] 添加后从桌面图标启动为全屏、显示主题色
- [ ] 直接 `cp api/data/*.db` 能完整备份所有数据
- [ ] NAS 重启后数据不丢失

---

## 10. 风险与注意

| 风险 | 应对 |
|---|---|
| 绿联 NAS 老固件 Docker 路径是 `/volume1/docker/...`，新固件可能不同 | 部署前在 NAS 文件管理器确认 docker 默认目录 |
| 时区不对导致记录时间错乱 | docker-compose 强制 `TZ=Asia/Shanghai` |
| SQLite 文件被并发写损坏 | Prisma 默认是 WAL 模式，一般不会；高并发场景下加队列 |
| 老人/保姆不会用 | 做一张贴冰箱的「三步使用」指引即可（页面本身足够简单） |
| 数据库增长失控 | 一年最多几千条记录，SQLite 文件 1-2 MB，10 年都没问题 |

---

## 11. 后续可扩展（V2 再说）

- 📷 拍照记录（菜的照片、餐后表情）
- 📤 周报导出（PDF / 图片分享给家人）
- 📊 营养摄入计算（需要食材营养库，工作量大）
- 🏠 HomeAssistant / 米家集成（自动化场景触发）
- 🗓️ 多人多宝宝（一个 NAS 支持多个家庭）

不要在 V1 做以上任何一项，保持 MVP 简洁能跑通。