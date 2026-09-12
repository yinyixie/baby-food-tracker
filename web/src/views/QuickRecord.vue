<template>
  <div class="quick-record">
    <!-- 模式切换：食物 / 事件 / 体重（编辑时类型已锁定，不显示） -->
    <div v-if="!isEdit" class="mode-tabs">
      <van-tabs v-model:active="recordMode" line>
        <van-tab title="🍴 食物" name="food" />
        <van-tab title="📝 事件" name="event" />
        <van-tab title="⚖️ 体重" name="weight" />
        <van-tab title="💊 补剂" name="supp" />
      </van-tabs>
    </div>

    <!-- ============ 食物模式 ============ -->
    <template v-if="recordMode === 'food'">
      <!-- 餐次选择 -->
      <div class="section-title">餐次</div>
      <div class="card-block">
        <van-tabs v-model:active="form.mealType" type="card">
          <van-tab title="早餐" name="早餐" />
          <van-tab title="午餐" name="午餐" />
          <van-tab title="晚餐" name="晚餐" />
          <van-tab title="加餐" name="加餐" />
        </van-tabs>
      </div>

      <!-- 用餐时间 -->
      <div class="section-title">用餐时间</div>
      <div class="card-block">
        <van-field
          :model-value="formatTime(form.recordedAt)"
          placeholder="选择时间"
          readonly
          is-link
          @click="openTimePicker"
        />
      </div>

      <!-- 食材选择 -->
      <div class="section-title">吃了什么</div>
      <div class="card-block">
        <div v-if="foods.list.length === 0" class="empty-state">
          <p>食材库为空</p>
          <van-button type="primary" size="small" @click="$router.push('/foods')">
            去添加食材
          </van-button>
        </div>

        <template v-else>
          <div v-if="foods.recent.length > 0" class="recent-block">
            <div class="recent-label">最近吃过</div>
            <div class="search-results">
              <div
                v-for="f in foods.recent"
                :key="f.id"
                class="food-chip"
                :class="{ selected: selectedIds.has(f.id) }"
                @click="toggleFood(f)"
              >
                <span class="emoji">{{ f.emoji }}</span>
                <span class="name">{{ f.name }}</span>
              </div>
            </div>
            <div class="recent-divider"></div>
          </div>

          <van-search
            v-model="foodSearch"
            placeholder="输入食材名称"
            shape="round"
          />

          <div v-if="!foodSearch.trim()" class="search-hint">
            搜索添加 · 选中后会出现在下方
          </div>
          <div v-else-if="filteredFoods.length === 0" class="empty-tip">
            没有匹配的食材
          </div>
          <div v-else class="search-results">
            <div
              v-for="f in filteredFoods"
              :key="f.id"
              class="food-chip"
              :class="{ selected: selectedIds.has(f.id) }"
              @click="toggleFood(f)"
            >
              <span class="emoji">{{ f.emoji }}</span>
              <span class="name">{{ f.name }}</span>
            </div>
          </div>
        </template>
      </div>

      <!-- 已选食材 -->
      <div v-if="selectedFoods.length > 0" class="section-title">
        已选 {{ selectedFoods.length }} 项
      </div>
      <div v-if="selectedFoods.length > 0" class="card-block">
        <div class="selected-list">
          <van-swipe-cell v-for="f in selectedFoods" :key="f.id">
            <div class="selected-item">
              <span class="emoji">{{ f.emoji }}</span>
              <span class="name">{{ f.name }}</span>
              <span class="amount">
                <input
                  type="number"
                  v-model.number="amountMap[f.id]"
                  min="0"
                  max="300"
                  step="5"
                  class="amount-input"
                />
                <span class="unit">{{ f.unit === 'ml' ? 'ml' : 'g' }}</span>
              </span>
            </div>
            <template #right>
              <van-button square type="danger" text="删除" class="swipe-btn" @click="toggleFood(f)" />
            </template>
          </van-swipe-cell>
        </div>
      </div>

      <div class="section-title">食欲</div>
      <div class="card-block">
        <van-radio-group v-model="form.appetite" direction="horizontal">
          <van-radio name="好">好</van-radio>
          <van-radio name="一般">一般</van-radio>
          <van-radio name="不好">不好</van-radio>
        </van-radio-group>
      </div>

      <div class="section-title">过敏反应</div>
      <div class="card-block">
        <van-radio-group v-model="form.reaction" direction="horizontal">
          <van-radio name="无">无</van-radio>
          <van-radio name="轻微">轻微</van-radio>
          <van-radio name="明显">明显</van-radio>
          <van-radio name="严重">严重</van-radio>
        </van-radio-group>
        <van-field
          v-if="form.reaction !== '无'"
          v-model="form.reactionNote"
          type="textarea"
          rows="2"
          autosize
          placeholder="补充描述（如：嘴边发红、出疹等）"
          style="margin-top: 8px"
        />
      </div>

      <div class="section-title">备注（可选）</div>
      <div class="card-block">
        <van-field
          v-model="form.note"
          type="textarea"
          rows="2"
          autosize
          placeholder="比如：第一次尝试、很喜欢、自己抓勺子..."
        />
      </div>
    </template>

    <!-- ============ 事件模式 ============ -->
    <template v-else-if="recordMode === 'event'">
      <div class="section-title">类别</div>
      <div class="card-block">
        <van-tabs v-model:active="eventForm.category" type="card">
          <van-tab title="症状" name="症状" />
          <van-tab title="吃药" name="吃药" />
          <van-tab title="疫苗" name="疫苗" />
          <van-tab title="情绪" name="情绪" />
          <van-tab title="其他" name="其他" />
        </van-tabs>
      </div>

      <div class="section-title">发生时间</div>
      <div class="card-block">
        <van-field
          :model-value="formatTime(eventForm.recordedAt)"
          placeholder="选择时间"
          readonly
          is-link
          @click="openTimePicker"
        />
      </div>

      <div class="section-title">详细描述（可选）</div>
      <div class="card-block">
        <van-field
          v-model="eventForm.description"
          type="textarea"
          rows="3"
          autosize
          placeholder="比如「便便稀、3 次」「发烧 38.5℃、睡不好」"
          maxlength="200"
          show-word-limit
        />
      </div>
    </template>

    <!-- ============ 体重模式 ============ -->
    <template v-else-if="recordMode === 'weight'">
      <div class="section-title">称重时间</div>
      <div class="card-block">
        <van-field
          :model-value="formatTime(weightForm.recordedAt)"
          placeholder="选择时间"
          readonly
          is-link
          @click="openTimePicker"
        />
      </div>

      <div class="section-title">体重</div>
      <div class="card-block">
        <van-field
          v-model="weightForm.weight"
          type="number"
          label="体重"
          placeholder="如 8.6"
          input-align="right"
        >
          <template #extra><span class="unit-text">kg</span></template>
        </van-field>
        <van-field
          v-model="weightForm.height"
          type="number"
          label="身高"
          placeholder="可不填"
          input-align="right"
        >
          <template #extra><span class="unit-text">cm</span></template>
        </van-field>
        <div v-if="!weightValid" class="field-hint">体重和身高至少填一项</div>
      </div>

      <div class="section-title">备注（可选）</div>
      <div class="card-block">
        <van-field
          v-model="weightForm.note"
          type="textarea"
          rows="2"
          autosize
          placeholder="比如：儿保体检、早上空腹称的"
          maxlength="100"
        />
      </div>
    </template>

    <!-- ============ 补剂模式 ============ -->
    <template v-else>
      <div class="section-title">服用时间</div>
      <div class="card-block">
        <van-field
          :model-value="formatTime(suppForm.recordedAt)"
          placeholder="选择时间"
          readonly
          is-link
          @click="openTimePicker"
        />
      </div>

      <div class="section-title">
        营养补剂
        <van-button size="mini" plain type="primary" class="supp-add-btn" @click="addSuppRow">+ 添加</van-button>
      </div>
      <div class="card-block">
        <div v-for="(row, i) in suppItems" :key="i" class="supp-row">
          <van-field v-model="row.name" placeholder="补剂名称" class="supp-name" />
          <van-field v-model="row.dose" type="number" placeholder="用量" class="supp-dose" />
          <button type="button" class="supp-unit" @click="openUnitPicker(i)">{{ row.unit || '单位' }}</button>
          <van-icon
            name="clear"
            class="supp-remove"
            @click="suppItems.length > 1 ? suppItems.splice(i, 1) : (row.name = '', row.dose = '', row.unit = '粒')"
          />
        </div>
        <div v-if="suppItems.length === 1 && !suppItems[0].name" class="field-hint">
          从下面点选常见补剂，或手动输入名称
        </div>

        <div class="supp-quick">
          <div class="supp-quick-label">常见补剂</div>
          <div class="supp-chips">
            <button
              v-for="name in COMMON_SUPPS"
              :key="name"
              type="button"
              class="supp-chip"
              @click="addSuppByName(name)"
            >{{ name }}</button>
          </div>
        </div>

        <div v-if="recentSupps.length > 0" class="supp-quick">
          <div class="supp-quick-label">最近吃过</div>
          <div class="supp-chips">
            <button
              v-for="name in recentSupps"
              :key="name"
              type="button"
              class="supp-chip"
              @click="addSuppByName(name)"
            >{{ name }}</button>
          </div>
        </div>
      </div>

      <div class="section-title">备注（可选）</div>
      <div class="card-block">
        <van-field
          v-model="suppForm.note"
          type="textarea"
          rows="2"
          autosize
          placeholder="比如：随餐吃的、宝宝不抗拒"
          maxlength="100"
        />
      </div>
    </template>

    <!-- 保存 -->
    <div class="submit-bar">
      <template v-if="recordMode === 'food'">
        <template v-if="!isEdit">
          <div class="submit-row">
            <van-button plain round class="submit-half" :loading="savingDraft" @click="saveDraft">暂存</van-button>
            <van-button type="primary" round class="submit-half" :loading="submitting" :disabled="selectedFoods.length === 0" @click="submit">保存记录</van-button>
          </div>
        </template>
        <template v-else>
          <van-button type="primary" block round :loading="submitting" :disabled="selectedFoods.length === 0" @click="submit">保存修改</van-button>
          <van-button block plain style="margin-top: 8px" @click="cancel">取消</van-button>
        </template>
      </template>
      <template v-else-if="recordMode === 'event'">
        <template v-if="!isEdit">
          <van-button type="primary" block round :loading="submitting" @click="submit">保存事件</van-button>
        </template>
        <template v-else>
          <van-button type="primary" block round :loading="submitting" @click="submit">保存修改</van-button>
          <van-button block plain style="margin-top: 8px" @click="cancel">取消</van-button>
        </template>
      </template>
      <template v-else-if="recordMode === 'weight'">
        <template v-if="!isEdit">
          <van-button type="primary" block round :loading="submitting" :disabled="!weightValid" @click="submit">保存体重</van-button>
        </template>
        <template v-else>
          <van-button type="primary" block round :loading="submitting" :disabled="!weightValid" @click="submit">保存修改</van-button>
          <van-button block plain style="margin-top: 8px" @click="cancel">取消</van-button>
        </template>
      </template>
      <template v-else>
        <template v-if="!isEdit">
          <van-button type="primary" block round :loading="submitting" :disabled="!suppValid" @click="submit">保存补剂</van-button>
        </template>
        <template v-else>
          <van-button type="primary" block round :loading="submitting" :disabled="!suppValid" @click="submit">保存修改</van-button>
          <van-button block plain style="margin-top: 8px" @click="cancel">取消</van-button>
        </template>
      </template>
    </div>

    <!-- 共享的日期+时间 picker popup（食物/事件模式都用） -->
    <van-popup v-model:show="showTimePicker" position="bottom" round teleport="body">
      <div class="datetime-picker">
        <div class="dp-header">
          <span class="dp-btn dp-cancel" @click="showTimePicker = false">取消</span>
          <span class="dp-title">{{ timePickerTitle }}</span>
          <span class="dp-btn dp-confirm" @click="confirmDateTime">确定</span>
        </div>
        <van-date-picker
          v-model="datePicker"
          :min-date="minDate"
          :max-date="maxDate"
          :show-toolbar="false"
        />
        <van-time-picker
          v-model="timePicker"
          :show-toolbar="false"
        />
      </div>
    </van-popup>

    <!-- 补剂单位选择：底部弹层 + 枚举 chips -->
    <van-popup v-model:show="unitPickerVisible" position="bottom" round teleport="body">
      <div class="unit-picker">
        <div class="unit-picker-title">选择单位</div>
        <div class="unit-picker-grid">
          <button
            v-for="u in DOSE_UNITS"
            :key="u"
            type="button"
            class="unit-chip"
            :class="{ active: suppItems[unitPickerIndex]?.unit === u }"
            @click="pickUnit(u)"
          >{{ u }}</button>
        </div>
        <div class="unit-picker-footer">
          <van-button block plain @click="unitPickerVisible = false">取消</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast, showSuccessToast } from 'vant';
