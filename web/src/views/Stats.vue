<template>
  <div class="stats-page">
    <!-- 周期选择 -->
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

    <div v-if="loading" class="empty-state">加载中…</div>

    <template v-else>
      <!-- 概览 -->
      <div class="section-title">{{ sectionLabel }}概览</div>
      <div class="card-block stat-cards">
        <div class="stat">
          <div class="num">{{ weekly?.totalRecords || 0 }}</div>
          <div class="label">辅食记录</div>
        </div>
        <div class="stat stat-event">
          <div class="num">{{ events.totalEvents || 0 }}</div>
          <div class="label">事件记录</div>
        </div>
        <div class="stat">
          <div class="num">{{ weekly?.uniqueFoods || 0 }}</div>
          <div class="label">食材种类</div>
        </div>
      </div>

      <!-- 高频食材 -->
      <div class="section-title">{{ sectionLabel }}高频食材</div>
      <div class="card-block">
        <div v-if="!weekly?.topFoods?.length" class="empty-tip">{{ sectionLabel }}还没有记录</div>
        <div v-else class="bar-list">
          <div v-for="(f, idx) in weekly.topFoods" :key="f.name" class="bar-item">
            <span class="rank">{{ idx + 1 }}</span>
            <span class="name">{{ f.name }}</span>
            <div class="bar-wrap">
              <div class="bar" :style="{ width: barWidth(f.count) + '%' }" />
            </div>
            <span class="count">{{ f.count }}次</span>
          </div>
        </div>
      </div>

      <!-- 奶（与辅食分开统计）：汇总 + 折线，同体重板块样式 -->
      <div class="section-title">{{ sectionLabel }}奶</div>
      <div class="card-block">
        <div v-if="!weekly?.milk?.count" class="empty-tip">{{ sectionLabel }}还没有吃奶记录</div>
        <template v-else>
          <div class="milk-summary">
            吃奶 <strong>{{ weekly.milk.count }}</strong> 次 · 共
            <strong>{{ weekly.milk.totalMl }}</strong> ml
          </div>

          <!-- 奶量折线（每日总 ml，ECharts） -->
          <LineChart v-if="milkPoints.length" :points="milkPoints" color="#4d9df0" unit="ml" />

          <!-- 奶量首末对比：单日只显示当日奶量，多日给首末对比 -->
          <div v-if="milkInfo" class="ws-height-line">
            <span class="ws-label">奶量</span>
            <template v-if="milkInfo.multi">
              <span>{{ milkInfo.first }} → {{ milkInfo.last }} ml</span>
              <span class="ws-delta-sm ws-delta-milk">{{ milkInfo.delta >= 0 ? '+' : '' }}{{ milkInfo.delta }} ml</span>
            </template>
            <span v-else>{{ milkInfo.last }} ml</span>
          </div>
        </template>
      </div>

      <!-- 食物分类 -->
      <div class="section-title">{{ sectionLabel }}食物分类</div>
      <div class="card-block">
        <div v-if="Object.keys(categories).length === 0" class="empty-tip">暂无数据</div>
        <div v-else class="cat-grid">
          <div v-for="(count, cat) in categories" :key="cat" class="cat-item">
            <div class="cat-num">{{ count }}</div>
            <div class="cat-label">{{ cat }}</div>
          </div>
        </div>
      </div>

      <!-- 体重趋势 -->
      <div class="section-title">{{ sectionLabel }}体重</div>
      <div class="card-block">
        <div v-if="!weightStats.points.length" class="empty-tip">
          该范围内还没有体重记录
          <span v-if="range !== 'all'">，切到「全部」看历史趋势</span>
        </div>
        <template v-else>
          <div class="ws-summary">
            <div class="ws-latest">
              <span class="ws-label">最新</span>
              <span v-if="weightStats.latest?.weight != null" class="ws-num">
                {{ weightStats.latest.weight }}<span class="ws-unit">kg</span>
              </span>
              <span v-if="weightStats.latest?.height != null" class="ws-num ws-height">
                {{ weightStats.latest.height }}<span class="ws-unit">cm</span>
              </span>
              <span class="ws-date">{{ formatDate(weightStats.latest.date) }}</span>
            </div>
          </div>

          <!-- 体重折线（ECharts） -->
          <LineChart v-if="weightPoints.length" :points="weightPoints" color="#1677ff" unit="kg" />

          <!-- 体重首末对比：单条记录只显示当前值，两条起给首末对比 -->
          <div v-if="weightInfo" class="ws-height-line">
            <span class="ws-label">体重</span>
            <template v-if="weightInfo.multi">
              <span>{{ weightInfo.first }} → {{ weightInfo.last }} kg</span>
              <span class="ws-delta-sm ws-delta-weight">{{ weightInfo.delta >= 0 ? '+' : '' }}{{ weightInfo.delta }} kg</span>
            </template>
            <span v-else>{{ weightInfo.last }} kg</span>
          </div>

          <!-- 身高：数值太少，不画线；单条记录只显示当前值，两条起给首末对比 -->
          <div v-if="heightInfo" class="ws-height-line">
            <span class="ws-label">身高</span>
            <template v-if="heightInfo.multi">
              <span>{{ heightInfo.first }} → {{ heightInfo.last }} cm</span>
              <span class="ws-delta-sm">{{ heightInfo.delta >= 0 ? '+' : '' }}{{ heightInfo.delta }} cm</span>
            </template>
            <span v-else>{{ heightInfo.last }} cm</span>
          </div>
        </template>
      </div>

      <!-- 补剂统计 -->
      <div class="section-title">{{ sectionLabel }}补剂</div>
      <div class="card-block">
        <div v-if="!suppStats.totalRecords" class="empty-tip">{{ sectionLabel }}还没有补剂记录</div>
        <template v-else>
          <div class="supp-summary">
            记录 <strong>{{ suppStats.totalRecords }}</strong> 次 · 共服补剂
            <strong>{{ suppStats.totalItems }}</strong> 种次
          </div>
          <div class="bar-list">
            <div v-for="(s, idx) in suppStats.byName" :key="s.name" class="bar-item">
              <span class="rank rank-supp">{{ idx + 1 }}</span>
              <span class="name">{{ s.name }}</span>
              <div class="bar-wrap">
                <div class="bar bar-supp" :style="{ width: suppBarWidth(s.count) + '%' }" />
              </div>
              <span class="count">{{ s.count }}次</span>
            </div>
          </div>
        </template>
      </div>

      <!-- 事件统计（放最后） -->
      <div class="section-title">{{ sectionLabel }}事件</div>
      <div class="card-block">
        <div v-if="!events.totalEvents" class="empty-tip">{{ sectionLabel }}还没有事件记录</div>
        <template v-else>
          <div class="cat-grid">
            <div v-for="c in events.byCategory" :key="c.name" class="cat-item">
              <div class="cat-num" :style="{ color: eventColor(c.name) }">{{ c.count }}</div>
              <div class="cat-label">{{ c.name }}</div>
            </div>
          </div>

          <template v-if="events.byTitle?.length">
            <div class="sub-title">高频事件</div>
            <div class="bar-list">
              <div v-for="(t, idx) in events.byTitle" :key="t.name" class="bar-item">
                <span class="rank rank-event">{{ idx + 1 }}</span>
                <span class="name">{{ t.name }}</span>
                <div class="bar-wrap">
                  <div class="bar bar-event" :style="{ width: eventBarWidth(t.count) + '%' }" />
                </div>
                <span class="count">{{ t.count }}次</span>
              </div>
            </div>
          </template>
        </template>
      </div>

      <!-- 过敏记录（放最后） -->
      <div class="section-title">{{ range === 'all' ? '' : sectionLabel }}过敏记录</div>
      <div class="card-block">
        <div v-if="!reactions?.length" class="empty-tip">
          🎉 没有过敏记录
        </div>
        <div v-else class="reaction-list">
          <div v-for="r in reactions" :key="r.id" class="reaction-item">
            <div class="reaction-head">
              <van-tag :type="reactionType(r.reaction)" size="medium">{{ r.reaction }}</van-tag>
              <span class="date">{{ formatDate(r.recordedAt) }}</span>
            </div>
            <div class="reaction-foods">
              {{ r.items.map(it => it.food.name).join('、') }}
            </div>
            <div v-if="r.reactionNote" class="reaction-note">{{ r.reactionNote }}</div>
          </div>
        </div>
      </div>
    </template>

    <!-- 自定义日期选择 -->
    <van-calendar
      v-model:show="calendarVisible"
      :min-date="minDate"
      :max-date="maxDate"
      @confirm="onCalendarConfirm"
    />
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue';
import dayjs from 'dayjs';
import api from '../api/client';
import LineChart from '../components/LineChart.vue';
import { babyInfo, loadBaby } from '../baby';

