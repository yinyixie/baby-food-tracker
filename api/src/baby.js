// api/src/baby.js
// 宝宝出生时间与月龄计算。出生日期来自环境变量 BABY_BIRTH（YYYY-MM-DD 或完整日期时间），
// 小名来自 BABY_NICKNAME（可选，未配置时前端回退显示「宝宝」），
// 后端不读 dotenv：本机由 Makefile 从 api/.env 注入，Docker 由 compose environment 注入。
const dayjs = require('dayjs');

/** 读取出生时间，未配置或格式非法返回 null */
function babyBirth() {
  const raw = String(process.env.BABY_BIRTH || '').trim();
  if (!raw) return null;
  const d = dayjs(raw);
  return d.isValid() ? d : null;
}

/**
 * 计算月龄文本（满月后一律精确到天）：
 *   < 1 个月   → 「XX天」
 *   ≥ 1 个月   → 「X个月Y天」/「X岁Y天」/「X岁Y个月Z天」（无月时省略「个月」段）
 */
function ageText(birth, now = dayjs()) {
  const b = dayjs(birth);
  let years = now.year() - b.year();
  let months = now.month() - b.month();
  let days = now.date() - b.date();

  if (days < 0) {
    // 借上个月的天数：取「now 所在月的上个月」的总天数
    months -= 1;
    days += now.subtract(1, 'month').daysInMonth();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalDays = now.diff(b, 'day');
  if (years <= 0 && months <= 0) return `${Math.max(totalDays, 0)}天`;

  const parts = [];
  if (years > 0) parts.push(`${years}岁`);
  if (months > 0) parts.push(`${months}个月`);
  parts.push(`${days}天`);
  return parts.join('');
}

/** 读取小名，未配置返回 null */
function babyNickname() {
  const raw = String(process.env.BABY_NICKNAME || '').trim();
  return raw || null;
}

/** 汇总信息；未配置出生时间返回 null（小名可选，nickname 为 null 时前端回退「宝宝」） */
function babyInfo(now = dayjs()) {
  const birth = babyBirth();
  if (!birth) return null;
  return {
    birth: birth.format('YYYY-MM-DD'),
    nickname: babyNickname(),
    ageText: ageText(birth, now),
    ageDays: now.diff(birth, 'day'),
  };
}

module.exports = { babyBirth, babyNickname, ageText, babyInfo };