import { useFoodsStore } from '../stores/foods';
import { useRecordsStore } from '../stores/records';
import api from '../api/client';

// embedded 模式：组件被父级作为 popup 内容渲染，不走路由，事件用 emit 反馈
const props = defineProps({
  embedded: { type: Boolean, default: false },
  editId: { type: Number, default: null },
  initialKind: { type: String, default: null }, // 'FOOD' | 'EVENT' | null
});
const emit = defineEmits(['done', 'cancel']);

const foods = useFoodsStore();
const records = useRecordsStore();
const route = useRoute();
const router = useRouter();

const isEdit = computed(() => (props.embedded ? !!props.editId : !!route.params.id));
const editRecordId = computed(() =>
  props.embedded ? Number(props.editId) : Number(route.params.id)
);
const DRAFT_VERSION = 1;
const draftKey = 'baby-food:draft-new';

// 模式：food / event / weight / supp。embedded 时根据 initialKind 决定默认 tab
const recordMode = ref(
  props.initialKind === 'EVENT'
    ? 'event'
    : props.initialKind === 'WEIGHT'
      ? 'weight'
      : props.initialKind === 'SUPPLEMENT'
        ? 'supp'
        : 'food'
);

const form = reactive({
  recordedAt: new Date().toISOString(),
  mealType: '午餐',
  appetite: '好',
  reaction: '无',
  reactionNote: '',
  note: '',
});

