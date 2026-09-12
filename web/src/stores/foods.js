// web/src/stores/foods.js
import { defineStore } from 'pinia';
import api from '../api/client';

export const useFoodsStore = defineStore('foods', {
  state: () => ({
    list: [],
    recent: [],
    loading: false,
  }),

  getters: {
    byCategory(state) {
      const map = {};
      state.list.forEach((f) => {
        if (!map[f.category]) map[f.category] = [];
        map[f.category].push(f);
      });
      return map;
    },
  },

  actions: {
    async fetch(category) {
      this.loading = true;
      try {
        const params = category ? { category } : {};
        const data = await api.get('/foods', { params });
        this.list = data;
      } finally {
        this.loading = false;
      }
    },

    async fetchRecent(limit = 8) {
      try {
        this.recent = await api.get('/foods/recent', { params: { limit } });
      } catch (e) {
        // 最近记录查询失败不阻塞页面
        this.recent = [];
      }
    },

    async create(payload) {
      const food = await api.post('/foods', payload);
      this.list.push(food);
      return food;
    },

    async update(id, payload) {
      const food = await api.put(`/foods/${id}`, payload);
      const idx = this.list.findIndex((f) => f.id === id);
      if (idx >= 0) this.list[idx] = food;
      return food;
    },

    async remove(id) {
      // 后端返回 { ok, mode: 'deleted' | 'archived', usedCount }
      const res = await api.delete(`/foods/${id}`);
      this.list = this.list.filter((f) => f.id !== id);
      this.recent = this.recent.filter((f) => f.id !== id);
      return res;
    },
  },
});