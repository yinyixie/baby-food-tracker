<template>
  <div class="timeline">
    <!-- 周期选择（与统计页同款） -->
    <div class="filter-row">
      <div class="kind-row">
        <span
          v-for="opt in rangeOptions"
          :key="opt.value"
          class="kind-chip"
          :class="{ active: range === opt.value }"
          @click="pickRange(opt.value)"
        >{{ opt.text }}</span>
      </div>
      <div v-if="range === 'custom'" class="custom-range">
        <div class="date-btn" @click="openCalendar('from')">{{ fromDate || '开始日期' }}</div>
        <span class="date-sep">至</span>
        <div class="date-btn" @click="openCalendar('to')">{{ toDate || '结束日期' }}</div>
        <van-button size="mini" type="primary" :disabled="!rangeReady" @click="load">确定</van-button>
      </div>
      <!-- 快捷周期：同款日期框样式，但只读 -->
      <div v-else class="custom-range readonly">
        <template v-if="range === 'all'">
          <div class="date-btn date-all">全部记录</div>
        </template>
        <template v-else>
          <div class="date-btn">{{ quickFrom }}</div>
          <span class="date-sep">至</span>
          <div class="date-btn">{{ quickTo }}</div>
        </template>
      </div>

      <!-- 宝宝月龄（出生时间来自环境变量 BABY_BIRTH） -->
      <div v-if="babyInfo?.ageText" class="baby-age">🍼 {{ babyInfo.nickname || '宝宝' }} {{ babyInfo.ageText }}</div>
    </div>

    <!-- 自定义日期选择 -->
    <van-calendar
      v-model:show="calendarVisible"
      :min-date="minDate"
      :max-date="maxDate"
      @confirm="onCalendarConfirm"
    />

    <div v-if="records.loading && records.list.length === 0" class="empty-state">
      加载中…
    </div>

    <div v-else-if="records.list.length === 0" class="empty-state">
      <p>暂无记录</p>
      <van-button type="primary" size="small" @click="$router.push('/')">
        去添加
      </van-button>
    </div>

    <div v-else class="timeline-list">
      <div v-for="group in groupedByDate" :key="group.date">
        <div class="date-header">
          <span class="date">{{ group.dateLabel }}</span>
          <span class="weekday">{{ group.relative }}</span>
        </div>

        <!-- 美柚风格：每天一张卡片，顶部当日汇总 + 紧凑记录行 -->
        <div class="day-card">
          <div v-if="group.summary.length" class="day-summary">
            <span v-for="(s, i) in group.summary" :key="i" class="sum-item">
              <span class="sum-emoji">{{ s.emoji }}</span>
              <span class="sum-label">{{ s.label }}</span>
              <strong class="sum-count">{{ s.count }}</strong>
              <span v-if="s.extra" class="sum-extra">{{ s.extra }}</span>
            </span>
          </div>

          <div
            class="rec-row"
            v-for="r in group.records"
            :key="r.id"
            @click="openView(r)"
          >
            <span class="row-time">{{ formatTime(r.recordedAt) }}</span>
            <span class="row-icon">{{ rowIcon(r) }}</span>
            <span class="row-label">{{ rowLabel(r) }}</span>
            <span class="row-detail" :class="{ warn: hasReaction(r) }">{{ rowDetail(r) }}</span>
          </div>
        </div>
      </div>

      <div v-if="hasMore" class="load-more">
        <van-button
          plain
          round
          size="small"
          :loading="loadingMore"
          loading-text="加载中…"
          @click="loadMore"
        >加载更多</van-button>
      </div>
    </div>

    <!-- 记录查看 popup（点击卡片弹出，只读详情） -->
    <van-popup
      v-model:show="viewPopupVisible"
      position="bottom"
      round
      closeable
      :style="{ maxHeight: '85vh' }"
      teleport="body"
    >
      <div v-if="viewingRecord" class="view-popup">
        <div class="view-title">{{ viewTitle }}</div>

        <!-- 食物 -->
        <template v-if="viewingRecord.kind !== 'EVENT' && viewingRecord.kind !== 'WEIGHT' && viewingRecord.kind !== 'SUPPLEMENT'">
          <div class="section-title">餐次</div>
          <div class="card-block">
            <div class="view-readonly">
              <van-tag plain :type="mealTag(viewingRecord.mealType)" size="medium">
                {{ viewingRecord.mealType }}
              </van-tag>
              <span style="margin-left: 10px; color: var(--bf-text-secondary); font-size: 14px;">
                食欲 {{ viewingRecord.appetite || '好' }}
              </span>
            </div>
          </div>

          <div class="section-title">用餐时间</div>
          <div class="card-block">
            <div class="view-readonly">{{ formatFullTime(viewingRecord.recordedAt) }}</div>
          </div>

          <div class="section-title">吃了什么</div>
          <div class="card-block">
            <div class="foods view-foods">
              <span v-for="it in viewingRecord.items" :key="it.id" class="food-pill">
                {{ it.food.emoji }} {{ it.food.name }}
                <span class="amount">{{ formatAmount(it) }}</span>
              </span>
            </div>
          </div>

          <template v-if="viewingRecord.reaction && viewingRecord.reaction !== '无'">
            <div class="section-title">过敏反应</div>
            <div class="card-block">
              <div class="view-desc">
                ⚠️ {{ viewingRecord.reaction }}{{ viewingRecord.reactionNote ? `（${viewingRecord.reactionNote}）` : '' }}
              </div>
            </div>
          </template>

          <template v-if="viewingRecord.note">
            <div class="section-title">备注</div>
            <div class="card-block">
              <div class="view-desc">{{ viewingRecord.note }}</div>
            </div>
          </template>
        </template>

        <!-- 事件 -->
        <template v-else-if="viewingRecord.kind === 'EVENT'">
          <div class="section-title">类别</div>
          <div class="card-block">
            <div class="view-readonly">
              <van-tag plain :type="eventStyle(viewingRecord.event?.category)" size="medium">
                {{ viewingRecord.event?.category || '未分类' }}
              </van-tag>
            </div>
          </div>

          <div class="section-title">发生时间</div>
          <div class="card-block">
            <div class="view-readonly">{{ formatFullTime(viewingRecord.recordedAt) }}</div>
          </div>

          <template v-if="viewingRecord.event?.description">
            <div class="section-title">详细描述</div>
            <div class="card-block">
              <div class="view-desc">{{ viewingRecord.event.description }}</div>
            </div>
          </template>
        </template>

        <!-- 体重 -->
        <template v-else-if="viewingRecord.kind === 'WEIGHT'">
          <div class="section-title">称重时间</div>
          <div class="card-block">
            <div class="view-readonly">{{ formatFullTime(viewingRecord.recordedAt) }}</div>
          </div>

          <div class="section-title">体重 / 身高</div>
          <div class="card-block">
            <div class="view-readonly">
              <span v-if="viewingRecord.weight?.weight != null">
                体重 <strong>{{ viewingRecord.weight.weight }}</strong> kg
              </span>
              <span v-if="viewingRecord.weight?.height != null" :style="{ marginLeft: '16px' }">
                身高 <strong>{{ viewingRecord.weight.height }}</strong> cm
              </span>
            </div>
          </div>

          <template v-if="viewingRecord.note">
            <div class="section-title">备注</div>
            <div class="card-block">
              <div class="view-desc">{{ viewingRecord.note }}</div>
            </div>
          </template>
        </template>

        <!-- 补剂 -->
        <template v-else>
          <div class="section-title">服用时间</div>
          <div class="card-block">
            <div class="view-readonly">{{ formatFullTime(viewingRecord.recordedAt) }}</div>
          </div>

          <div class="section-title">营养补剂</div>
          <div class="card-block">
            <div class="view-supp-list">
              <div v-for="(it, i) in viewingRecord.supplement?.items || []" :key="i" class="view-supp-row">
                <span class="view-supp-name">💊 {{ it.name }}</span>
                <span v-if="it.dose" class="view-supp-dose">{{ it.dose }}</span>
              </div>
            </div>
          </div>

          <template v-if="viewingRecord.note">
            <div class="section-title">备注</div>
            <div class="card-block">
              <div class="view-desc">{{ viewingRecord.note }}</div>
            </div>
          </template>
        </template>

        <div class="view-footer">
          <van-button plain round type="danger" @click="onDelete(viewingRecord)">删除</van-button>
          <van-button plain round @click="viewPopupVisible = false">关闭</van-button>
          <van-button type="primary" round @click="openEdit(viewingRecord)">编辑</van-button>
        </div>
      </div>
    </van-popup>

    <!-- 编辑 popup（复用 QuickRecord 组件，跟查看同款底部弹出） -->
    <van-popup
      v-model:show="editPopupVisible"
      position="bottom"
      :style="{ height: '92vh', maxHeight: '92vh' }"
      teleport="body"
    >
      <QuickRecord
        v-if="editPopupVisible && editingRecord"
        embedded
        :edit-id="editingRecord.id"
        :initial-kind="editingRecord.kind"
        @done="onEditDone"
        @cancel="onEditCancel"
      />
    </van-popup>
  </div>