const eventForm = reactive({
  category: '症状',
  recordedAt: new Date().toISOString(),
  description: '',
});

const weightForm = reactive({
  recordedAt: new Date().toISOString(),
  weight: '',
  height: '',
  note: '',
});

// ----- 补剂模式 -----
const COMMON_SUPPS = ['维生素AD', '维生素D3', '益生菌', '钙', '锌', '铁', 'DHA'];
// 用量单位枚举
const DOSE_UNITS = ['粒', '滴', '袋', '勺', '片', '支', 'ml', 'mg', 'g', 'IU'];
const suppForm = reactive({
  recordedAt: new Date().toISOString(),
  note: '',
});
// dose 只存数字，unit 单独选；保存时拼成 "1粒" 这样的字符串入库
const suppItems = ref([{ name: '', dose: '', unit: '粒' }]);
const recentSupps = ref([]);

// 至少一条补剂填了名称才能保存
const suppValid = computed(() => suppItems.value.some((it) => it.name.trim()));

function addSuppRow() {
  suppItems.value.push({ name: '', dose: '', unit: '粒' });
}

// ----- 单位选择弹层 -----
const unitPickerVisible = ref(false);
const unitPickerIndex = ref(0);

function openUnitPicker(i) {
  unitPickerIndex.value = i;
  unitPickerVisible.value = true;
}

