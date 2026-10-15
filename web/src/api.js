export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// One place for fetch conventions: JSON in/out, same-origin cookies, errors become ApiError.
async function request(method, path, { body, signal } = {}) {
  const headers = body ? { 'content-type': 'application/json' } : undefined;
  const res = await fetch(path, { method, signal, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 204 || res.status === 202) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`, data.details);
  return data;
}

const qs = (query) => new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null && v !== 0 && v !== false)).toString();

export const api = {
  searchListings: (query, signal) => request('GET', `/api/listings?${qs(query)}`, { signal }),
  byIds: (ids, signal) => request('GET', `/api/listings/batch?ids=${ids.map(encodeURIComponent).join(',')}`, { signal }),
  listing: (id, signal) => request('GET', `/api/listings/${encodeURIComponent(id)}`, { signal }),
  similar: (id, signal) => request('GET', `/api/listings/${encodeURIComponent(id)}/similar`, { signal }),
  market: (signal) => request('GET', '/api/market', { signal }),
  me: () => request('GET', '/api/auth/me'),
  login: (body) => request('POST', '/api/auth/login', { body }),
  register: (body) => request('POST', '/api/auth/register', { body }),
  logout: () => request('POST', '/api/auth/logout', { body: {} }),
  favoriteIds: () => request('GET', '/api/me/favorites'),
  favoriteListings: (signal) => request('GET', '/api/me/favorites/listings', { signal }),
  addFavorite: (id) => request('PUT', `/api/me/favorites/${encodeURIComponent(id)}`, { body: {} }),
  removeFavorite: (id) => request('DELETE', `/api/me/favorites/${encodeURIComponent(id)}`),
  savedSearches: (signal) => request('GET', '/api/me/saved-searches', { signal }),
  saveSearch: (body) => request('POST', '/api/me/saved-searches', { body }),
  setSearchAlerts: (id, alerts) => request('PATCH', `/api/me/saved-searches/${id}`, { body: { alerts } }),
  deleteSearch: (id) => request('DELETE', `/api/me/saved-searches/${id}`),
  inquiry: (body) => request('POST', '/api/inquiries', { body }),
  tour: (body) => request('POST', '/api/tours', { body }),
  offer: (body) => request('POST', '/api/offers', { body }),
  approveFinancing: (id) => request('POST', `/api/offers/${id}/approve-financing`, { body: {} }),
  activity: (signal) => request('GET', '/api/me/activity', { signal }),
};
