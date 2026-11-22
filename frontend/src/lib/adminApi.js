import api from './api.js';

export const adminApi = {
  getStats: () => api.get('/admin/stats'),
  getFinancialSummary: (params) => api.get('/admin/finance/summary', { params }),
  listFinancialJournals: (params) => api.get('/admin/finance/journals', { params }),
  listFinancialPayouts: (params) => api.get('/admin/finance/payouts', { params }),
  listProviderEvents: (params) => api.get('/admin/finance/events', { params }),
  listRestaurants: (params) => api.get('/admin/restaurants', { params }),
  setRestaurantApproval: (id, status) => api.patch(`/admin/restaurants/${id}/approval`, { status }),
  listRiders: (params) => api.get('/admin/riders', { params }),
  setRiderApproval: (id, status) => api.patch(`/admin/riders/${id}/approval`, { status }),
  listUsers: (params) => api.get('/admin/users', { params }),
  setUserSuspension: (id, suspended) => api.patch(`/admin/users/${id}/suspend`, { suspended }),
  listOrders: (params) => api.get('/admin/orders', { params }),
  sendBroadcast: (payload) => api.post('/admin/broadcast', payload),
  listDeliveryZones: () => api.get('/admin/delivery-zones'),
  saveDeliveryZone: (state, payload) => api.put(`/admin/delivery-zones/${encodeURIComponent(state)}`, payload),
  setInterstateDelivery: (enabled) => api.patch('/admin/delivery-settings/interstate', { enabled }),
};