function pickUnit(u) {
  const row = suppItems.value[unitPickerIndex.value];
  if (row) row.unit = u;
  unitPickerVisible.value = false;
}

/** 把历史 dose（如 "1粒"、"5ml"）拆成 数字 + 单位；没匹配到单位就整个放进数字位 */
function parseDose(dose) {
  const s = (dose || '').trim();
  // 从长单位到短单位尝试匹配后缀（IU 要在 I 前、ml 在 m 前，避免截断）
  const sorted = [...DOSE_UNITS].sort((a, b) => b.length - a.length);
  for (const u of sorted) {
    if (s.length > u.length && s.endsWith(u)) {
      return { dose: s.slice(0, -u.length).trim(), unit: u };
    }
  }
  return { dose: s, unit: '粒' };
}

// 点常见/最近补剂：已有同名行就不重复加
function addSuppByName(name) {
  if (suppItems.value.some((it) => it.name === name)) {
    showToast(`已添加 ${name}`);
    return;
  }
  // 有一条空行就直接填进去，否则追加新行
  const empty = suppItems.value.find((it) => !it.name.trim());
  if (empty) empty.name = name;
  else suppItems.value.push({ name, dose: '', unit: '粒' });
}

// 从历史补剂记录取「最近吃过」的名称（去重，最多 7 个）
async function fetchRecentSupps() {
  try {
    const d = await api.get('/records', { params: { kind: 'SUPPLEMENT', limit: 20 } });
    const names = [];
    for (const r of d.records || []) {
      for (const it of r.supplement?.items || []) {
        if (it.name && !names.includes(it.name)) names.push(it.name);
      }
    }
    recentSupps.value = names.slice(0, 7);
  } catch (e) { /* 静默失败，不影响录入 */ }
}

