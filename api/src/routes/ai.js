// api/src/routes/ai.js
// 通用 OpenAI 兼容 Chat Completions 转发。
// 通过环境变量配置 base url / api key / model，可对接：
//   - OpenAI 官方（AI_BASE_URL=https://api.openai.com/v1）
//   - DeepSeek（AI_BASE_URL=https://api.deepseek.com/v1, AI_MODEL=deepseek-chat）
//   - 通义千问 DashScope 兼容模式（AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1）
//   - 月之暗面 / 智谱 GLM / 任何兼容厂商

const express = require('express');
const { asyncHandler } = require('../middleware/error');
const { babyInfo } = require('../baby');

const router = express.Router();

const SYSTEM_PROMPT = `你是一位温柔的宝宝辅食助手，负责帮家长梳理宝宝吃了什么、吃得怎么样、有没有异常、生长情况如何，以及接下来该怎么搭配。
- 用简洁、口语化的中文回答，2-4 段，避免长篇大论
- 优先基于【辅食记录】【事件记录】【体重记录】的事实回答，不要编造
- 记录分三类：辅食记录（吃了什么 / 量 / 食欲 / 过敏）、事件记录（症状 / 吃药 / 疫苗 / 情绪等）、体重记录（体重 / 身高）。回答时三类都要看，尤其是宝宝出现症状、情绪异常时，要结合同期吃了什么一起分析；家长问生长是否正常、吃够没有时，参考体重 / 身高的变化趋势
- 如果家长问过敏、营养、搭配建议，给出安全方向 + 提醒「具体请咨询儿科医生」
- 不要主动复述整段记录，挑重点说
- 末尾可加 1 个温和的小建议`;

function fmtTime(iso) {
  const t = new Date(iso);
  const M = String(t.getMonth() + 1).padStart(2, '0');
  const D = String(t.getDate()).padStart(2, '0');
  const h = String(t.getHours()).padStart(2, '0');
  const m = String(t.getMinutes()).padStart(2, '0');
  return `${M}-${D} ${h}:${m}`;
}

// 辅食记录一行：时间 餐次（食欲）: 食材 · 过敏 · 备注
function foodLine(r) {
  const items = (r.items || [])
    .map((it) => `${it.food?.name || '?'}${it.amount ? ` ${it.amount}g` : ''}`)
    .join('、');
  const extra = [];
  if (r.appetite && r.appetite !== '好') extra.push(`食欲${r.appetite}`);
  if (r.reaction && r.reaction !== '无') {
    extra.push(`过敏：${r.reaction}${r.reactionNote ? `（${r.reactionNote}）` : ''}`);
  }
  if (r.note) extra.push(`备注：${r.note}`);
  const head = extra.length > 0 ? `${r.mealType || '用餐'} · ${extra.join(' · ')}` : (r.mealType || '用餐');
  return `- ${fmtTime(r.recordedAt)} ${head}: ${items || '（未记录食材）'}`;
}

// 事件记录一行：时间 【类别】描述
function eventLine(r) {
  const ev = r.event || {};
  const desc = ev.description ? `：${ev.description}` : '';
  return `- ${fmtTime(r.recordedAt)} 【${ev.category || '其他'}】${desc || '（无描述）'}`;
}

// 体重记录一行：时间 体重 8.6kg · 身高 72cm · 备注
function weightLine(r) {
  const w = r.weight || {};
  const parts = [];
  if (w.weight != null) parts.push(`体重 ${w.weight}kg`);
  if (w.height != null) parts.push(`身高 ${w.height}cm`);
  const extra = r.note ? ` · 备注：${r.note}` : '';
  return `- ${fmtTime(r.recordedAt)} ${parts.join(' · ') || '（未填写）'}${extra}`;
}

function recordLine(r) {
  if (r.kind === 'EVENT') return eventLine(r);
  if (r.kind === 'WEIGHT') return weightLine(r);
  return foodLine(r);
}

