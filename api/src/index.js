// api/src/index.js
const express = require('express');
const cors = require('cors');
const { prisma } = require('./db');
const { errorMiddleware } = require('./middleware/error');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// 业务路由
app.use('/api/foods', require('./routes/foods'));
app.use('/api/records', require('./routes/records'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/baby', require('./routes/baby'));

// 404
app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

// 全局错误处理
app.use(errorMiddleware);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[api] listening on :${PORT}`);
});

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('[api] SIGTERM, closing...');
  await prisma.$disconnect();
  process.exit(0);
});