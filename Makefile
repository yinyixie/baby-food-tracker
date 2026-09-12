# 宝宝辅食记录 — 本地一键开发
# 用法：make

.DEFAULT_GOAL := dev

export DATABASE_URL ?= file:$(abspath api/data/baby-food.db)
export TZ           ?= Asia/Shanghai
export NODE_ENV     ?= development
export PORT         ?= 3088

WEB_PORT ?= 5173

export API_PROXY_TARGET ?= http://localhost:$(PORT)

# AI 问答配置（DeepSeek 等）：后端没有引 dotenv，这里从 api/.env 读出来注入 dev 进程
# 也可临时覆盖：AI_API_KEY=sk-xxx make
AI_API_KEY  ?= $(shell grep -E '^AI_API_KEY='  api/.env 2>/dev/null | cut -d= -f2-)
AI_BASE_URL ?= $(shell grep -E '^AI_BASE_URL=' api/.env 2>/dev/null | cut -d= -f2-)
AI_MODEL    ?= $(shell grep -E '^AI_MODEL='    api/.env 2>/dev/null | cut -d= -f2-)

# 宝宝出生日期（YYYY-MM-DD）：时间线/统计展示月龄，AI 问答带入上下文
BABY_BIRTH  ?= $(shell grep -E '^BABY_BIRTH=' api/.env 2>/dev/null | cut -d= -f2-)
# 宝宝小名（可选）：徽标与 AI 称呼，留空显示「宝宝」
BABY_NICKNAME ?= $(shell grep -E '^BABY_NICKNAME=' api/.env 2>/dev/null | cut -d= -f2-)

.PHONY: help dev setup install db check-ports stop up down rebuild logs pack

help:
	@echo ""
	@echo "  make        一键启动本地开发（前后端）"
	@echo "  make setup  只装依赖 + 初始化数据库"
	@echo "  make stop   停掉本地开发进程"
	@echo "  make pack   打包 zip，上传到绿联 NAS"
	@echo "  make up     Docker 构建并启动（生产/NAS 同款）"
	@echo "  make rebuild  强制无缓存重建镜像再启动（升级代码用）"
	@echo "  make down   停止 Docker"
	@echo "  make logs   跟踪 Docker 日志"
	@echo ""
	@echo "  开发地址    http://localhost:$(WEB_PORT)"
	@echo "  API         http://localhost:$(PORT)"
	@echo "  换端口      PORT=3090 make"
	@echo "  AI 配置     api/.env 里的 AI_API_KEY / AI_BASE_URL / AI_MODEL"
	@echo ""

# 一键：准备环境后同时拉起 API + 前端
dev: export AI_API_KEY  := $(AI_API_KEY)
dev: export AI_BASE_URL := $(AI_BASE_URL)
dev: export AI_MODEL    := $(AI_MODEL)
dev: export BABY_BIRTH  := $(BABY_BIRTH)
dev: export BABY_NICKNAME := $(BABY_NICKNAME)
dev: setup check-ports
	@echo ""
	@echo "→ API   http://localhost:$(PORT)"
	@echo "→ Web   http://localhost:$(WEB_PORT)"
	@echo "  Ctrl+C 停止"
	@echo ""
	@trap 'kill 0' INT TERM; \
		( cd api && npm run dev ) & \
		( cd web && npm run dev -- --port $(WEB_PORT) ) & \
		wait

check-ports:
	@busy=0; \
	if lsof -tiTCP:$(PORT) -sTCP:LISTEN >/dev/null 2>&1; then \
		echo "端口 $(PORT) 已被占用（API）。换端口：PORT=3090 make"; \
		busy=1; \
	fi; \
	if lsof -tiTCP:$(WEB_PORT) -sTCP:LISTEN >/dev/null 2>&1; then \
		echo "端口 $(WEB_PORT) 已被占用（前端 Vite）。先执行 make stop，或换端口：WEB_PORT=5174 make"; \
		busy=1; \
	fi; \
	if [ $$busy -eq 1 ]; then exit 1; fi

setup: install db

install:
	@echo "→ 安装依赖"
	@cd api && npm install
	@cd web && npm install

db:
	@echo "→ 初始化数据库"
	@mkdir -p api/data
	@test -f api/.env || printf '%s\n' \
		'DATABASE_URL=file:../data/baby-food.db' \
		'PORT=$(PORT)' \
		'TZ=Asia/Shanghai' \
		'NODE_ENV=development' \
		> api/.env
	@cd api && npx prisma generate
	@cd api && npx prisma db push --skip-generate
	@cd api && npm run seed

stop:
	@for port in $(PORT) $(WEB_PORT); do \
		pids=$$(lsof -tiTCP:$$port -sTCP:LISTEN 2>/dev/null || true); \
		for pid in $$pids; do \
			cmd=$$(ps -p $$pid -o command= 2>/dev/null || true); \
			case "$$cmd" in \
				*src/index.js*|*vite*) kill $$pid 2>/dev/null || true ;; \
			esac; \
		done; \
	done
	@echo "已停止本地开发进程"

up:
	docker compose up -d --build

# 绿联「重新部署」不会 docker build；升级源码后在本机/NAS 项目目录执行此目标
rebuild:
	docker compose build --no-cache
	docker compose up -d --force-recreate

down:
	docker compose down

logs:
	docker compose logs -f

# 给绿联文件管理上传：不含 node_modules / 本机数据库
pack:
	@rm -f baby-food-tracker-nas.zip
	@zip -r baby-food-tracker-nas.zip \
		docker-compose.yml \
		DEPLOY.md \
		api \
		web \
		-x '*/node_modules/*' \
		-x 'web/dist/*' \
		-x 'api/data/*.db' \
		-x 'api/data/*.db-*' \
		-x 'api/.env' \
		-x '*.DS_Store'
	@echo "→ 已生成 $(CURDIR)/baby-food-tracker-nas.zip"