// 把记录按「辅食 / 事件 / 体重」三类渲染，三类都带上
function renderByKind(list, rangeLabel) {
  const foods = list.filter((r) => r.kind !== 'EVENT' && r.kind !== 'WEIGHT');
  const events = list.filter((r) => r.kind === 'EVENT');
  const weights = list.filter((r) => r.kind === 'WEIGHT');
  const lines = [];

  if (foods.length > 0) {
    lines.push(`【${rangeLabel}辅食记录】（共 ${foods.length} 条）`);
    foods.forEach((r) => lines.push(foodLine(r)));
  } else {
    lines.push(`【${rangeLabel}辅食记录】该范围内还没有记录。`);
  }

  if (events.length > 0) {
    lines.push('');
    lines.push(`【${rangeLabel}事件记录】（共 ${events.length} 条）`);
    events.forEach((r) => lines.push(eventLine(r)));
  }

  if (weights.length > 0) {
    lines.push('');
    lines.push(`【${rangeLabel}体重记录】（共 ${weights.length} 条）`);
    weights.forEach((r) => lines.push(weightLine(r)));
  }

  return lines;
}

function buildContextBlock(context) {
  if (!context) return '';
  const lines = [];

  // 主上下文：{ records } 是「当前选定时段」，{ todayRecords } 是旧字段
  const rangeLabel = context.rangeLabel || '今日';
  const main = Array.isArray(context.records)
    ? context.records
    : (Array.isArray(context.todayRecords) ? context.todayRecords : []);
  const attached = Array.isArray(context.attachedRecords) ? context.attachedRecords : [];

  if (main.length > 0) {
    lines.push(...renderByKind(main, rangeLabel));
  } else {
    lines.push(`【${rangeLabel}辅食记录】该范围内还没有记录。`);
  }

  if (attached.length > 0) {
    lines.push('\n【家长指定的记录（重点参考）】');
    [...attached]
      .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt))
      .forEach((r) => lines.push(recordLine(r)));
  }

  if (context.summary) {
    lines.push(`\n【累计摘要】${context.summary}`);
  }
  return lines.join('\n');
}

router.post('/chat', asyncHandler(async (req, res) => {
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.AI_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    return res.status(503).json({
      error: 'AI_API_KEY 未配置',
      hint: '本机开发填 api/.env 的 AI_API_KEY；NAS 部署在 docker-compose.yml 同目录建 .env 填 AI_API_KEY，再重新部署。详见 DEPLOY.md「配置 AI 问答（DeepSeek）」',
    });
  }

  const { messages = [], context } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages 必填且至少一条' });
  }

  // 宝宝出生时间与当前月龄（环境变量 BABY_BIRTH，未配置则不带这段）
  const baby = babyInfo();
  const systemMessages = [
    {
      role: 'system',
      content: baby
        ? `${SYSTEM_PROMPT}\n\n【宝宝信息】${baby.nickname ? `小名：${baby.nickname}。` : ''}出生日期：${baby.birth}（今天 ${baby.ageText}）。评估食量、发育、喂养建议时都要结合月龄判断${baby.nickname ? '，称呼宝宝时用小名' : ''}。`
        : SYSTEM_PROMPT,
    },
  ];
  const ctx = buildContextBlock(context);
  if (ctx) systemMessages.push({ role: 'system', content: ctx });

  const payload = {
    model,
    messages: [...systemMessages, ...messages],
    temperature: 0.6,
    max_tokens: 600,
  };

  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  let upstream;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return res.status(502).json({
      error: '调用 AI 上游失败',
      detail: err.message,
      hint: '检查 AI_BASE_URL 是否可访问',
    });
  }

  const text = await upstream.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    return res.status(upstream.status).json({
      error: 'AI 上游返回非 JSON',
      detail: text.slice(0, 500),
      status: upstream.status,
    });
  }

  if (!upstream.ok) {
    return res.status(upstream.status).json({
      error: data?.error?.message || `AI 上游返回 ${upstream.status}`,
      status: upstream.status,
      hint: data?.error?.type || null,
    });
  }

  const reply = data?.choices?.[0]?.message?.content || '';
  res.json({ reply, model: data?.model || model, usage: data?.usage || null });
}));

module.exports = router;
// 便于本地验证上下文渲染
module.exports.buildContextBlock = buildContextBlock;