</template>

<script setup>
import QuickRecord from './QuickRecord.vue';
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showConfirmDialog, showToast } from 'vant';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { useRecordsStore } from '../stores/records';
import { babyInfo, loadBaby } from '../baby';

dayjs.locale('zh-cn');

loadBaby();

const records = useRecordsStore();
const router = useRouter();

// 事件查看 popup：点击事件卡片打开，只读展示完整字段
const viewPopupVisible = ref(false);
const viewingRecord = ref(null);

function openView(r) {
  viewingRecord.value = r;
  viewPopupVisible.value = true;
}

/* ============ 周期筛选（与统计页同款） ============ */

const rangeOptions = [
  { text: '本周', value: 'week' },
  { text: '近 7 天', value: '7d' },
  { text: '近 30 天', value: '30d' },
  { text: '全部', value: 'all' },
  { text: '自定义', value: 'custom' },
];

const range = ref('week');

// 自定义区间
const fromDate = ref('');
const toDate = ref('');
const calendarVisible = ref(false);
const calendarTarget = ref('from');
const minDate = dayjs().subtract(2, 'year').toDate();
const maxDate = dayjs().toDate();

const rangeReady = computed(() => !!fromDate.value && !!toDate.value);

/** 本周一 00:00（dayjs 不带 isoWeek 插件，手算） */
function startOfWeek(d = dayjs()) {
  const day = d.day() || 7; // 周日 = 0 → 当作 7
  return d.subtract(day - 1, 'day').startOf('day');
}

