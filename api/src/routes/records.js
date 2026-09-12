// api/src/routes/records.js
const express = require('express');
const { prisma } = require('../db');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

const RECORD_INCLUDE = {
  items: { include: { food: true } },
  event: true,
  weight: true,
  supplement: true,
};

// SupplementDetail.items 存的是 JSON 字符串（SQLite 不支持 Json 类型），
// 读取时统一解析成数组返回给前端
function parseSupplement(record) {
  if (!record || !record.supplement) return record;
  let items = [];
  try {
    items = JSON.parse(record.supplement.items || '[]');
  } catch (e) { /* 脏数据兜底为空数组 */ }
  if (!Array.isArray(items)) items = [];
  return { ...record, supplement: { ...record.supplement, items } };
}

function parseSupplementIn(records) {
  return records.map(parseSupplement);
}

// 食材被「删除」时是软删（isActive=false），但历史记录的 RecordItem 仍指向它。
// 返回时过滤掉这些项，避免食材库已看不到、记录里却还显示（幽灵食材）。
// 只在读取口过滤，数据库里的关联保留，不能真的断掉历史记录。
function stripInactiveFoods(record) {
  if (!record || !Array.isArray(record.items)) return record;
  const items = record.items.filter((it) => it.food && it.food.isActive);
  return items.length === record.items.length ? record : { ...record, items };
}

// 批量版本：records 为空数组时原样返回，避免无谓的新数组
function stripInactiveFoodsIn(records) {
  return records.map(stripInactiveFoods);
}

const KINDS = ['FOOD', 'EVENT', 'WEIGHT', 'SUPPLEMENT'];

/** 补剂条目归一化：[{name, dose}] → JSON 字符串；name 空的丢弃 */
function normalizeSuppItems(items) {
  if (!Array.isArray(items)) return null;
  const list = items
    .map((it) => ({ name: String(it?.name || '').trim(), dose: String(it?.dose || '').trim() }))
    .filter((it) => it.name);
  if (list.length === 0) return null;
  return JSON.stringify(list);
}

/** 体重/身高至少要有一项有值 */
function hasMeasure(m) {
  if (!m) return false;
  return isNum(m.weight) || isNum(m.height);
}

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

/** 归一化：非法值一律存 null，避免存进 0 / NaN / 字符串 */
function normalizeMeasure(m = {}) {
  return {
    weight: isNum(m.weight) ? m.weight : null,
    height: isNum(m.height) ? m.height : null,
  };
}

function buildWhere(query) {
  const { from, to, kind } = query;
  const where = {};
  if (kind) {
    // 支持逗号分隔的多选，如 ?kind=FOOD,EVENT
    const kinds = String(kind).split(',').filter((k) => KINDS.includes(k));
    if (kinds.length === 1) where.kind = kinds[0];
    else if (kinds.length > 1) where.kind = { in: kinds };
  }
  if (from || to) {
    where.recordedAt = {};
    if (from) where.recordedAt.gte = new Date(from);
    if (to) where.recordedAt.lte = new Date(to);
  }
  return where;
}

// 列表（支持时间范围 + kind 过滤 + 分页）
router.get('/', asyncHandler(async (req, res) => {
  const { from, to, kind, limit = 50, offset = 0 } = req.query;
  const where = buildWhere({ from, to, kind });

  const [records, total] = await Promise.all([
    prisma.record.findMany({
      where,
      include: RECORD_INCLUDE,
      orderBy: { recordedAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    }),
    prisma.record.count({ where }),
  ]);
  res.json({ records: parseSupplementIn(stripInactiveFoodsIn(records)), total });
}));

// 详情
router.get('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const record = await prisma.record.findUnique({
    where: { id },
    include: RECORD_INCLUDE,
  });
  if (!record) return res.status(404).json({ error: '记录不存在' });
  res.json(parseSupplement(stripInactiveFoods(record)));
}));