loadBaby();

const rangeOptions = [
  { text: '本周', value: 'week' },
  { text: '近 7 天', value: '7d' },
  { text: '近 30 天', value: '30d' },
  { text: '全部', value: 'all' },
  { text: '自定义', value: 'custom' },
];

// 事件分类配色（与时间线保持一致）
const EVENT_COLORS = {
  症状: '#ee0a24',
  吃药: '#1677ff',
  疫苗: '#7232dd',
  情绪: '#07c160',
  其他: '#969799',
};

const range = ref('week');
const weekly = ref(null);
const categories = ref({});
const events = reactive({ totalEvents: 0, byCategory: [], byTitle: [], categories: {} });
const reactions = ref([]);
const weightStats = ref({ points: [], latest: null, first: null, weightDelta: null, heightDelta: null });
const suppStats = ref({ totalRecords: 0, totalItems: 0, byName: [] });
const loading = ref(true);

function suppBarWidth(count) {
  const max = suppStats.value.byName?.[0]?.count || 1;
  return Math.round((count / max) * 100);
}

/** 体重折线点位（ECharts 数据源） */
const weightPoints = computed(() =>
  (weightStats.value.points || [])
    .filter((p) => p.weight != null)
    .map((p) => ({ date: dayjs(p.date).format('YYYY-MM-DD'), value: p.weight }))
);