/** 计算当前周期对应的 [from, to]（dayjs 对象或 null） */
function currentRange() {
  const t = dayjs();
  switch (range.value) {
    case 'week':
      return { from: startOfWeek(t), to: t };
    case '7d':
      return { from: t.subtract(6, 'day'), to: t };
    case '30d':
      return { from: t.subtract(29, 'day'), to: t };
    case 'all':
      return { from: null, to: null };
    case 'custom':
      return { from: fromDate.value || null, to: toDate.value || null };
    default:
      return { from: null, to: null };
  }
}

/** 快捷周期显示用的起止日期（与自定义同款展示） */
const quickFrom = computed(() => {
  const { from } = currentRange();
  return from ? dayjs(from).format('YYYY-MM-DD') : '';
});
const quickTo = computed(() => {
  const { to } = currentRange();
  return to ? dayjs(to).format('YYYY-MM-DD') : '';
});

function pickRange(v) {
  if (v === range.value) return;
  range.value = v;
  if (v === 'custom') {
    if (!fromDate.value) fromDate.value = dayjs().subtract(6, 'day').format('YYYY-MM-DD');
    if (!toDate.value) toDate.value = dayjs().format('YYYY-MM-DD');
  }
  load();
}

function openCalendar(target) {
  calendarTarget.value = target;
  calendarVisible.value = true;
}

function onCalendarConfirm(date) {
  const s = dayjs(date).format('YYYY-MM-DD');
  if (calendarTarget.value === 'from') {
    fromDate.value = s;
    if (toDate.value && s > toDate.value) toDate.value = s;
  } else {
    toDate.value = s;
    if (fromDate.value && s < fromDate.value) fromDate.value = s;
  }
  calendarVisible.value = false;
  load();
}

function mealTag(meal) {
  return { 早餐: 'warning', 午餐: 'success', 晚餐: 'primary', 加餐: 'default' }[meal] || 'default';
}

function eventStyle(cat) {
  return { 症状: 'danger', 吃药: 'primary', 疫苗: 'purple', 情绪: 'success', 其他: 'default' }[cat] || 'default';
}

const viewTitle = computed(() => {
  const k = viewingRecord.value?.kind;
  if (k === 'EVENT') return '事件详情';
  if (k === 'WEIGHT') return '体重详情';
  if (k === 'SUPPLEMENT') return '补剂详情';
  return '记录详情';
});

function formatTime(d) {
  return dayjs(d).format('HH:mm');
}

function formatFullTime(d) {
  return dayjs(d).format('YYYY-MM-DD HH:mm');
}

