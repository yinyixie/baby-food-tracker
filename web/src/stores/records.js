// web/src/stores/records.js
import { defineStore } from 'pinia';
import api from '../api/client';

export const useRecordsStore = defineStore('records', {
  state: () => ({
    list: [],
    total: 0,
    loading: false,
  }),

  actions: {
    // append=true 时把结果追加到列表尾部（分页「加载更多」用），否则整体替换
    async fetch(params = {}, { append = false } = {}) {
      this.loading = true;
      try {
        const res = await api.get('/records', { params });
        this.list = append ? [...this.list, ...res.records] : res.records;
        this.total = res.total;
      } finally {
        this.loading = false;
      }
    },

    async create(payload) {
      const record = await api.post('/records', payload);
      this.list.unshift(record);
      this.total += 1;
      return record;
    },

    async update(id, payload) {
      const record = await api.put(`/records/${id}`, payload);
      const idx = this.list.findIndex((r) => r.id === id);
      if (idx >= 0) this.list[idx] = record;
      return record;
    },

    async remove(id) {
      await api.delete(`/records/${id}`);
      this.list = this.list.filter((r) => r.id !== id);
      this.total -= 1;
    },
  },
});