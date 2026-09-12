// web/src/api/client.js
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    console.error('[api error]', err.response?.data || err.message);
    return Promise.reject(err.response?.data || { error: err.message });
  },
);

export default api;