/** 奶量折线点位（每日总 ml） */
const milkPoints = computed(() =>
  (weekly.value?.milk?.daily || []).map((p) => ({ date: p.date, value: p.ml }))
);

/** 奶量首末对比（同体重/身高样式，基于每日总 ml） */
const milkInfo = computed(() => {
  const pts = weekly.value?.milk?.daily || [];
  if (pts.length === 0) return null;
  const first = pts[0].ml;
  const last = pts[pts.length - 1].ml;
  return { first, last, delta: Number((last - first).toFixed(1)), multi: pts.length > 1 };
});

/** 身高首末对比（点太少不画线）；只有一条记录时 multi=false，不显示箭头对比 */
const heightInfo = computed(() => {
  const pts = (weightStats.value.points || []).filter((p) => p.height != null);
  if (pts.length === 0) return null;
  const first = pts[0].height;
  const last = pts[pts.length - 1].height;
  return { first, last, delta: Number((last - first).toFixed(1)), multi: pts.length > 1 };
});

/** 体重首末对比（同身高样式） */
const weightInfo = computed(() => {
  const pts = (weightStats.value.points || []).filter((p) => p.weight != null);
  if (pts.length === 0) return null;
  const first = pts[0].weight;
  const last = pts[pts.length - 1].weight;
  return { first, last, delta: Number((last - first).toFixed(1)), multi: pts.length > 1 };
});

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