const showTimePicker = ref(false);
// 共享 picker 状态（食物/事件都走这两个 ref）
const datePicker = ref([
  String(new Date().getFullYear()),
  String(new Date().getMonth() + 1).padStart(2, '0'),
  String(new Date().getDate()).padStart(2, '0'),
]);
const timePicker = ref([
  String(new Date().getHours()).padStart(2, '0'),
  String(new Date().getMinutes()).padStart(2, '0'),
]);

const minDate = new Date(2020, 0, 1);
const maxDate = new Date();

const foodSearch = ref('');
const selectedIds = ref(new Set());
const amountMap = reactive({});
const submitting = ref(false);
const savingDraft = ref(false);

onMounted(async () => {
  if (foods.list.length === 0) await foods.fetch();
  foods.fetchRecent();
  fetchRecentSupps();
  if (isEdit.value) {
    await loadForEdit();
  } else if (!props.embedded && recordMode.value === 'food') {
    // 暂存恢复仅在路由模式启用（popup 编辑不需要）
    restoreDraftIfAny();
  }
});

async function loadForEdit() {
  try {
    const r = await api.get(`/records/${editRecordId.value}`);
    if (r.kind === 'EVENT') {
      recordMode.value = 'event';
      eventForm.category = r.event?.category || '症状';
      eventForm.description = r.event?.description || '';
      eventForm.recordedAt = r.recordedAt;
      const [d, t] = splitDateTime(r.recordedAt);
      datePicker.value = d;
      timePicker.value = t;
    } else if (r.kind === 'WEIGHT') {
      recordMode.value = 'weight';
      weightForm.recordedAt = r.recordedAt;
      weightForm.weight = r.weight?.weight ?? '';
      weightForm.height = r.weight?.height ?? '';
      weightForm.note = r.note || '';
      const [d, t] = splitDateTime(r.recordedAt);
      datePicker.value = d;
      timePicker.value = t;
    } else if (r.kind === 'SUPPLEMENT') {
      recordMode.value = 'supp';
      suppForm.recordedAt = r.recordedAt;
      suppForm.note = r.note || '';
      const items = r.supplement?.items || [];
      suppItems.value = items.length > 0
        ? items.map((it) => {
            const p = parseDose(it.dose);
            return { name: it.name || '', dose: p.dose, unit: p.unit };
          })
        : [{ name: '', dose: '', unit: '粒' }];
      const [d, t] = splitDateTime(r.recordedAt);
      datePicker.value = d;
      timePicker.value = t;
    } else {
      form.recordedAt = r.recordedAt;
      form.mealType = r.mealType;
      form.appetite = r.appetite || '好';
      form.reaction = r.reaction || '无';
      form.reactionNote = r.reactionNote || '';
      form.note = r.note || '';
      selectedIds.value = new Set(r.items.map((it) => it.foodId));
      r.items.forEach((it) => {
        amountMap[it.foodId] = it.amount ?? 20;
      });
    }
  } catch (e) {
    showToast('记录加载失败');
    if (props.embedded) emit('cancel');
    else router.replace('/timeline');
  }
}

function splitDateTime(iso) {
  const d = new Date(iso);
  const date = [
    String(d.getFullYear()),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ];
  const time = [
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
  ];
  return [date, time];
}

