<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="title">{{ pageTitle }}</div>
    </header>

    <main class="page-container">
      <router-view />
    </main>

    <!-- placeholder：在文档流里撑起与 tabbar 等高（含安全区）的占位，防止内容被固定 tabbar 遮挡 -->
    <van-tabbar v-model="activeTab" route safe-area-inset-bottom placeholder>
      <van-tabbar-item to="/" icon="edit">记录</van-tabbar-item>
      <van-tabbar-item to="/timeline" icon="clock-o">时间线</van-tabbar-item>
      <van-tabbar-item to="/ai" icon="service-o">问AI</van-tabbar-item>
      <van-tabbar-item to="/foods" icon="apps-o">食材库</van-tabbar-item>
      <van-tabbar-item to="/stats" icon="chart-trending-o">统计</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const activeTab = ref(0);

const pageTitle = computed(() => route.meta.title || '宝宝辅食');
</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px 16px;
  background: white;
  border-bottom: 1px solid var(--bf-border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.app-header .title {
  font-size: 18px;
  font-weight: 600;
}
</style>