function formatAmount(it) {
  const v = it.amount;
  if (v == null || v === 0) return '';
  // 优先用食材上设置的单位，老数据/异常数据兜底 g
  return `${v}${it.food?.unit === 'ml' ? 'ml' : 'g'}`;
}

/* ============ 美柚风格行渲染 ============ */

// 奶的判定（与统计后端同规则）：食材名含「奶」字且单位是 ml
function isMilkFood(food) {
  return food?.unit === 'ml' && String(food?.name || '').includes('奶');
}
// 整条记录全是奶类食材 → 算吃奶记录，混合记录归辅食
function isMilkRecord(r) {
  const items = r.items || [];
  return items.length > 0 && items.every((it) => isMilkFood(it.food));
}

// 行首 emoji：体重 ⚖️；事件按分类；补剂 💊；食物用第一个食材的 emoji
function rowIcon(r) {
  if (r.kind === 'WEIGHT') return '⚖️';
  if (r.kind === 'SUPPLEMENT') return '💊';
  if (r.kind === 'EVENT') {
    return { 症状: '🌡️', 吃药: '💊', 疫苗: '💉', 情绪: '😊', 其他: '📝' }[r.event?.category] || '📝';
  }
  return r.items?.[0]?.food?.emoji || '🍽️';
}

// 行中间的类型名：食物显示餐次（吃奶记录显示「奶」），事件显示分类，体重/补剂固定
function rowLabel(r) {
  if (r.kind === 'WEIGHT') return '体重';
  if (r.kind === 'SUPPLEMENT') return '补剂';
  if (r.kind === 'EVENT') return r.event?.title || r.event?.category || '事件';
  if (isMilkRecord(r)) return '奶';
  return r.mealType || '辅食';
}

// 行右侧详情：食物=食材+份量；事件=描述；体重=kg·cm；补剂=名称+用量串
function rowDetail(r) {
  if (r.kind === 'WEIGHT') {
    const w = r.weight || {};
    return [
      w.weight != null ? `${w.weight}kg` : null,
      w.height != null ? `${w.height}cm` : null,
    ].filter(Boolean).join(' · ');
  }
  if (r.kind === 'SUPPLEMENT') {
    return (r.supplement?.items || [])
      .map((it) => `${it.name}${it.dose ? ' ' + it.dose : ''}`)
      .join(' · ');
  }
  if (r.kind === 'EVENT') {
    return r.event?.description || '';
  }
  return (r.items || [])
    .map((it) => `${it.food.name}${formatAmount(it) ? ' ' + formatAmount(it) : ''}`)
    .join(' · ');
}

// 有过敏反应的记录，详情文字标橙提醒
function hasReaction(r) {
  return r.kind !== 'EVENT' && r.kind !== 'WEIGHT' && r.reaction && r.reaction !== '无';
}

// 当日汇总（美柚样式：吃奶5次 330ml | 辅食1次 14g）
function daySummary(records) {
  const out = [];
  const allFoods = records.filter((r) => r.kind !== 'EVENT' && r.kind !== 'WEIGHT' && r.kind !== 'SUPPLEMENT');
  const milks = allFoods.filter((r) => isMilkRecord(r));
  const foods = allFoods.filter((r) => !isMilkRecord(r));
  const events = records.filter((r) => r.kind === 'EVENT');
  const weights = records.filter((r) => r.kind === 'WEIGHT');
  const supps = records.filter((r) => r.kind === 'SUPPLEMENT');

  // 奶单独列示（/ml 计总量）
  if (milks.length > 0) {
    let ml = 0;
    milks.forEach((r) => (r.items || []).forEach((it) => {
      if (it.amount) ml += it.amount;
    }));
    out.push({ emoji: '🍼', label: '奶', count: milks.length, extra: ml > 0 ? `共${Math.round(ml * 10) / 10}ml` : '' });
  }

  if (foods.length > 0) {
    let g = 0;
    let ml = 0;
    foods.forEach((r) => (r.items || []).forEach((it) => {
      if (!it.amount) return;
      if (it.food?.unit === 'ml') ml += it.amount;
      else g += it.amount;
    }));
    const round1 = (n) => Math.round(n * 10) / 10;
    let extra = '';
    if (g > 0 && ml > 0) extra = `共${round1(g)}g·${round1(ml)}ml`;
    else if (g > 0) extra = `共${round1(g)}g`;
    else if (ml > 0) extra = `共${round1(ml)}ml`;
    out.push({ emoji: '🥣', label: '辅食', count: foods.length, extra });
  }
  if (supps.length > 0) {
    // 汇总去重后的补剂种数
    const names = new Set();
    supps.forEach((r) => (r.supplement?.items || []).forEach((it) => it.name && names.add(it.name)));
    out.push({ emoji: '💊', label: '补剂', count: supps.length, extra: names.size > 0 ? `${names.size}种` : '' });
  }
  if (events.length > 0) out.push({ emoji: '📝', label: '事件', count: events.length, extra: '' });
  if (weights.length > 0) out.push({ emoji: '⚖️', label: '体重', count: weights.length, extra: '' });
  return out;
}

