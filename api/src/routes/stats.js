// api/src/routes/stats.js
const express = require('express');
const { prisma } = require('../db');
const { asyncHandler } = require('../middleware/error');
const dayjs = require('dayjs');

const router = express.Router();

function startOfWeek(d = new Date()) {
  // 周一作为一周开始
  const day = d.getDay() || 7;
  return dayjs(d).subtract(day - 1, 'day').startOf('day').toDate();
}

/**
 * 解析周期参数。
 * - 传了 from/to：按区间过滤（to 补到当天 23:59:59.999）
 * - 没传：回退到 fallbackFrom（保持旧行为，向后兼容）
 */
function resolveRange(query, fallbackFrom) {
  const { from, to } = query;
  if (!from && !to) {
    // fallbackFrom 显式传 null 表示「不限起点」，此时也不该限制终点
    if (fallbackFrom === null) return { from: null, to: null };
    return { from: fallbackFrom, to: dayjs().endOf('day').toDate() };
  }
  const range = {};
  if (from) {
    const d = dayjs(from);
    if (d.isValid()) range.from = d.startOf('day').toDate();
  }
  if (to) {
    const d = dayjs(to);
    if (d.isValid()) range.to = d.endOf('day').toDate();
  }
  return range;
}

/** 把 {key:count} 转成按次数倒序的数组 */
function toSorted(counter) {
  return Object.entries(counter)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

/** 统计一组记录里的食材出现次数 */
function countFoods(records) {
  const counter = {};
  records.forEach((r) => {
    r.items.forEach((it) => {
      const key = it.food.name;
      counter[key] = (counter[key] || 0) + 1;
    });
  });
  return toSorted(counter);
}

/** 奶的判定：食材名含「奶」字且单位是 ml（如 奶/牛奶/配方奶/母乳），与一般辅食区分 */
function isMilkFood(food) {
  return food?.unit === 'ml' && String(food?.name || '').includes('奶');
}

// 食材统计（默认本周）
router.get('/weekly', asyncHandler(async (req, res) => {
  const { from, to } = resolveRange(req.query, startOfWeek());

  const records = await prisma.record.findMany({
    where: { kind: 'FOOD', recordedAt: { gte: from, lte: to } },
    include: { items: { include: { food: true } } },
  });

  // 奶单独统计：整条记录全是「奶类食材」才算吃奶，混合记录归辅食
  const foodCounter = {};
  const milkCounter = {};
  const milkMl = {};
  const milkDaily = {};
  let milkRecordCount = 0;
  records.forEach((r) => {
    const items = r.items || [];
    const milkItems = items.filter((it) => isMilkFood(it.food));
    if (items.length > 0 && milkItems.length === items.length) {
      milkRecordCount += 1;
      const day = dayjs(r.recordedAt).format('YYYY-MM-DD');
      milkItems.forEach((it) => {
        milkCounter[it.food.name] = (milkCounter[it.food.name] || 0) + 1;
        if (it.amount) {
          milkMl[it.food.name] = (milkMl[it.food.name] || 0) + it.amount;
          milkDaily[day] = (milkDaily[day] || 0) + it.amount;
        }
      });
    } else {
      items.forEach((it) => {
        foodCounter[it.food.name] = (foodCounter[it.food.name] || 0) + 1;
      });
    }
  });

  const round1 = (n) => Math.round(n * 10) / 10;
  const milkByName = Object.entries(milkCounter)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count, totalMl: round1(milkMl[name] || 0) }));
  const totalMl = round1(Object.values(milkMl).reduce((s, v) => s + v, 0));

  res.json({
    from, to,
    totalRecords: records.length - milkRecordCount, // 辅食记录数（不含吃奶）
    uniqueFoods: Object.keys(foodCounter).length,
    topFoods: toSorted(foodCounter).slice(0, 10),
    allFoods: toSorted(foodCounter),
    milk: {
      count: milkRecordCount,
      totalMl,
      byName: milkByName,
      // 每日奶量折线点位（时间正序，只含有记录的日期）
      daily: Object.entries(milkDaily)
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([date, ml]) => ({ date, ml: round1(ml) })),
    },
  });
}));