// 创建：支持 FOOD / EVENT / WEIGHT / SUPPLEMENT 四种 kind
router.post('/', asyncHandler(async (req, res) => {
  const {
    kind = 'FOOD',
    recordedAt,
    mealType,
    appetite,
    reaction,
    reactionNote,
    note,
    items,
    event,
    weight,
    supplement,
  } = req.body;

  if (kind === 'WEIGHT') {
    if (!hasMeasure(weight)) {
      return res.status(400).json({ error: '体重模式下至少填写体重或身高' });
    }
  } else if (kind === 'EVENT') {
    if (!event || !event.title || !event.category) {
      return res.status(400).json({ error: '事件模式下 title / category 必填' });
    }
  } else if (kind === 'SUPPLEMENT') {
    if (!normalizeSuppItems(supplement?.items)) {
      return res.status(400).json({ error: '补剂模式下至少填写一种补剂名称' });
    }
  } else {
    if (!mealType || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: '食物模式下 mealType / items 必填' });
    }
  }

  const data = {
    kind,
    recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
    mealType: mealType || '',
    appetite: appetite || '',
    reaction: reaction || '',
    reactionNote: reactionNote || null,
    note: note || null,
  };

  if (kind === 'WEIGHT') {
    data.weight = { create: normalizeMeasure(weight) };
  } else if (kind === 'EVENT') {
    data.event = {
      create: {
        title: event.title,
        category: event.category,
        description: event.description || null,
      },
    };
  } else if (kind === 'SUPPLEMENT') {
    data.supplement = {
      create: { items: normalizeSuppItems(supplement.items) },
    };
  } else {
    data.items = {
      create: items.map((it) => ({
        foodId: it.foodId,
        amount: typeof it.amount === 'number' ? it.amount : null,
      })),
    };
  }

  const created = await prisma.record.create({
    data,
    include: RECORD_INCLUDE,
  });
  res.status(201).json(parseSupplement(stripInactiveFoods(created)));
}));

// 更新：FOOD 模式删 items 重建；EVENT 模式 upsert event；WEIGHT 模式 upsert weight
router.put('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const {
    kind,
    recordedAt,
    mealType,
    appetite,
    reaction,
    reactionNote,
    note,
    items,
    event,
    weight,
    supplement,
  } = req.body;

  const existing = await prisma.record.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: '记录不存在' });

  const finalKind = kind || existing.kind;

  if (finalKind === 'WEIGHT' && weight !== undefined && !hasMeasure(weight)) {
    return res.status(400).json({ error: '体重模式下至少填写体重或身高' });
  }
  if (finalKind === 'SUPPLEMENT' && supplement !== undefined && !normalizeSuppItems(supplement?.items)) {
    return res.status(400).json({ error: '补剂模式下至少填写一种补剂名称' });
  }

  await prisma.$transaction(async (tx) => {
    const updateData = {};
    if (recordedAt) updateData.recordedAt = new Date(recordedAt);
    if (mealType !== undefined) updateData.mealType = mealType;
    if (appetite !== undefined) updateData.appetite = appetite;
    if (reaction !== undefined) updateData.reaction = reaction;
    if (reactionNote !== undefined) updateData.reactionNote = reactionNote;
    if (note !== undefined) updateData.note = note;

    // 食物项：删后重建（仅 FOOD 模式）
    if (finalKind === 'FOOD' && Array.isArray(items)) {
      await tx.recordItem.deleteMany({ where: { recordId: id } });
      updateData.items = {
        create: items.map((it) => ({
          foodId: it.foodId,
          amount: typeof it.amount === 'number' ? it.amount : null,
        })),
      };
    }

    await tx.record.update({ where: { id }, data: updateData });

    // 事件详情：EVENT 模式下 upsert
    if (finalKind === 'EVENT' && event && event.title) {
      await tx.eventDetail.upsert({
        where: { recordId: id },
        update: {
          title: event.title,
          category: event.category || '',
          description: event.description || null,
        },
        create: {
          recordId: id,
          title: event.title,
          category: event.category || '',
          description: event.description || null,
        },
      });
    }

    // 体重详情：WEIGHT 模式下 upsert
    if (finalKind === 'WEIGHT' && weight !== undefined) {
      const data = normalizeMeasure(weight);
      await tx.weightDetail.upsert({
        where: { recordId: id },
        update: data,
        create: { recordId: id, ...data },
      });
    }

    // 补剂详情：SUPPLEMENT 模式下 upsert（items 整体覆盖）
    if (finalKind === 'SUPPLEMENT' && supplement !== undefined) {
      const itemsJson = normalizeSuppItems(supplement.items);
      if (itemsJson) {
        await tx.supplementDetail.upsert({
          where: { recordId: id },
          update: { items: itemsJson },
          create: { recordId: id, items: itemsJson },
        });
      }
    }
  });

  const record = await prisma.record.findUnique({
    where: { id },
    include: RECORD_INCLUDE,
  });
  res.json(parseSupplement(stripInactiveFoods(record)));
}));

// 删除
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await prisma.record.delete({ where: { id } });
  res.json({ ok: true });
}));

module.exports = router;
