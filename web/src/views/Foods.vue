<template>
  <div class="foods-page">
    <div class="card-block search-bar">
      <van-search v-model="search" placeholder="搜索食材" shape="round" class="search-input" />
      <van-icon name="add" class="add-icon" @click="openCreate()" />
    </div>

    <van-tabs v-model:active="activeCategory" sticky offset-top="53" @change="onTabChange">
      <van-tab v-for="cat in categories" :key="cat" :title="cat" :name="cat" />
    </van-tabs>

    <div v-if="filtered.length === 0" class="empty-state">
      <p v-if="foods.list.length === 0">还没有食材</p>
      <p v-else>没有匹配的食材</p>
      <van-button type="primary" size="small" @click="openCreate()">
        添加食材
      </van-button>
    </div>

    <div v-else class="foods-grid card-block">
      <van-swipe-cell v-for="f in filtered" :key="f.id">
        <div class="food-item" @click="openEdit(f)">
          <span class="emoji">{{ f.emoji }}</span>
          <span class="name">{{ f.name }}</span>
          <span class="cat-tag">{{ f.category }}</span>
          <van-icon name="edit" class="edit-hint" />
        </div>
        <template #right>
          <van-button square type="danger" text="删除" class="swipe-btn" @click="onDelete(f)" />
        </template>
      </van-swipe-cell>
    </div>

    <!-- 创建/编辑弹窗 -->
    <van-popup v-model:show="editorVisible" position="bottom" round :style="{ height: '70%' }">
      <div class="editor">
        <div class="editor-title">{{ editing ? '编辑食材' : '添加食材' }}</div>

        <van-cell-group inset>
          <van-field v-model="form.name" label="名称" placeholder="如：西兰花" />
          <van-field label="分类" readonly is-link @click="showCategoryPicker = true">
            <template #input>{{ form.category || '请选择' }}</template>
          </van-field>
          <van-field v-model="form.emoji" label="图标" placeholder="emoji 或留空" />
          <van-field label="单位">
            <template #input>
              <van-radio-group v-model="form.unit" direction="horizontal">
                <van-radio name="g">g（重量）</van-radio>
                <van-radio name="ml">ml（容量）</van-radio>
              </van-radio-group>
            </template>
          </van-field>
        </van-cell-group>

        <div class="editor-actions">
          <van-button block @click="editorVisible = false">取消</van-button>
          <van-button block type="primary" :loading="saving" @click="save">保存</van-button>
        </div>
      </div>
    </van-popup>

    <!-- 分类选择：独立底部弹层（picker 的 columns 必须是 { text, value } 对象数组） -->
    <van-popup v-model:show="showCategoryPicker" position="bottom" round teleport="body">
      <van-picker
        title="选择分类"
        :columns="categoryOptions"
        @confirm="onPickCategory"
        @cancel="showCategoryPicker = false"
      />
    </van-popup>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { showToast, showConfirmDialog, showSuccessToast } from 'vant';
import { useFoodsStore } from '../stores/foods';

const foods = useFoodsStore();

const categories = ['全部', '主食', '蔬菜', '水果', '肉类', '蛋奶', '其他'];
const activeCategory = ref('全部');
const search = ref('');

// van-picker 的 columns 必须是 { text, value } 对象数组（传字符串会在 Vant 内部抛
// "Cannot use 'in' operator to search for 'children'"）；「全部」是筛选伪分类，不列出
const categoryOptions = computed(() =>
  categories.filter((c) => c !== '全部').map((c) => ({ text: c, value: c }))
);

const editorVisible = ref(false);
const editing = ref(null);
const saving = ref(false);
const showCategoryPicker = ref(false);

const form = reactive({ name: '', category: '', emoji: '', unit: 'g' });

const filtered = computed(() => {
  let list = foods.list;
  if (activeCategory.value !== '全部') {
    list = list.filter((f) => f.category === activeCategory.value);
  }
  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase();
    list = list.filter((f) => f.name.toLowerCase().includes(q));
  }
  return list;
});

function openCreate() {
  editing.value = null;
  form.name = '';
  form.category = activeCategory.value !== '全部' ? activeCategory.value : '';
  form.emoji = '';
  form.unit = 'g';
  editorVisible.value = true;
}

function openEdit(f) {
  editing.value = f;
  form.name = f.name || '';
  form.category = f.category || '';
  form.emoji = f.emoji || '';
  form.unit = f.unit === 'ml' ? 'ml' : 'g';
  editorVisible.value = true;
}

function onPickCategory({ selectedValues }) {
  form.category = selectedValues[0] || '';
  showCategoryPicker.value = false;
}

async function save() {
  const name = form.name.trim();
  const category = form.category;
  if (!name || !category) {
    showToast('请填名称和分类');
    return;
  }
  const emoji = form.emoji || '🍽️'; // 与后端兜底一致，保存后立即看到的图标就是最终图标
  const unit = form.unit === 'ml' ? 'ml' : 'g';
  saving.value = true;
  try {
    if (editing.value) {
      await foods.update(editing.value.id, { name, category, emoji, unit });
      showSuccessToast('已更新');
    } else {
      await foods.create({ name, category, emoji, unit });
      showSuccessToast('已添加');
    }
    editorVisible.value = false;
  } catch (e) {
    showToast(e.error || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function onDelete(f) {
  try {
    await showConfirmDialog({
      title: `删除 ${f.name}？`,
      message: '如果它还没被任何记录用过，会直接删掉；用过的会从食材库隐藏、但保留在历史记录里。',
      confirmButtonText: '删除',
    });
  } catch (e) {
    return; // 用户取消
  }
  try {
    const res = await foods.remove(f.id);
    showToast(res?.mode === 'archived' ? '已从食材库移除（历史记录保留）' : '已删除');
  } catch (e) {
    showToast(e?.error || '删除失败');
  }
}

onMounted(() => {
  if (foods.list.length === 0) foods.fetch();
});
</script>

<style scoped>
.search-bar {
  padding: 4px 8px 4px 0;
  display: flex;
  align-items: center;
}

/* 搜索框占满剩余宽度，右侧加号图标新增食材 */
.search-input {
  flex: 1;
  min-width: 0;
}

.add-icon {
  flex-shrink: 0;
  font-size: 25px;
  color: var(--bf-primary, #1989fa);
  padding: 8px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.foods-grid {
  padding: 4px;
}

.food-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid var(--bf-border);
  cursor: pointer;
}

.food-item:last-child {
  border-bottom: none;
}

.food-item .emoji {
  font-size: 23px;
  width: 32px;
  text-align: center;
}

/* 轻量编辑提示：常驻浅灰，点整行进编辑 */
.edit-hint {
  color: #dcdee0;
  font-size: 17px;
  flex-shrink: 0;
}

.food-item .name {
  flex: 1;
  font-size: 16px;
}

.cat-tag {
  font-size: 12px;
  padding: 2px 8px;
  background: #f0f4fa;
  color: var(--bf-text-secondary);
  border-radius: 10px;
}

.swipe-btn {
  height: 100%;
}

.editor {
  padding: 20px 0;
}

.editor-title {
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
}

.editor-actions {
  display: flex;
  gap: 12px;
  padding: 16px;
  margin-top: 12px;
}
</style>