/** 计算当前周期对应的 [from, to]（dayjs 对象或 null），null 表示不限起点 */
function currentRange() {
  const today = dayjs();
  switch (range.value) {
    case 'week':
      return { from: startOfWeek(today), to: today };
    case '7d':
      return { from: today.subtract(6, 'day'), to: today };
    case '30d':
      return { from: today.subtract(29, 'day'), to: today };
    case 'all':
      return { from: null, to: null };
    case 'custom':
      return { from: fromDate.value || null, to: toDate.value || null };
    default:
      return { from: null, to: null };
  }
}

const sectionLabel = computed(() => {
  return {
    week: '本周',
    '7d': '近 7 天',
    '30d': '近 30 天',
    all: '全部',
    custom: '所选区间',
  }[range.value] || '';
});

/** 快捷周期显示用的起止日期（与自定义同款展示） */
const quickFrom = computed(() => {
  const { from } = currentRange();
  return from ? dayjs(from).format('YYYY-MM-DD') : '';
});
const quickTo = computed(() => {
  const { to } = currentRange();
  return to ? dayjs(to).format('YYYY-MM-DD') : '';
});

function reactionType(r) {
  return { 轻微: 'warning', 明显: 'danger', 严重: 'danger' }[r] || 'default';
}

function eventColor(cat) {
  return EVENT_COLORS[cat] || EVENT_COLORS['其他'];
}

function formatDate(d) {
  return dayjs(d).format('MM-DD');
}

function barWidth(count) {
  const max = weekly.value?.topFoods?.[0]?.count || 1;
  return Math.round((count / max) * 100);
}

function eventBarWidth(count) {
  const max = events.byTitle?.[0]?.count || 1;
  return Math.round((count / max) * 100);
}

/** 全部周期用这个起点，保证「全部」会真的把参数传给后端（不传则后端回退到默认周期） */
const ALL_FROM = '2000-01-01T00:00:00.000Z';

function queryParams() {
  const { from, to } = currentRange();
  return {
    from: from ? dayjs(from).startOf('day').toISOString() : ALL_FROM,
    to: to ? dayjs(to).endOf('day').toISOString() : dayjs().endOf('day').toISOString(),
  };
}

async function load() {
  if (range.value === 'custom' && !rangeReady.value) return;
  loading.value = true;
  try {
    const params = queryParams();
    const [w, c, e, r, wt, sp] = await Promise.all([
      api.get('/stats/weekly', { params }),
      api.get('/stats/categories', { params }),
      api.get('/stats/events', { params }),
      api.get('/stats/reactions', { params }),
      api.get('/stats/weight', { params }),
      api.get('/stats/supplements', { params }),
    ]);
    weekly.value = w;
    categories.value = c;
    Object.assign(events, e);
    reactions.value = r;
    weightStats.value = wt;
    suppStats.value = sp;
  } finally {
    loading.value = false;
  }
}