function formatTime(iso) {
  const d = new Date(iso);
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}-${M}-${D} ${h}:${m}`;
}

// 当前模式对应的 recordedAt（按 recordMode 切换各模式的字段）
function currentRecordedAt() {
  if (recordMode.value === 'event') return eventForm.recordedAt;
  if (recordMode.value === 'weight') return weightForm.recordedAt;
  if (recordMode.value === 'supp') return suppForm.recordedAt;
  return form.recordedAt;
}
function setRecordedAt(iso) {
  if (recordMode.value === 'event') eventForm.recordedAt = iso;
  else if (recordMode.value === 'weight') weightForm.recordedAt = iso;
  else if (recordMode.value === 'supp') suppForm.recordedAt = iso;
  else form.recordedAt = iso;
}

const timePickerTitle = computed(() => {
  if (recordMode.value === 'event') return '选择发生时间';
  if (recordMode.value === 'weight') return '选择称重时间';
  if (recordMode.value === 'supp') return '选择服用时间';
  return '选择用餐时间';
});

// 体重模式：体重和身高至少填一个正数才能保存
function toPositiveNum(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}
const weightValid = computed(
  () => toPositiveNum(weightForm.weight) != null || toPositiveNum(weightForm.height) != null
);

function openTimePicker() {
  const [d, t] = splitDateTime(currentRecordedAt());
  datePicker.value = d;
  timePicker.value = t;
  showTimePicker.value = true;
}

function confirmDateTime() {
  const [Y, Mo, D] = datePicker.value;
  const [H, Mi] = timePicker.value;
  setRecordedAt(new Date(+Y, +Mo - 1, +D, +H, +Mi).toISOString());
  showTimePicker.value = false;
}

// ----- 暂存（仅食物模式） -----

function readDraft() {
  try {
    const raw = localStorage.getItem(draftKey);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || obj.v !== DRAFT_VERSION) return null;
    return obj;
  } catch {
    return null;
  }
}

function applyDraft(d) {
  if (d.form) Object.assign(form, d.form);
  selectedIds.value = new Set((d.selectedIds || []).map(Number));
  Object.keys(amountMap).forEach((k) => delete amountMap[k]);
  Object.entries(d.amountMap || {}).forEach(([k, v]) => {
    amountMap[Number(k)] = v;
  });
}

function restoreDraftIfAny() {
  const d = readDraft();
  if (!d) return;
  applyDraft(d);
  showToast('已加载上次暂存');
}

async function saveDraft() {
  savingDraft.value = true;
  try {
    const data = {
      v: DRAFT_VERSION,
      savedAt: Date.now(),
      form: { ...form },
      selectedIds: Array.from(selectedIds.value),
      amountMap: { ...amountMap },
    };
    localStorage.setItem(draftKey, JSON.stringify(data));
    showSuccessToast('已暂存');
  } finally {
    savingDraft.value = false;
  }
}

function clearDraft() {
  localStorage.removeItem(draftKey);
}

// ----- 业务逻辑 -----

const filteredFoods = computed(() => {
  if (!foodSearch.value.trim()) return [];
  const q = foodSearch.value.trim().toLowerCase();
  return foods.list.filter((f) => f.name.toLowerCase().includes(q));
});

const selectedFoods = computed(() => {
  return foods.list.filter((f) => selectedIds.value.has(f.id));
});

function toggleFood(f) {
  const next = new Set(selectedIds.value);
  if (next.has(f.id)) {
    next.delete(f.id);
    delete amountMap[f.id];
  } else {
    next.add(f.id);
    amountMap[f.id] = amountMap[f.id] ?? 20;
  }
  selectedIds.value = next;
}

async function submit() {
  if (recordMode.value === 'event') {
    submitting.value = true;
    try {
      const payload = {
        kind: 'EVENT',
        recordedAt: eventForm.recordedAt,
        event: {
          // 没标题字段了，title 用类别兜底，保留数据库兼容
          title: eventForm.category,
          category: eventForm.category,
          description: eventForm.description.trim() || undefined,
        },
      };
      if (isEdit.value) {
        await records.update(editRecordId.value, payload);
        showSuccessToast('已更新');
        if (props.embedded) emit('done');
        else router.replace('/timeline');
      } else {
        await records.create(payload);
        showSuccessToast('已记录');
        // 重置 eventForm
        eventForm.description = '';
        eventForm.category = '症状';
        const now = new Date();
        eventForm.recordedAt = now.toISOString();
        const [d, t] = splitDateTime(now.toISOString());
        datePicker.value = d;
        timePicker.value = t;
      }
    } catch (e) {
      showToast(e?.error || e?.message || '保存失败');
    } finally {
      submitting.value = false;
    }
    return;
  }

  // 体重模式
  if (recordMode.value === 'weight') {
    if (!weightValid.value) {
      showToast('请填写体重或身高');
      return;
    }
    submitting.value = true;
    try {
      const payload = {
        kind: 'WEIGHT',
        recordedAt: weightForm.recordedAt,
        note: weightForm.note.trim() || undefined,
        weight: {
          weight: toPositiveNum(weightForm.weight),
          height: toPositiveNum(weightForm.height),
        },
      };
      if (isEdit.value) {
        await records.update(editRecordId.value, payload);
        showSuccessToast('已更新');
        if (props.embedded) emit('done');
        else router.replace('/timeline');
      } else {
        await records.create(payload);
        showSuccessToast('已记录');
        weightForm.weight = '';
        weightForm.height = '';
        weightForm.note = '';
        const now = new Date();
        weightForm.recordedAt = now.toISOString();
        const [d, t] = splitDateTime(now.toISOString());
        datePicker.value = d;
        timePicker.value = t;
      }
    } catch (e) {
      showToast(e?.error || e?.message || '保存失败');
    } finally {
      submitting.value = false;
    }
    return;
  }

  // 补剂模式
  if (recordMode.value === 'supp') {
    if (!suppValid.value) {
      showToast('请至少填写一种补剂名称');
      return;
    }
    submitting.value = true;
    try {
      const payload = {
        kind: 'SUPPLEMENT',
        recordedAt: suppForm.recordedAt,
        note: suppForm.note.trim() || undefined,
        supplement: {
          items: suppItems.value
            .filter((it) => it.name.trim())
            .map((it) => ({
              name: it.name.trim(),
              // 数字 + 单位拼回一个字符串入库（"1粒" / "5ml"）；只选了单位没填数字就只存单位
              dose: it.dose ? `${it.dose}${it.unit || ''}` : (it.unit || ''),
            })),
        },
      };
      if (isEdit.value) {
        await records.update(editRecordId.value, payload);
        showSuccessToast('已更新');
        if (props.embedded) emit('done');
        else router.replace('/timeline');
      } else {
        await records.create(payload);
        showSuccessToast('已记录');
        suppItems.value = [{ name: '', dose: '', unit: '粒' }];
        suppForm.note = '';
        const now = new Date();
        suppForm.recordedAt = now.toISOString();
        const [d, t] = splitDateTime(now.toISOString());
        datePicker.value = d;
        timePicker.value = t;
        fetchRecentSupps();
      }
    } catch (e) {
      showToast(e?.error || e?.message || '保存失败');
    } finally {
      submitting.value = false;
    }
    return;
  }

  // 食物模式
  if (selectedFoods.value.length === 0) {
    showToast('请至少选一个食材');
    return;
  }
  submitting.value = true;
  try {
    const items = selectedFoods.value.map((f) => ({
      foodId: f.id,
      amount: Number(amountMap[f.id]) || 0,
    }));
    const payload = {
      recordedAt: form.recordedAt,
      mealType: form.mealType,
      appetite: form.appetite,
      reaction: form.reaction,
      reactionNote: form.reactionNote || undefined,
      note: form.note || undefined,
      items,
    };

    if (isEdit.value) {
      await records.update(editRecordId.value, payload);
      showSuccessToast('已更新');
      foods.fetchRecent();
      if (props.embedded) emit('done');
      else router.replace('/timeline');
    } else {
      await records.create(payload);
      clearDraft();
      showSuccessToast('已记录');
      selectedIds.value = new Set();
      Object.keys(amountMap).forEach((k) => delete amountMap[k]);
      form.recordedAt = new Date().toISOString();
      form.reaction = '无';
      form.reactionNote = '';
      form.note = '';
      foods.fetchRecent();
    }
  } catch (e) {
    showToast(e.error || '保存失败');
  } finally {
    submitting.value = false;
  }
}

function cancel() {
  if (props.embedded) emit('cancel');
  else router.replace('/timeline');
}
</script>

<style scoped>
.mode-tabs {
  background: white;
  border-bottom: 1px solid var(--bf-border, #ebedf0);
}

/* 数值输入右侧单位（kg / cm） */
.unit-text {
  color: var(--bf-text-secondary);
  font-size: 15px;
}

/* ============ 补剂模式 ============ */
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.supp-add-btn {
  border-radius: 12px;
}

.supp-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}
.supp-row + .supp-row {
  border-top: 1px solid #f5f6f8;
}
.supp-row .supp-name {
  flex: 1.4;
  padding: 6px 8px;
  background: #f7f8fa;
  border-radius: 8px;
}
.supp-row .supp-dose {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  background: #f7f8fa;
  border-radius: 8px;
}

/* 单位按钮：显示当前单位，点击弹选择层 */
.supp-unit {
  flex-shrink: 0;
  min-width: 44px;
  padding: 7px 8px;
  border: none;
  background: #e8f3ff;
  color: var(--bf-primary, #1989fa);
  font-size: 14px;
  border-radius: 8px;
  cursor: pointer;
  text-align: center;
  -webkit-tap-highlight-color: transparent;
}

/* 单位选择弹层 */
.unit-picker {
  padding: 20px 16px calc(16px + env(safe-area-inset-bottom));
}
.unit-picker-title {
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 14px;
}
.unit-picker-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.unit-chip {
  flex: 1 0 calc(20% - 8px);
  min-width: calc(20% - 8px);
  padding: 10px 0;
  border: 1px solid var(--bf-border, #ebedf0);
  background: #f7f8fa;
  border-radius: 10px;
  font-size: 15px;
  color: var(--bf-text);
  cursor: pointer;
  text-align: center;
  -webkit-tap-highlight-color: transparent;
}
.unit-chip.active {
  background: var(--bf-primary, #1989fa);
  border-color: var(--bf-primary, #1989fa);
  color: #fff;
}
.unit-picker-footer {
  margin-top: 16px;
}

.supp-remove {
  flex-shrink: 0;
  font-size: 19px;
  color: #c8c9cc;
  cursor: pointer;
}

.supp-quick {
  margin-top: 10px;
}
.supp-quick-label {
  font-size: 13px;
  color: var(--bf-text-secondary);
  margin-bottom: 6px;
}
.supp-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.supp-chip {
  border: 1px solid var(--bf-border, #ebedf0);
  background: #f7f8fa;
  padding: 5px 14px;
  border-radius: 14px;
  font-size: 14px;
  color: var(--bf-text);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.supp-chip:active {
  background: #e8f3ff;
  border-color: #1989fa;
}

/* 字段下方的校验提示 */
.field-hint {
  font-size: 13px;
  color: var(--bf-text-secondary);
  padding: 8px 16px 0;
}

.search-hint {
  text-align: center;
  color: var(--bf-text-secondary);
  font-size: 14px;
  padding: 20px 0 4px;
}

.empty-tip {
  text-align: center;
  color: var(--bf-text-secondary);
  font-size: 14px;
  padding: 16px 0 4px;
}

.search-results {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 8px;
  padding: 4px 0 0;
}

.recent-block {
  padding: 0 0 8px;
}

.recent-label {
  font-size: 13px;
  color: var(--bf-text-secondary);
  padding: 0 4px 6px;
}

.recent-divider {
  height: 1px;
  background: var(--bf-border);
  margin: 12px 0 4px;
}

.selected-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.selected-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #f7f8fa;
  border-radius: 8px;
}

.selected-item .emoji { font-size: 21px; }
.selected-item .name { flex: 1; }

.selected-item .amount {
  display: flex;
  align-items: center;
  gap: 2px;
  background: #fff;
  border: 1px solid var(--bf-border);
  border-radius: 6px;
  padding: 2px 6px;
}

.selected-item .amount-input {
  width: 56px;
  border: none;
  outline: none;
  text-align: right;
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  background: transparent;
  -moz-appearance: textfield;
}

.selected-item .amount-input::-webkit-outer-spin-button,
.selected-item .amount-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.selected-item .unit {
  font-size: 13px;
  color: var(--bf-text-secondary);
}

.swipe-btn { height: 100%; }

.submit-bar { padding: 16px; }

.submit-row {
  display: flex;
  gap: 12px;
}

.submit-row .submit-half {
  flex: 1;
}

/* 自定义日期时间选择器 */
.datetime-picker {
  background: #fff;
}

.dp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--bf-border, #ebedf0);
}

.dp-btn {
  font-size: 16px;
  padding: 4px 8px;
  cursor: pointer;
  user-select: none;
}

.dp-cancel {
  color: var(--bf-text-secondary, #969799);
}

.dp-confirm {
  color: var(--van-primary-color, #1989fa);
  font-weight: 500;
}

.dp-title {
  font-size: 17px;
  font-weight: 500;
  color: var(--van-text-color, #323233);
}
</style>
