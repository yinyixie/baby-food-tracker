<template>
  <div class="ai-page">
    <div class="banner" v-if="configMissing">
      <van-icon name="warning-o" />
      <span>AI 还没配 key：本机填 <code>api/.env</code> 的 <code>AI_API_KEY</code>，NAS 部署在同目录 <code>.env</code> 里填，然后重启服务</span>
    </div>

    <div class="context-bar" v-if="!configMissing">
      <div class="chip range" :class="{ locked: rangeLocked }" @click="openRangePicker">
        <van-icon :name="rangeLocked ? 'lock' : 'calendar-o'" />
        <span class="chip-label">{{ rangeLabel }}</span>
        <span class="chip-sep">·</span>
        <span class="chip-stat">{{ foodCount }} 餐</span>
        <span class="chip-sep">·</span>
        <span class="chip-stat">{{ eventCount }} 事件</span>
        <template v-if="weightCount > 0">
          <span class="chip-sep">·</span>
          <span class="chip-stat">{{ weightCount }} 体重</span>
        </template>
        <van-icon v-if="!rangeLocked" name="arrow-down" class="caret" />
      </div>
      <button type="button" class="bar-btn" @click="openHistory">
        <van-icon name="clock-o" /> 历史
      </button>
    </div>

    <div ref="scrollRef" class="messages">
      <div v-if="messages.length === 0" class="empty">
        <div class="empty-icon">💬</div>
        <div class="empty-title">问点什么吧</div>
        <div class="empty-sub">{{ emptySub }}</div>
        <div class="suggest-list">
          <van-button
            v-for="(q, i) in suggestions"
            :key="i"
            size="small"
            plain
            hairline
            round
            class="suggest-btn"
            @click="useSuggestion(q)"
          >{{ q }}</van-button>
        </div>
      </div>

      <template v-else>
        <div
          v-for="(m, i) in messages"
          :key="i"
          class="bubble-row"
          :class="{ user: m.role === 'user' }"
        >
          <div class="avatar" :class="m.role">
            {{ m.role === 'user' ? '我' : 'AI' }}
          </div>
          <div class="bubble" :class="m.role">
            <div v-if="m.loading" class="dots">
              <span></span><span></span><span></span>
            </div>
            <div
              v-else-if="m.role === 'assistant'"
              class="content md"
              v-html="renderMd(m.content)"
            ></div>
            <div v-else class="content">{{ m.content }}</div>
          </div>
        </div>
      </template>
    </div>

    <div class="composer">
      <textarea
        v-model="input"
        class="textarea"
        placeholder="说点什么…"
        :disabled="sending"
        @keydown.enter.exact.prevent="send"
      ></textarea>
      <van-button
        type="primary"
        size="small"
        class="send-btn"
        :loading="sending"
        :disabled="!input.trim() || configMissing"
        @click="send"
      >发送</van-button>
    </div>

    <!-- 历史对话 popup -->
    <van-popup
      v-model:show="historyOpen"
      position="bottom"
      round
      closeable
      :style="{ maxHeight: '72vh' }"
      teleport="body"
    >
      <div class="history">
        <div class="history-title">
          历史对话<span v-if="sortedSessions.length" class="history-count">{{ sortedSessions.length }}</span>
        </div>
        <div class="history-actions">
          <van-button size="small" type="primary" plain round icon="plus" @click="startNewChat">
            新对话
          </van-button>
        </div>

        <div v-if="sortedSessions.length === 0" class="history-empty">还没有对话记录</div>
        <div v-else class="history-list">
          <div
            v-for="s in visibleSessions"
            :key="s.id"
            class="history-item"
            :class="{ active: s.id === activeId }"
            @click="openSession(s)"
          >
            <div class="hi-main">
              <div class="hi-title">{{ sessionTitle(s) }}</div>
              <div class="hi-meta">{{ formatWhen(s.updatedAt) }} · {{ s.messages.length }} 条<template v-if="sessionRangeLabel(s)"> · {{ sessionRangeLabel(s) }}</template></div>
            </div>
            <van-icon name="delete-o" class="hi-del" @click.stop="removeSession(s)" />
          </div>

          <div v-if="hasMoreSessions" class="history-more">
            <van-button plain round size="small" @click="loadMoreSessions">
              加载更多（还有 {{ historyRemain }} 个）
            </van-button>
          </div>
        </div>
      </div>
    </van-popup>

    <!-- 时间范围 popup -->
    <van-popup
      v-model:show="rangePickerOpen"
      position="bottom"
      round
      closeable
      :style="{ maxHeight: '80vh' }"
      teleport="body"
    >
      <div class="picker">
        <div class="picker-header">
          <div class="picker-title">选择传给 AI 的时间范围</div>
          <div class="picker-sub">选了之后会自动重新拉记录</div>
        </div>

        <!-- 预设列表（默认） -->
        <van-cell-group v-if="!customMode" inset class="picker-presets">
          <van-cell
            v-for="opt in presetOptions"
            :key="opt.value"
            :title="opt.label"
            :class="{ active: rangeMode === opt.value }"
            clickable
            @click="pickPreset(opt.value)"
          >
            <template #value>
              <van-icon v-if="rangeMode === opt.value" name="success" class="check-icon" />
            </template>
          </van-cell>
          <van-cell
            title="自定义起止日期"
            :class="{ active: rangeMode === 4 }"
            clickable
            @click="enterCustomMode"
          >
            <template #value>
              <span v-if="rangeMode === 4 && customRange.length === 2" class="custom-value">
                {{ formatDate(customRange[0]) }} ~ {{ formatDate(customRange[1]) }}
              </span>
              <van-icon v-else-if="rangeMode === 4" name="success" class="check-icon" />
            </template>
          </van-cell>
        </van-cell-group>

        <!-- 自定义日历视图 -->
        <div v-else class="custom-panel">
          <van-calendar
            v-model="customShow"
            type="range"
            :poppable="false"
            :show-confirm="false"
            :first-day-of-week="1"
            :min-date="minDate"
            :max-date="maxDate"
            @select="onCustomSelect"
            color="#1989fa"
          />
        </div>

        <!-- 自定义视图底部固定 footer -->
        <div v-if="customMode" class="custom-footer">
          <div class="custom-hint">
            <template v-if="customRange.length === 2">
              ✓ {{ formatDate(customRange[0]) }} ~ {{ formatDate(customRange[1]) }}
            </template>
            <template v-else>
              点两个日期选区间
            </template>
          </div>
          <div class="custom-actions">
            <van-button size="small" plain hairline @click="exitCustomMode">‹ 返回</van-button>
            <van-button size="small" plain hairline @click="resetCustom">重选</van-button>
            <van-button
              size="small"
              type="primary"
              :disabled="customRange.length !== 2"
              @click="confirmCustom"
            >确定</van-button>
          </div>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, watch } from 'vue';
