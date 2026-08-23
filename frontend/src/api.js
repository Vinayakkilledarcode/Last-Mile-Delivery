const BASE = '/api';

// sessionStorage is scoped per browser tab (unlike localStorage, which is
// shared across every tab on the same origin). That means you can be logged
// in as a customer in one tab and an agent in another without one login
// silently overwriting the other.
function getToken() {
  return sessionStorage.getItem('lm_token');
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new Error(data?.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (payload) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  me: () => request('/users/me'),
  customers: (search) => request(`/users/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),

  zones: () => request('/zones'),
  createZone: (name) => request('/zones', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteZone: (id) => request(`/zones/${id}`, { method: 'DELETE' }),
  addArea: (zoneId, name) => request(`/zones/${zoneId}/areas`, { method: 'POST', body: JSON.stringify({ name }) }),
  deleteArea: (areaId) => request(`/zones/areas/${areaId}`, { method: 'DELETE' }),

  rateCards: () => request('/rate-cards'),
  updateRateCard: (payload) => request('/rate-cards', { method: 'PUT', body: JSON.stringify(payload) }),
  updateCodSurcharge: (payload) => request('/rate-cards/cod-surcharge', { method: 'PUT', body: JSON.stringify(payload) }),

  agents: () => request('/agents'),
  updateAvailability: (id, payload) => request(`/agents/${id}/availability`, { method: 'PATCH', body: JSON.stringify(payload) }),

  quote: (payload) => request('/orders/quote', { method: 'POST', body: JSON.stringify(payload) }),
  createOrder: (payload) => request('/orders', { method: 'POST', body: JSON.stringify(payload) }),
  listOrders: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request(`/orders${qs ? `?${qs}` : ''}`);
  },
  getOrder: (id) => request(`/orders/${id}`),
  assignOrder: (id, agentId) => request(`/orders/${id}/assign`, { method: 'POST', body: JSON.stringify(agentId ? { agentId } : {}) }),
  updateStatus: (id, status, note) => request(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, note }) }),
  reschedule: (id, newDate) => request(`/orders/${id}/reschedule`, { method: 'POST', body: JSON.stringify({ newDate }) }),
  availableOrders: () => request('/orders/available'),
  claimOrder: (id) => request(`/orders/${id}/claim`, { method: 'POST' }),
};

export function saveSession(token, user) {
  sessionStorage.setItem('lm_token', token);
  sessionStorage.setItem('lm_user', JSON.stringify(user));
}

export function clearSession() {
  sessionStorage.removeItem('lm_token');
  sessionStorage.removeItem('lm_user');
}

export function getSession() {
  const token = getToken();
  const userRaw = sessionStorage.getItem('lm_user');
  if (!token || !userRaw) return null;
  try {
    return { token, user: JSON.parse(userRaw) };
  } catch {
    return null;
  }
}
