# 绿联 NAS 部署步骤（UGOS Pro）

本应用是前后端两个容器，需要在 NAS 上用源码构建，不能只拉一个现成镜像。下面按绿联官方 Docker「项目」（Compose）流程写。

参考：

- [Docker 玩法教程](https://www.ugnas.com/play/cid-6.html)
- [新手一文读懂，绿联 NAS Docker 入门指南](https://www.ugnas.com/play-detail/id-119.html)
- [官方知识中心 · Docker / 项目](https://support.ugnas.com/detail/article/236)

适用：UGOS Pro（桌面有 **应用中心**、**Docker**，Docker 里有 **项目** 页）。

---

## 0. 部署前准备

1. NAS 已开机并接到家里路由器，电脑和手机连同一 Wi-Fi。
2. 在 NAS 桌面打开 **控制面板 → 网络**，记下局域网 IP，例如 `192.168.1.50`。后面写成 `<NAS_IP>`。
3. 确认 **8088** 没被别的容器占用。冲突就改成 `18088`（见第 7 步）。

---

## 1. 安装 Docker

绿联默认不装 Docker，要在应用中心手动装（官方入门指南）。

1. 打开 **应用中心**。
2. 搜索并安装 **Docker**。
3. 装完后桌面出现 Docker 图标，点开，能看到总览（容器数、CPU/内存）。

---

## 2. 配置镜像加速（国内必做）

首次构建要拉 `node:20-alpine`、`nginx:alpine`。不配加速，经常卡在拉镜像。

按官方入门指南：

1. Docker → **镜像** → 右上角 **设置**。
2. 增加加速源（地址没有 `https://` 的自己补上），任选 2～3 个：

| 加速源 |
| --- |
| `https://docker.1ms.run` |
| `https://docker.m.daocloud.io` |
| `https://docker.1panel.live` |
| `https://dockerproxy.cn` |

3. 保存。拉镜像仍然失败时，换一个源再试。官方完整列表见 [入门指南 · 避坑](https://www.ugnas.com/play-detail/id-119.html)。

---

## 3. 把项目文件放到 NAS

Docker「项目」会在共享文件夹 **docker** 下使用同名目录。最终应是：

```
docker/
└── baby-food-tracker/
    ├── docker-compose.yml
    ├── api/
    │   ├── Dockerfile
    │   ├── package.json
    │   ├── prisma/
    │   ├── src/
    │   └── data/          ← SQLite 会写在这里，不要删
    └── web/
        ├── Dockerfile
        ├── nginx.conf
        ├── package.json
        └── src/
```

**不要上传** `node_modules/`、`web/dist/`、本机 `.env`。NAS 构建时会自己装依赖。

### 方式 A：电脑打包后上传（推荐）

在电脑项目目录执行：

```bash
make pack
```

得到 `baby-food-tracker-nas.zip`。然后：

1. NAS 桌面打开 **文件管理**。
2. 进入共享文件夹 **docker**（一般在第一个存储池）。
3. 若还没有 `baby-food-tracker` 文件夹，点 **新建文件夹**，名称填 `baby-food-tracker`。
4. 进入该文件夹，点 **上传**，选 zip。
5. 上传完成后，右键 zip → **解压到当前目录**，确认能看到 `docker-compose.yml`。
6. 解压完可删除 zip，省空间。

不知道 docker 的绝对路径时：在文件管理里对文件夹 **右键 → 属性**（手机端点 ⓘ），常见为 `/volume1/docker/baby-food-tracker`。多盘/第二存储池可能是 `/volume2/docker/...`。

### 方式 B：先建 Docker 项目，再上传

和官方「项目 → 创建」一致：先创建空项目，系统会在 `docker` 下自动建同名文件夹，再把文件传进去。

1. Docker → **项目** → **创建**。
2. 项目名称填 `baby-food-tracker`（不要改名，和下面路径对得上）。
3. 先不要点部署。打开 **文件管理 → docker → baby-food-tracker**，按方式 A 上传并解压。
4. 回到 Docker 项目，确认能识别 `docker-compose.yml`，再 **立即部署**。

### 方式 C：SSH（可选）

1. **控制面板 → 终端机**（或「SSH」）→ 启用 SSH。
2. 电脑执行：

```bash
# 先本机打包
make pack

# 上传并解压（用户名、IP、volume 号按你的 NAS 改）
scp baby-food-tracker-nas.zip 管理员用户名@<NAS_IP>:/volume1/docker/
ssh 管理员用户名@<NAS_IP>
sudo -i
cd /volume1/docker
mkdir -p baby-food-tracker
unzip -o baby-food-tracker-nas.zip -d baby-food-tracker
```

然后回到 Docker 图形界面创建/部署项目。日常维护也可以在该目录执行 `docker compose`。

---

## 4. 用 Docker「项目」部署

对齐官方玩法（[在绿联 NAS 上用 Compose 部署](https://www.ugnas.com/play-detail/id-11.html)）：

1. 打开 **Docker** → 左侧 **项目** → **创建**。
2. **项目名称**：`baby-food-tracker`。
3. **存放路径**：选 `docker/baby-food-tracker`（上一步已经放好代码的那个目录）。
4. **Compose 配置**：
   - 路径选对后，一般会自动读到 `docker-compose.yml`；
   - 没有自动出现就点导入，或把仓库里的内容贴进去。
5. 核对这两处，**不要改成绿联旧系统那种很长的绝对路径**。官方建议用相对路径：

```yaml
volumes:
  - ./api/data:/data          # 数据库落在项目目录里
ports:
  - "8088:80"                 # 浏览器访问 NAS 的 8088
```

6. 点 **立即部署**（有的版本叫「构建并启动」）。

首次会：拉基础镜像 → 在 NAS 上 `npm install` → 构建前端 → 启动。一般 **5～15 分钟**，视硬盘和网络而定。机械盘会更慢。

部署成功后，项目里应有两个容器且为运行中：

| 容器名 | 作用 |
| --- | --- |
| `baby-food-web` | 页面 + 把 `/api` 转到后端 |
| `baby-food-api` | 接口 + SQLite |

---

## 5. 打开应用

电脑或手机浏览器访问：

```text
http://<NAS_IP>:8088
```

例如 `http://192.168.1.50:8088`。

第一次启动会自动建库并写入爸爸/妈妈和常用食材。能看到首页、食材列表，即部署成功。

手机（连家里 Wi-Fi）：

1. Safari / Chrome 打开上面的地址。
2. 分享 → **添加到主屏幕**。
3. 以后从图标进入，和 App 一样。

到这一步，记录、时间线、食材库、统计都能用了。「问 AI」需要再配一个模型 Key，接着看第 6 步。

---

## 6. 配置 AI 问答（DeepSeek）

「问 AI」页会把所选时段内的**辅食记录 + 事件记录**整理成上下文，发给 DeepSeek 生成回答。不配也能正常记录、看时间线，只是点「问 AI」会提示未配置。

**API Key 申请**：打开 [platform.deepseek.com](https://platform.deepseek.com) → 登录 → **API Keys** → **创建**，复制 `sk-` 开头的那串。**只在创建时显示一次**，没保存就再建一个。

### 6.1 在 NAS 上填 Key（二选一）

**方式一：新建 `.env`（推荐，Key 不落到 compose 文件里）**

在 `docker/baby-food-tracker/` 下新建一个名为 `.env` 的文件（和 `docker-compose.yml` 同一层），内容：

```ini
AI_API_KEY=sk-你申请的key
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat
```

docker compose 会自动加载这个文件，把三个值注入 `baby-food-api` 容器。

注意：**不是 `api/.env`**。`api/.env` 只在电脑上跑开发（`make`）时用，`make pack` 打出的 zip 里也不含它。

**方式二：直接写进 `docker-compose.yml`**

Docker → 项目 → `baby-food-tracker` → **组合配置**（或在文件管理里编辑 `docker-compose.yml`），把 `api` 的 `environment` 下面这三行的值替换成自己的：

```yaml
- AI_API_KEY=sk-你申请的key
- AI_BASE_URL=https://api.deepseek.com/v1
- AI_MODEL=deepseek-chat
```

这么写 Key 是明文存在文件里，**别把这个文件传到公开仓库**。

### 6.2 让配置生效

环境变量要**重建容器**才读得到：

Docker → **项目** → `baby-food-tracker` → **重新部署**。

SSH 的话：

```bash
cd /volume1/docker/baby-food-tracker
docker compose up -d
```

### 6.3 验证

页面 →「问 AI」→ 随便问一句，能收到回复就说明通了。也可以直接打接口：

```bash
curl -s -X POST http://<NAS_IP>:8088/api/ai/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"你好，用一句话介绍你能做什么"}]}'
```

正常返回形如：

```json
{"reply":"……","model":"deepseek-chat","usage":{"total_tokens":123}}
```

| 返回 | 含义 | 怎么办 |
| --- | --- | --- |
| `503 {"error":"AI_API_KEY 未配置"}` | 容器没读到 Key | 检查 `.env` 的路径和文件名（是否与 compose 同层）、是否已「重新部署」 |
| `401` | Key 无效或已被删除 | 去控制台重新生成 |
| `402` | 余额不足 | DeepSeek 控制台充值 |
| `429` | 触发限流 | 稍等再问 |
| `502 {"error":"调用 AI 上游失败"}` | 容器连不上 DeepSeek | 确认 NAS 能上外网、`AI_BASE_URL` 没写错 |
| 一直转圈 | 网络慢或模型在长时间思考 | `deepseek-reasoner` 明显更慢，日常用 `deepseek-chat` |

### 6.4 换别的模型

只要厂商支持 OpenAI 兼容协议，改 `AI_BASE_URL` 和 `AI_MODEL` 两行就行：

| 厂商 | AI_BASE_URL | AI_MODEL |
| --- | --- | --- |
| DeepSeek（默认） | `https://api.deepseek.com/v1` | `deepseek-chat` / `deepseek-reasoner` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` / `gpt-4o` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` / `qwen-turbo` |
| 月之暗面 | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |

### 6.5 本机开发也要配一份

电脑上跑 `make` 时读的是 **`api/.env`**（后端本身没引 dotenv，由 Makefile 读出来注入 dev 进程）。填好这三行：

```ini
AI_API_KEY=sk-...
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat
```

临时换 Key 可以用 `AI_API_KEY=sk-xxx make` 覆盖，不用改文件。

### 6.6 隐私提醒

提问时，**所选时段内的辅食和事件记录会整段发给模型厂商**，里面可能有宝宝的健康信息。建议只用自己信任的厂商，并且不要把服务直接暴露到公网（见第 10 步）。

---

## 7. 端口被占用 / 防火墙

官方避坑：容器「部署成功但启动失败」，多半是端口占用。

1. Docker → 该项目 → **组合配置**（或编辑 compose）。
2. 把 `"8088:80"` 改成空闲端口，例如 `"18088:80"`（只改左边）。
3. 点 **重新部署**。
4. 之后访问 `http://<NAS_IP>:18088`。

若页面打不开、容器却是运行中：到 **控制面板 → 安全 / 防火墙**，放行该端口。

---

## 8. 日常维护

都在 Docker → **项目** → `baby-food-tracker`：

| 操作 | 怎么做 |
| --- | --- |
| 看日志 | 项目里点容器 → 日志；API 起不来先看 `baby-food-api` |
| 重启 | 项目页停止再启动，或「重新部署」（**只重启容器，不编译代码**） |
| 升级代码 | 见下方「升级必须重建镜像」；光点「重新部署」**不会** `npm run build` |
| 改 AI 配置 | 编辑 `.env`（或 compose 里的 `AI_*`）→ **重新部署**即可（只改环境变量） |
| 停止 | 项目页停止；不要删数据目录 |

### 升级必须重建镜像（重要）

前端在镜像构建时执行 `npm run build`，结果打进 nginx 镜像；API 也是把 `src/` 拷进镜像。

`docker-compose.yml` 已为 api/web 设置 `pull_policy: build` + 固定镜像名（`baby-food-api:local` / `baby-food-web:local`）。  
Compose V2 较新时，「重新部署」会触发 build；绿联若 Compose 较旧、仍只用旧镜像，就用下面 SSH。

**升级步骤：**

1. 电脑执行 `make pack`，把 zip 传到 NAS 的 `docker/baby-food-tracker`，解压覆盖（**不要覆盖** SQLite 数据目录；当前 compose 数据在 `../db/baby-food`，别动那个文件夹）。
2. Docker → 项目 → **重新部署**。看构建日志是否出现 `Building` / `npm run build`。
3. 若仍是旧页面，SSH：

```bash
cd /volume1/docker/baby-food-tracker   # volume 号以文件管理「属性」为准
docker compose up -d --build --force-recreate
# 仍像旧版时再强制不走缓存：
# docker compose build --no-cache && docker compose up -d --force-recreate
```

或图形界面：停项目 → 删掉 `baby-food-api:local` / `baby-food-web:local` → 再部署。

判断是否真的重新编译了：构建日志里要有 `RUN npm run build`（web）；只有 `Container ... Recreated` 没有 build，就是还在用旧镜像。

SSH 在项目目录也可以：

```bash
cd /volume1/docker/baby-food-tracker
docker compose logs -f
docker compose ps
docker compose up -d --build --force-recreate   # 升级代码
```

---

## 9. 备份

记录全在一个 SQLite 文件里：

```text
/volume1/docker/baby-food-tracker/api/data/baby-food.db
```

（volume 号以文件管理「属性」为准。）

建议：

1. **控制面板 → 备份**（或「备份任务」），把 `docker/baby-food-tracker/api/data` 定期拷到另一块盘或外接硬盘，每周一次即可。
2. 手动：文件管理里复制 `baby-food.db`，改名为 `baby-food-2026-09-11.db`。

恢复：停项目 → 用备份文件覆盖 `api/data/baby-food.db` → 再启动。

---

## 10. 外网访问（可选）

家里用局域网即可。要出门也能打开：

1. NAS 上配置 **DDNS**（绿联自带或花生壳等）。
2. 用 **反向代理** 把外网 `443` 转到本机 `8088`，并挂 HTTPS 证书。
3. 或用 Tailscale / Zerotier，不映射端口。

菜单位置因固件而异：旧版多在 **控制面板 → 网络 → 反向代理**；新版可能在网络 / 反向代理独立入口。以你机器上的名称为准。

辅食记录是家庭数据，**不要裸奔 HTTP 暴露到公网**。

---

## 11. 打不开时怎么查

1. Docker → **项目** 里两个容器是否都在运行。
2. `baby-food-api` 日志里是否有 `[api] listening`、`[seed] done`。
3. 镜像一直 Pull 失败 → 回到第 2 步换加速源（官方入门指南第一条避坑）。
4. 构建报权限 / 路径错误 → compose 里数据卷保持 `./api/data:/data`，不要手写 `/mnt/dm-0/.ugreen_nas/...`。
5. 页面出、接口 502 → API 没起来，看 API 日志，不要只重启 web。
6. 「问 AI」报错或提示未配置 → 见第 6 步的返回码对照表。
7. 仍不行：Docker → **日志**，把 `baby-food-api` / `baby-food-web` 最近错误记下来再查。
8. 改了代码、页面还是旧的 → 「重新部署」没重建镜像，见第 8 步「升级必须重建镜像」。