// 相对日期：今天 / 昨天 / 星期几
function relativeDay(date) {
  const d = dayjs(date);
  const today = dayjs();
  if (d.isSame(today, 'day')) return '今天';
  if (d.isSame(today.subtract(1, 'day'), 'day')) return '昨天';
  return d.format('dddd');
}

const groupedByDate = computed(() => {
  const map = {};
  records.list.forEach((r) => {
    const date = dayjs(r.recordedAt).format('YYYY-MM-DD');
    if (!map[date]) map[date] = [];
    map[date].push(r);
  });
  return Object.entries(map).map(([date, items]) => {
    const sorted = items.sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
    return {
      date,
      dateLabel: dayjs(date).format('M月D日'),
      weekday: dayjs(date).format('dddd'),
      relative: relativeDay(date),
      summary: daySummary(sorted),
      records: sorted,
    };
  });
});

// 每页条数（不显示分页器，用「加载更多」按钮追加）
const PAGE_SIZE = 15;
const loadingMore = ref(false);

// 是否还有更多：已加载条数 < 后端总数
const hasMore = computed(() => records.list.length < records.total);

// 按当前周期构造查询参数（全部周期也显式传参，避免被后端默认周期劫持）
const ALL_FROM = '2000-01-01T00:00:00.000Z';

function buildParams(offset, limit) {
  const params = { limit, offset };
  const { from, to } = currentRange();
  params.from = from ? dayjs(from).startOf('day').toISOString() : ALL_FROM;
  params.to = to ? dayjs(to).endOf('day').toISOString() : dayjs().endOf('day').toISOString();
  return params;
}

// 重新加载（筛选变化 / 编辑保存后）。
// keepCount=true 时保持已加载的条数，避免编辑后跳回第一页
async function load({ keepCount = false } = {}) {
  const limit = keepCount ? Math.max(PAGE_SIZE, records.list.length) : PAGE_SIZE;
  await records.fetch(buildParams(0, limit));
}

// 加载下一页，追加到列表尾部
async function loadMore() {
  if (loadingMore.value || !hasMore.value) return;
  loadingMore.value = true;
  try {
    await records.fetch(buildParams(records.list.length, PAGE_SIZE), { append: true });
  } finally {
    loadingMore.value = false;
  }
}

async function onDelete(r) {
  try {
    await showConfirmDialog({ title: '删除这条记录？', message: '删除后无法恢复' });
    await records.remove(r.id);
    viewPopupVisible.value = false;
    showToast('已删除');
  } catch (e) { /* 用户取消 */ }
}

// 编辑 popup：从查看 popup「去编辑」或卡片「编辑」按钮触发
const editPopupVisible = ref(false);
const editingRecord = ref(null);

function openEdit(r) {
  // 关掉可能还开着的查看 popup，避免 popup 套 popup
  viewPopupVisible.value = false;
  editingRecord.value = r;
  editPopupVisible.value = true;
}

async function onEditDone() {
  editPopupVisible.value = false;
  editingRecord.value = null;
  // 刷新时间线数据（保持已加载条数，不跳回第一页）
  await load({ keepCount: true });
}

function onEditCancel() {
  editPopupVisible.value = false;
  editingRecord.value = null;
}

onMounted(() => load());
</script>

<style scoped>
/* ============ 周期选择（与统计页同款样式） ============ */
.filter-row {
  padding: 10px 12px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  margin: 12px 12px 8px;
}

.kind-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
}

