// web/src/router/index.js
import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  { path: '/', name: 'record', component: () => import('../views/QuickRecord.vue'), meta: { title: '记录' } },
  { path: '/timeline', name: 'timeline', component: () => import('../views/Timeline.vue'), meta: { title: '时间线' } },
  { path: '/records/:id/edit', name: 'record-edit', component: () => import('../views/QuickRecord.vue'), meta: { title: '编辑记录' } },
  { path: '/foods', name: 'foods', component: () => import('../views/Foods.vue'), meta: { title: '食材库' } },
  { path: '/stats', name: 'stats', component: () => import('../views/Stats.vue'), meta: { title: '统计' } },
  { path: '/ai', name: 'ai', component: () => import('../views/AIChat.vue'), meta: { title: '问AI' } },
];

export default createRouter({
  // hash 模式：URL 带 #（如 /#/timeline），部署时无需服务端 rewrite 兜底
  history: createWebHashHistory(),
  routes,
});