// 事件统计（默认本周）
router.get('/events', asyncHandler(async (req, res) => {
  const { from, to } = resolveRange(req.query, startOfWeek());

  const where = { kind: 'EVENT' };
  if (from || to) {
    where.recordedAt = {};
    if (from) where.recordedAt.gte = from;
    if (to) where.recordedAt.lte = to;
  }

  const records = await prisma.record.findMany({
    where,
    include: { event: true },
    orderBy: { recordedAt: 'desc' },
  });

  const byCategory = {};
  const byTitle = {};
  records.forEach((r) => {
    const cat = r.event?.category || '其他';
    const title = r.event?.title || '(未命名)';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
    byTitle[title] = (byTitle[title] || 0) + 1;
  });

  res.json({
    from, to,
    totalEvents: records.length,
    categories: byCategory,
    byCategory: toSorted(byCategory),
    byTitle: toSorted(byTitle).slice(0, 10),
  });
}));

// 补剂统计（默认本周）：按补剂名称计数
router.get('/supplements', asyncHandler(async (req, res) => {
  const { from, to } = resolveRange(req.query, startOfWeek());

  const where = { kind: 'SUPPLEMENT' };
  if (from || to) {
    where.recordedAt = {};
    if (from) where.recordedAt.gte = from;
    if (to) where.recordedAt.lte = to;
  }

  const records = await prisma.record.findMany({
    where,
    include: { supplement: true },
    orderBy: { recordedAt: 'desc' },
  });

  const byName = {};
  let totalItems = 0;
  records.forEach((r) => {
    let items = [];
    try {
      items = JSON.parse(r.supplement?.items || '[]');
    } catch (e) { /* 脏数据兜底 */ }
    if (!Array.isArray(items)) items = [];
    items.forEach((it) => {
      const name = String(it?.name || '').trim();
      if (!name) return;
      byName[name] = (byName[name] || 0) + 1;
      totalItems += 1;
    });
  });

  res.json({
    from, to,
    totalRecords: records.length,
    totalItems,
    byName: toSorted(byName),
  });
}));

// 体重/身高趋势（默认全部历史，因为生长数据点稀疏，本周可能一条都没有）
router.get('/weight', asyncHandler(async (req, res) => {
  const { from, to } = resolveRange(req.query, null);

  const where = { kind: 'WEIGHT' };
  if (from || to) {
    where.recordedAt = {};
    if (from) where.recordedAt.gte = from;
    if (to) where.recordedAt.lte = to;
  }

  const records = await prisma.record.findMany({
    where,
    include: { weight: true },
    orderBy: { recordedAt: 'asc' },
  });

  // 点位：按时间正序，只保留有值的字段
  const points = records
    .filter((r) => r.weight && (r.weight.weight != null || r.weight.height != null))
    .map((r) => ({
      id: r.id,
      date: r.recordedAt,
      weight: r.weight.weight,
      height: r.weight.height,
      note: r.note || null,
    }));

  const withWeight = points.filter((p) => p.weight != null);
  const withHeight = points.filter((p) => p.height != null);

  // 区间内变化：首末两条之差（至少 2 个点才算）
  function delta(list, key) {
    if (list.length < 2) return null;
    return Number((list[list.length - 1][key] - list[0][key]).toFixed(2));
  }

  res.json({
    from, to,
    points,
    latest: points.length ? points[points.length - 1] : null,
    first: points.length ? points[0] : null,
    weightDelta: delta(withWeight, 'weight'),
    heightDelta: delta(withHeight, 'height'),
  });
}));

// 过敏记录（可选 from/to）
router.get('/reactions', asyncHandler(async (req, res) => {
  const { from, to } = resolveRange(req.query, null);
  const where = { kind: 'FOOD', reaction: { in: ['轻微', '明显', '严重'] } };
  if (from || to) {
    where.recordedAt = {};
    if (from) where.recordedAt.gte = from;
    if (to) where.recordedAt.lte = to;
  }

  const records = await prisma.record.findMany({
    where,
    include: { items: { include: { food: true } } },
    orderBy: { recordedAt: 'desc' },
  });
  res.json(records);
}));

// 各分类占比（可选 from/to，默认最近 30 天）
router.get('/categories', asyncHandler(async (req, res) => {
  const fallbackFrom = dayjs().subtract(30, 'day').startOf('day').toDate();
  const { from, to } = resolveRange(req.query, fallbackFrom);

  const where = { kind: 'FOOD', recordedAt: { gte: from } };
  if (to) where.recordedAt.lte = to;

  const records = await prisma.record.findMany({
    where,
    include: { items: { include: { food: true } } },
  });

  const counter = {};
  records.forEach((r) => {
    r.items.forEach((it) => {
      // 奶不算辅食分类占比（时间线/统计中单独列示）
      if (isMilkFood(it.food)) return;
      const cat = it.food.category || '其他';
      counter[cat] = (counter[cat] || 0) + 1;
    });
  });

  res.json(counter);
}));

module.exports = router;