function pickRange(v) {
  if (v === range.value) return;
  range.value = v;
  if (v === 'custom') {
    if (!fromDate.value) fromDate.value = dayjs().subtract(6, 'day').format('YYYY-MM-DD');
    if (!toDate.value) toDate.value = dayjs().format('YYYY-MM-DD');
    load();
    return;
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

onMounted(load);
</script>

<style scoped>
.filter-row {
  padding: 10px 12px;
  background: white;
  margin-bottom: 8px;
}

/* 宝宝月龄徽标（居中） */
.baby-age {
  margin-top: 10px;
  text-align: center;
  font-size: 13px;
  color: var(--bf-text-secondary);
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
}

.kind-chip.active {
  background: var(--bf-primary);
  color: white;
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

.stat-cards {
  display: flex;
  gap: 8px;
}

.stat {
  flex: 1;
  text-align: center;
  padding: 12px 6px;
  background: linear-gradient(135deg, #e6f4ff, #f0f7ff);
  border-radius: 8px;
}

.stat-event {
  background: linear-gradient(135deg, #fff2e8, #fff8f2);
}

.stat.stat-event .num {
  color: #fa8c16;
}

.stat .num {
  font-size: 25px;
  font-weight: 600;
  color: var(--bf-primary);
}

.stat .label {
  font-size: 13px;
  color: var(--bf-text-secondary);
  margin-top: 4px;
}

.empty-tip {
  text-align: center;
  padding: 24px;
  color: var(--bf-text-secondary);
  font-size: 14px;
}

.sub-title {
  font-size: 13px;
  color: var(--bf-text-secondary);
  margin: 14px 0 10px;
}

.bar-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bar-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.bar-item .rank {
  width: 18px;
  height: 18px;
  background: var(--bf-primary);
  color: white;
  border-radius: 50%;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.bar-item .rank-event {
  background: #fa8c16;
}

.bar-item .name {
  width: 70px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bar-wrap {
  flex: 1;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.bar-wrap .bar {
  height: 100%;
  background: linear-gradient(90deg, #1677ff, #4096ff);
  border-radius: 4px;
  transition: width 0.3s;
}

.bar-wrap .bar-event {
  background: linear-gradient(90deg, #fa8c16, #ffc069);
}

/* 补剂：绿色系 */
.bar-item .rank-supp {
  background: #07c160;
}
.bar-wrap .bar-supp {
  background: linear-gradient(90deg, #07c160, #5edd8e);
}

.supp-summary {
  font-size: 14px;
  color: var(--bf-text-secondary);
  margin-bottom: 12px;
}
.supp-summary strong {
  color: #07c160;
  font-size: 17px;
  margin: 0 2px;
}

/* 奶：蓝色系（与辅食主色区分） */
.milk-summary {
  font-size: 14px;
  color: var(--bf-text-secondary);
  margin-bottom: 12px;
}
.milk-summary strong {
  color: #4d9df0;
  font-size: 17px;
  margin: 0 2px;
}

.bar-item .count {
  width: 50px;
  text-align: right;
  color: var(--bf-text-secondary);
  font-size: 13px;
  flex-shrink: 0;
}

.cat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.cat-item {
  text-align: center;
  padding: 10px;
  background: #f7f8fa;
  border-radius: 6px;
}

.cat-item .cat-num {
  font-size: 21px;
  font-weight: 600;
  color: var(--bf-primary);
}

.cat-item .cat-label {
  font-size: 12px;
  color: var(--bf-text-secondary);
  margin-top: 2px;
}

/* ============ 体重趋势 ============ */
.ws-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.ws-latest {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.ws-label {
  font-size: 13px;
  color: var(--bf-text-secondary);
}

.ws-num {
  font-size: 23px;
  font-weight: 600;
  color: #1677ff;
}

.ws-num .ws-unit {
  font-size: 13px;
  font-weight: 400;
  color: var(--bf-text-secondary);
  margin-left: 1px;
}

.ws-num.ws-height {
  font-size: 18px;
  color: #722ed1;
}

.ws-date {
  font-size: 13px;
  color: var(--bf-text-secondary);
}

.ws-height-line {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed #eef0f3;
}

.ws-delta-sm {
  font-size: 13px;
  font-weight: 600;
  color: #722ed1;
}

/* 体重对比行 delta 用体重蓝（身高紫色） */
.ws-delta-weight {
  color: #1677ff;
}

/* 奶量对比行 delta 用奶蓝 */
.ws-delta-milk {
  color: #4d9df0;
}

.reaction-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reaction-item {
  padding: 10px;
  background: #fff7e6;
  border-radius: 6px;
}

.reaction-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.reaction-head .date {
  font-size: 13px;
  color: var(--bf-text-secondary);
}

.reaction-foods {
  font-size: 15px;
}

.reaction-note {
  font-size: 13px;
  color: var(--bf-text-secondary);
  margin-top: 4px;
}
</style>