.kind-chip {
  flex-shrink: 0;
  padding: 6px 14px;
  border-radius: 16px;
  font-size: 14px;
  background: #f5f6f8;
  color: var(--bf-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  -webkit-tap-highlight-color: transparent;
}

.kind-chip.active {
  background: var(--bf-primary);
  color: white;
}

/* 宝宝月龄徽标（居中） */
.baby-age {
  margin-top: 10px;
  text-align: center;
  font-size: 13px;
  color: var(--bf-text-secondary);
}

.custom-range {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}

.date-btn {
  flex: 1;
  text-align: center;
  padding: 6px 8px;
  border-radius: 6px;
  background: #f5f6f8;
  font-size: 14px;
  cursor: pointer;
}

.date-sep {
  font-size: 13px;
  color: var(--bf-text-secondary);
  flex-shrink: 0;
}

.range-text {
  margin-top: 8px;
  font-size: 13px;
  color: var(--bf-text-secondary);
}

/* 快捷周期的只读日期框：去掉手型光标 */
.custom-range.readonly .date-btn {
  cursor: default;
}
.custom-range.readonly .date-all {
  flex: 1;
}

.timeline-list {
  padding: 0 0 16px;
}

.load-more {
  display: flex;
  justify-content: center;
  padding: 12px 0 4px;
}

.date-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 12px 16px 6px;
  font-size: 14px;
}

.date-header .date {
  font-weight: 600;
  color: var(--bf-text);
}

.date-header .weekday {
  color: var(--bf-text-secondary);
  font-size: 13px;
}

/* ============ 美柚风格：日卡片 + 紧凑记录行 ============ */
.day-card {
  background: var(--bf-card, #fff);
  border-radius: var(--bf-radius, 12px);
  margin: 0 12px 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

/* 当日汇总行 */
.day-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--bf-border, #f0f0f0);
}

.sum-item {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  font-size: 14px;
  color: var(--bf-text-secondary);
}

.sum-emoji {
  font-size: 14px;
}

.sum-label {
  color: var(--bf-text-secondary);
}

.sum-count {
  color: var(--bf-text);
  font-size: 16px;
  font-weight: 600;
}

.sum-extra {
  color: var(--bf-text-secondary);
  font-size: 13px;
}

/* 记录行：时间 | 图标 类型 | 详情 */
.rec-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

/* 行间分隔线：从时间列之后开始，更贴近美柚的细线 */
.rec-row + .rec-row {
  border-top: 1px solid #f5f6f8;
}

.row-time {
  flex-shrink: 0;
  width: 38px;
  font-size: 14px;
  color: var(--bf-text-secondary);
  font-variant-numeric: tabular-nums;
}

.row-icon {
  flex-shrink: 0;
  font-size: 17px;
  line-height: 1;
}

.row-label {
  flex-shrink: 0;
  max-width: 96px;
  font-size: 15px;
  color: var(--bf-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-detail {
  flex: 1;
  min-width: 0;
  text-align: right;
  font-size: 14px;
  color: var(--bf-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
  line-height: 1.45;
}

/* 过敏反应：详情标橙 */
.row-detail.warn {
  color: #d46b08;
}

/* ============ 事件查看 popup ============ */
.view-popup {
  padding: 20px 16px calc(12px + env(safe-area-inset-bottom));
  background: #f7f8fa;
  max-height: 85vh;
  overflow-y: auto;
}
.view-title {
  font-size: 18px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 16px;
  color: var(--bf-text);
}
.view-readonly {
  font-size: 15px;
  color: var(--bf-text);
  line-height: 1.5;
  padding: 2px 0;
}
.view-desc {
  font-size: 15px;
  color: var(--bf-text);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
/* 查看 popup 里的食材列表 */
.foods {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.food-pill {
  background: #f0f4fa;
  padding: 4px 10px;
  border-radius: 14px;
  font-size: 14px;
}

.food-pill .amount {
  font-size: 12px;
  color: var(--bf-text-secondary);
  margin-left: 4px;
}

.view-foods {
  gap: 8px;
}
.view-foods .food-pill {
  font-size: 15px;
  padding: 6px 12px;
}
.view-foods .food-pill .amount {
  font-size: 13px;
  margin-left: 6px;
}
.view-footer {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}
.view-footer .van-button {
  flex: 1;
}
/* 补剂详情列表 */
.view-supp-list {
  display: flex;
  flex-direction: column;
}
.view-supp-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 8px 0;
}
.view-supp-row + .view-supp-row {
  border-top: 1px solid #f5f6f8;
}
.view-supp-name {
  font-size: 15px;
  color: var(--bf-text);
}
.view-supp-dose {
  font-size: 14px;
  color: var(--bf-text-secondary);
}
</style>