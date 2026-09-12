// web/src/baby.js
// 宝宝出生时间与月龄（后端 /api/baby/info，来源环境变量 BABY_BIRTH）。
// 模块级单例：多个页面共享一次请求结果。
import { ref } from 'vue';
import api from './api/client';

export const babyInfo = ref(null);

let loaded = false;

export async function loadBaby() {
  if (loaded) return;
  loaded = true;
  try {
    const data = await api.get('/baby/info');
    if (data?.birth) babyInfo.value = data;
  } catch (e) {
    // 未配置 BABY_BIRTH 或网络异常：不展示月龄，不影响主流程
  }
}
