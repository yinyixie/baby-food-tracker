// api/src/routes/baby.js
// 宝宝基础信息：出生日期 + 当前月龄（来自环境变量 BABY_BIRTH）
const express = require('express');
const { asyncHandler } = require('../middleware/error');
const { babyInfo } = require('../baby');

const router = express.Router();

router.get('/info', asyncHandler(async (req, res) => {
  const info = babyInfo();
  if (!info) {
    return res.json({
      birth: null,
      hint: '未配置 BABY_BIRTH。在 api/.env（本机）或 docker-compose 同目录 .env（NAS）加一行 BABY_BIRTH=YYYY-MM-DD',
    });  }
  res.json(info);
}));

module.exports = router;