import { showToast, showConfirmDialog } from 'vant';
import axios from 'axios';
import api from '../api/client';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// AI 回答是 Markdown，渲染成 HTML（dompurify 消毒防注入）
marked.setOptions({ breaks: true, gfm: true });
function renderMd(text) {
  return DOMPurify.sanitize(marked.parse(text || ''));
}

const presetOptions = [
  { value: 0, label: '今日' },
  { value: 1, label: '近 3 天' },
  { value: 2, label: '近 7 天' },
  { value: 3, label: '近 30 天' },
];

const messages = ref([]);
const input = ref('');
const sending = ref(false);
const configMissing = ref(false);
const scrollRef = ref(null);

// ---------- 对话记录持久化（localStorage + 历史列表） ----------
const STORE_KEY = 'baby-food:ai-chat';
const STORE_V = 1;

const sessions = ref([]);       // [{ id, createdAt, updatedAt, messages }]
const activeId = ref('');
const historyOpen = ref(false);

// 历史列表分页：每次打开从第一页开始，「加载更多」向下展开
const HISTORY_PAGE_SIZE = 20;
const historyVisibleCount = ref(HISTORY_PAGE_SIZE);

const sortedSessions = computed(() =>
  [...sessions.value].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
);

const visibleSessions = computed(() =>
  sortedSessions.value.slice(0, historyVisibleCount.value)
);
const hasMoreSessions = computed(
  () => historyVisibleCount.value < sortedSessions.value.length
);
const historyRemain = computed(() =>
  Math.max(0, sortedSessions.value.length - historyVisibleCount.value)
);

function openHistory() {
  historyVisibleCount.value = HISTORY_PAGE_SIZE;
  historyOpen.value = true;
}

function loadMoreSessions() {
  historyVisibleCount.value = Math.min(
    historyVisibleCount.value + HISTORY_PAGE_SIZE,
    sortedSessions.value.length
  );
}

function readStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || obj.v !== STORE_V || !Array.isArray(obj.sessions)) return null;
    return obj;
  } catch (_) {
    return null;
  }
}

