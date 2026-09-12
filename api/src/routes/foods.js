// api/src/routes/foods.js
const express = require('express');
const { prisma } = require('../db');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

// 列表（支持分类过滤 + 关键词搜索）
router.get('/', asyncHandler(async (req, res) => {
  const { category, q } = req.query;
  const where = { isActive: true };
  if (category) where.category = category;
  if (q) where.name = { contains: q };
  const foods = await prisma.food.findMany({
    where,
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  res.json(foods);
}));

// 最近用过的食材（按 RecordItem 倒序去重）
router.get('/recent', asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 8, 20);
  // 多取一些以抵消重复，再在 JS 里去重保留顺序
  const items = await prisma.recordItem.findMany({
    orderBy: { record: { recordedAt: 'desc' } },
    take: limit * 4,
    include: {
      food: true,
      record: { select: { recordedAt: true } },
    },
  });
  const seen = new Set();
  const foods = [];
  for (const it of items) {
    if (!it.food || !it.food.isActive) continue;
    if (seen.has(it.foodId)) continue;
    seen.add(it.foodId);
    foods.push({ ...it.food, lastUsedAt: it.record.recordedAt });
    if (foods.length >= limit) break;
  }
  res.json(foods);
}));

// 创建
router.post('/', asyncHandler(async (req, res) => {
  const { name, category, emoji, notes, unit } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'name 与 category 必填' });
  const food = await prisma.food.create({
    data: {
      name,
      category,
      emoji: emoji || '🍽️',
      notes: notes || null,
      unit: unit === 'ml' ? 'ml' : 'g',
    },
  });
  res.status(201).json(food);
}));

// 更新
router.put('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { name, category, emoji, notes, isActive, unit } = req.body;

  const data = {};
  if (name !== undefined) data.name = name;
  if (category !== undefined) data.category = category;
  // 图标留空时兜底，避免存成空字符串（列表里会变成一块空白）
  if (emoji !== undefined) data.emoji = emoji || '🍽️';
  if (notes !== undefined) data.notes = notes;
  if (isActive !== undefined) data.isActive = isActive;
  if (unit !== undefined) data.unit = unit === 'ml' ? 'ml' : 'g';

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: '没有需要更新的字段' });
  }

  const food = await prisma.food.update({ where: { id }, data });
  res.json(food);
}));

// 删除：没被任何记录引用 → 真删；被引用过 → 软删（保留历史记录里的食材信息）
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const food = await prisma.food.findUnique({ where: { id } });
  if (!food) return res.status(404).json({ error: '食材不存在' });

  const usedCount = await prisma.recordItem.count({ where: { foodId: id } });

  if (usedCount === 0) {
    await prisma.food.delete({ where: { id } });
    return res.json({ ok: true, mode: 'deleted', usedCount: 0 });
  }

  // RecordItem.foodId 是必填外键，硬删会破坏历史记录，这里只标记为不可用
  await prisma.food.update({ where: { id }, data: { isActive: false } });
  res.json({ ok: true, mode: 'archived', usedCount });
}));

module.exports = router;