function writeStore() {
  try {
    const active = sessions.value.find((s) => s.id === activeId.value);
    if (active) active.updatedAt = Date.now();
    const data = {
      v: STORE_V,
      activeId: activeId.value,
      sessions: sessions.value.map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        range: s.range || null,
        // loading 占位不落库
        messages: (s.messages || [])
          .filter((m) => !m.loading)
          .map((m) => ({ role: m.role, content: m.content })),
      })),
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  } catch (_) {
    /* 隐私模式 / 超限，忽略 */
  }
}

function newSessionId() {
  return String(Date.now()) + Math.random().toString(36).slice(2, 6);
}

// 首次发消息时才建会话，避免历史里堆一堆空记录
function ensureSession() {
  if (activeId.value && sessions.value.some((s) => s.id === activeId.value)) return;
  const s = {
    id: newSessionId(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    range: serializeRange(), // 会话开启即固定范围
    messages: messages.value,
  };
  sessions.value.unshift(s);
  activeId.value = s.id;
}

function initChat() {
  const obj = readStore();
  if (!obj || obj.sessions.length === 0) return;
  sessions.value = obj.sessions.map((s) => ({
    ...s,
    messages: Array.isArray(s.messages) ? s.messages : [],
  }));
  // activeId 为空 = 上次停在「新对话」的空白态，保持空白
  const active = sessions.value.find((s) => s.id === obj.activeId);
  if (active) {
    activeId.value = active.id;
    messages.value = active.messages;
    if (active.range) applyRange(active.range);
  }
}

function startNewChat() {
  historyOpen.value = false;
  if (messages.value.length === 0) return;
  activeId.value = '';
  messages.value = [];
  input.value = '';
  writeStore();
}

function openSession(s) {
  activeId.value = s.id;
  messages.value = s.messages;
  // 旧数据没有 range：打开时按当前范围固定下来，之后不再漂移
  if (s.range) applyRange(s.range);
  else s.range = serializeRange();
  historyOpen.value = false;
  loadContext();
  nextTick(scrollToBottom);
}

async function removeSession(s) {
  try {
    await showConfirmDialog({ title: '删除这条对话？', message: '删除后无法恢复' });
  } catch (_) {
    return; // 用户取消
  }
  const idx = sessions.value.findIndex((x) => x.id === s.id);
  if (idx < 0) return;
  sessions.value.splice(idx, 1);
  if (activeId.value === s.id) {
    const next = sessions.value[0];
    if (next) {
      activeId.value = next.id;
      messages.value = next.messages;
      nextTick(scrollToBottom);
    } else {
      activeId.value = '';
      messages.value = [];
    }
  }
  writeStore();
}

function sessionTitle(s) {
  const first = (s.messages || []).find((m) => m.role === 'user' && m.content);
  if (!first) return '新对话';
  const t = String(first.content).replace(/\s+/g, ' ').trim();
  return t.length > 18 ? `${t.slice(0, 18)}…` : t;
}

// 历史列表里显示该会话锁定的时间范围
function sessionRangeLabel(s) {
  const r = s.range;
  if (!r || typeof r.mode !== 'number') return '';
  if (r.mode === 0) return '今日';
  if (r.mode === 1) return '近 3 天';
  if (r.mode === 2) return '近 7 天';
  if (r.mode === 3) return '近 30 天';
  if (r.mode === 4 && Array.isArray(r.custom) && r.custom.length === 2) {
    return `${formatDate(r.custom[0])} ~ ${formatDate(r.custom[1])}`;
  }
  return '';
}

function formatWhen(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${M}-${D} ${h}:${mi}`;
}

// 消息有变动就落库（loading 占位在 writeStore 里被过滤）
watch(messages, () => {
  if (activeId.value) writeStore();
}, { deep: true });

const rangeMode = ref(2); // 默认「近 7 天」
const customMode = ref(false);
const customRange = ref([]); // [Date, Date]
const customShow = ref(true); // 一直显示日历
const rangePickerOpen = ref(false);

// 会话一旦开始（有消息），时间范围就锁定，避免同一会话混用两个范围
const rangeLocked = computed(() => messages.value.length > 0);

// 范围随会话存一份，这样刷新 / 切回旧会话时锁定的范围是它真正用的那个
function serializeRange() {
  return {
    mode: rangeMode.value,
    custom:
      customRange.value.length === 2
        ? [customRange.value[0].toISOString(), customRange.value[1].toISOString()]
        : [],
  };
}

function applyRange(r) {
  if (!r || typeof r.mode !== 'number') return;
  if (r.mode === 4 && Array.isArray(r.custom) && r.custom.length === 2) {
    rangeMode.value = 4;
    customRange.value = r.custom.map((s) => new Date(s));
    return;
  }
  if (r.mode >= 0 && r.mode <= 3) {
    rangeMode.value = r.mode;
    customRange.value = [];
  }
}

const contextRecords = ref([]);

const today = new Date();
const minDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
const maxDate = today;

const rangeLabel = computed(() => {
  if (rangeMode.value === 0) return '今日';
  if (rangeMode.value === 1) return '近 3 天';
  if (rangeMode.value === 2) return '近 7 天';
  if (rangeMode.value === 3) return '近 30 天';
  if (rangeMode.value === 4) return formatCustomLabel();
  return '';
});

const formatCustomLabel = () => {
  if (customRange.value.length === 2) {
    return `${formatDate(customRange.value[0])} ~ ${formatDate(customRange.value[1])}`;
  }
  return '自定义';
};

const foodCount = computed(
  () => contextRecords.value.filter((r) => r.kind !== 'EVENT' && r.kind !== 'WEIGHT').length
);
const eventCount = computed(() => contextRecords.value.filter((r) => r.kind === 'EVENT').length);
const weightCount = computed(() => contextRecords.value.filter((r) => r.kind === 'WEIGHT').length);

const emptySub = computed(() => {
  const n = contextRecords.value.length;
  if (n === 0) return `${rangeLabel.value}范围内还没有记录`;
  const parts = [`${foodCount.value} 餐`, `${eventCount.value} 事件`];
  if (weightCount.value > 0) parts.push(`${weightCount.value} 体重`);
  return `${rangeLabel.value} · ${parts.join(' / ')}`;
});

const suggestions = [
  '这段时间吃得怎么样？',
  '有什么需要改进的搭配？',
  '宝宝最近吃得太单一了吗？',
];

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayStartISO(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}

function dayEndISO(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.toISOString();
}

function computeRange() {
  const now = new Date();
  if (rangeMode.value === 0) {
    return { from: dayStartISO(now), to: dayEndISO(now) };
  }
  if (rangeMode.value >= 1 && rangeMode.value <= 3) {
    const days = [0, 3, 7, 30][rangeMode.value];
    const start = new Date(now);
    start.setDate(start.getDate() - (days - 1));
    return { from: dayStartISO(start), to: dayEndISO(now) };
  }
  if (rangeMode.value === 4 && customRange.value.length === 2) {
    return {
      from: dayStartISO(customRange.value[0]),
      to: dayEndISO(customRange.value[1]),
    };
  }
  return { from: dayStartISO(now), to: dayEndISO(now) };
}

async function loadContext() {
  try {
    const { from, to } = computeRange();
    const { records } = await api.get('/records', {
      params: { from, to, limit: 500 },
    });
    contextRecords.value = records || [];
  } catch (_) {
    contextRecords.value = [];
  }
}

function openRangePicker() {
  if (rangeLocked.value) {
    showToast('当前对话的时间范围已锁定，开始新对话后可调整');
    return;
  }
  rangePickerOpen.value = true;
  customMode.value = false;
}

function pickPreset(v) {
  rangeMode.value = v;
  customMode.value = false;
  rangePickerOpen.value = false;
  loadContext();
}

function enterCustomMode() {
  customMode.value = true;
  customShow.value = true;
}

function exitCustomMode() {
  customMode.value = false;
  customRange.value = [];
}

function onCustomSelect(dates) {
  customRange.value = dates;
}

function resetCustom() {
  customRange.value = [];
  customShow.value = true;
}

function confirmCustom() {
  if (customRange.value.length !== 2) {
    showToast('请选择起止日期');
    return;
  }
  rangeMode.value = 4;
  customMode.value = false;
  rangePickerOpen.value = false;
  loadContext();
}

function useSuggestion(q) {
  if (sending.value) return;
  // 未配 key 时不发请求，只回填输入框并提示
  if (configMissing.value) {
    input.value = q;
    showToast('先配置 AI key 再提问');
    return;
  }
  // 选中即发起对话
  input.value = q;
  send();
}

function scrollToBottom() {
  nextTick(() => {
    if (scrollRef.value) scrollRef.value.scrollTop = scrollRef.value.scrollHeight;
  });
}

async function send() {
  const text = input.value.trim();
  if (!text || sending.value) return;

  ensureSession();
  const userMsg = { role: 'user', content: text };
  const aiPlaceholder = { role: 'assistant', content: '', loading: true };
  messages.value.push(userMsg);
  messages.value.push(aiPlaceholder);
  input.value = '';
  scrollToBottom();

  sending.value = true;
  try {
    const { data } = await axios.post(
      '/api/ai/chat',
      {
        messages: messages.value
          .filter((m) => m !== aiPlaceholder)
          .map((m) => ({ role: m.role, content: m.content })),
        context: {
          records: contextRecords.value,
          rangeLabel: rangeLabel.value,
        },
      },
      { timeout: 60000 },
    );

    aiPlaceholder.loading = false;
    aiPlaceholder.content = data.reply || '(无回复)';
    if (data.error === 'AI_API_KEY 未配置') configMissing.value = true;
    writeStore();
  } catch (err) {
    aiPlaceholder.loading = false;
    const e = err?.response?.data || err;
    if (e?.error === 'AI_API_KEY 未配置') {
      configMissing.value = true;
    }
    aiPlaceholder.content = `出错了：${e?.error || err.message || '未知错误'}`;
  } finally {
    sending.value = false;
    // 显式落库：aiPlaceholder 是原始对象，直接改字段不会触发深度 watch
    writeStore();
    scrollToBottom();
  }
}

onMounted(async () => {
  initChat();
  await loadContext();
});
</script>

<style scoped>
.ai-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bf-bg, #f7f8fa);
}

.banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #fff7e8;
  color: #ad6800;
  font-size: 14px;
  border-bottom: 1px solid #ffe0a8;
  flex-shrink: 0;
}
.banner code {
  background: rgba(0, 0, 0, 0.05);
  padding: 0 4px;
  border-radius: 3px;
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.context-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: white;
  border-bottom: 1px solid var(--bf-border, #ebedf0);
  flex-shrink: 0;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 14px;
  background: #f2f3f5;
  color: #323233;
  flex: 1;
  min-width: 0;
  cursor: pointer;
  user-select: none;
}
.chip-label {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chip.locked { cursor: default; background: #f7f8fa; color: #969799; }
.chip.locked .chip-label { font-weight: 400; color: #646566; }
.chip-sep { color: #c8c9cc; font-size: 12px; }
.chip-stat { color: #646566; font-size: 13px; flex-shrink: 0; }
.caret {
  margin-left: auto;
  color: #969799;
  font-size: 13px;
  flex-shrink: 0;
}

.bar-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: none;
  border-radius: 16px;
  background: #f2f3f5;
  color: #323233;
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
}
.bar-btn:active { background: #e6e8eb; }

.history { padding: 16px 16px 24px; }
.history-title {
  font-size: 17px;
  font-weight: 500;
  text-align: center;
  color: #323233;
  margin-bottom: 12px;
}
.history-count {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: 9px;
  background: #f2f3f5;
  color: #969799;
  font-size: 13px;
  font-weight: 400;
  vertical-align: 2px;
}
.history-more {
  display: flex;
  justify-content: center;
  padding: 12px 0 2px;
}
.history-actions { display: flex; justify-content: flex-end; margin-bottom: 8px; }
.history-empty {
  text-align: center;
  color: #969799;
  font-size: 14px;
  padding: 32px 0;
}
.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 54vh;
  overflow-y: auto;
}
.history-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #f7f8fa;
  cursor: pointer;
}
.history-item.active { background: #e8f3ff; }
.hi-main { flex: 1; min-width: 0; }
.hi-title {
  font-size: 15px;
  color: #323233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hi-meta { font-size: 13px; color: #969799; margin-top: 2px; }
.hi-del {
  color: #c8c9cc;
  font-size: 19px;
  padding: 4px;
  flex-shrink: 0;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px 8px;
}

.empty {
  text-align: center;
  padding: 48px 16px;
  color: #969799;
}
.empty-icon { font-size: 49px; margin-bottom: 12px; }
.empty-title { font-size: 17px; font-weight: 500; color: #323233; margin-bottom: 8px; }
.empty-sub { font-size: 14px; margin-bottom: 18px; }
.suggest-list { display: flex; flex-direction: column; gap: 8px; align-items: center; }
.suggest-btn { min-width: 220px; }

.bubble-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  align-items: flex-start;
}
.bubble-row.user { flex-direction: row-reverse; }

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 500;
  flex-shrink: 0;
}
.avatar.user { background: #1989fa; color: white; }
.avatar.assistant { background: #07c160; color: white; }

.bubble {
  max-width: 75%;
  padding: 10px 12px;
  border-radius: 12px;
  font-size: 15px;
  line-height: 1.55;
  word-break: break-word;
  white-space: pre-wrap;
}
.bubble.user {
  background: #1989fa;
  color: white;
  border-top-right-radius: 4px;
}
.bubble.assistant {
  background: white;
  color: #323233;
  border-top-left-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

/* Markdown 渲染的 AI 回答：关掉气泡的 pre-wrap（HTML 里已有块级换行），再补各元素样式 */
.content.md {
  white-space: normal;
}
.content.md :deep(p) {
  margin: 0 0 8px;
}
.content.md :deep(p:last-child) {
  margin-bottom: 0;
}
.content.md :deep(strong) {
  font-weight: 600;
}
.content.md :deep(ul),
.content.md :deep(ol) {
  margin: 4px 0 8px;
  padding-left: 18px;
}
.content.md :deep(li) {
  margin: 2px 0;
}
.content.md :deep(h1),
.content.md :deep(h2),
.content.md :deep(h3),
.content.md :deep(h4) {
  font-size: 16px;
  font-weight: 600;
  margin: 10px 0 6px;
}
.content.md :deep(h1:first-child),
.content.md :deep(h2:first-child),
.content.md :deep(h3:first-child) {
  margin-top: 0;
}
.content.md :deep(code) {
  background: #f5f6f8;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 14px;
}
.content.md :deep(blockquote) {
  margin: 6px 0;
  padding: 4px 10px;
  border-left: 3px solid #dcdee0;
  color: #969799;
}
.content.md :deep(table) {
  border-collapse: collapse;
  margin: 6px 0;
  font-size: 14px;
}
.content.md :deep(th),
.content.md :deep(td) {
  border: 1px solid #ebedf0;
  padding: 4px 8px;
}

.dots {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}
.dots span {
  width: 6px;
  height: 6px;
  background: #c8c9cc;
  border-radius: 50%;
  animation: blink 1.4s infinite both;
}
.dots span:nth-child(2) { animation-delay: 0.2s; }
.dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes blink {
  0%, 80%, 100% { opacity: 0.3; }
  40% { opacity: 1; }
}

.composer {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  padding: 10px 12px;
  background: white;
  border-top: 1px solid var(--bf-border, #ebedf0);
  flex-shrink: 0;
}
.textarea {
  flex: 1;
  height: 36px;
  min-height: 36px;
  max-height: 100px;
  border: 1px solid var(--bf-border, #ebedf0);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 15px;
  line-height: 20px;
  font-family: inherit;
  resize: none;
  outline: none;
  background: #f7f8fa;
  box-sizing: border-box;
}
.textarea:focus { border-color: #1989fa; background: white; }
/* 隐藏 textarea 滚动条（Safari/鼠标环境下会出现灰色竖条） */
.textarea { scrollbar-width: none; }
.textarea::-webkit-scrollbar { display: none; width: 0; }
.send-btn {
  flex-shrink: 0;
  height: 36px;
  margin: 0;
  padding: 0 14px;
  align-self: flex-end;
}

/* 范围 popup */
.picker {
  display: flex;
  flex-direction: column;
  max-height: 80vh;
}
.picker-header {
  padding: 16px 16px 8px;
  border-bottom: 1px solid var(--bf-border, #ebedf0);
  flex-shrink: 0;
}
.picker-title { font-size: 17px; font-weight: 600; }
.picker-sub { font-size: 13px; color: #969799; margin-top: 4px; }

.picker-presets {
  margin-top: 8px;
  margin-bottom: 8px;
  flex-shrink: 0;
}
.picker-presets :deep(.van-cell.active) {
  background: #e8f4ff;
}
.picker-presets :deep(.van-cell.active .van-cell__title) {
  color: #1989fa;
  font-weight: 500;
}
.check-icon {
  color: #1989fa;
  font-size: 19px;
}
.custom-value {
  font-size: 13px;
  color: #1989fa;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.custom-panel {
  display: flex;
  flex-direction: column;
  overflow: auto;
  max-height: 60vh;
}
.custom-panel :deep(.van-calendar) {
  flex: 1;
}
.custom-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--bf-border, #ebedf0);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: white;
  flex-shrink: 0;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
}
.custom-hint {
  flex: 1;
  font-size: 14px;
  color: #646566;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.custom-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
</style>