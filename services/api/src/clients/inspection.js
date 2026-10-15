import { HttpError } from '../errors.js';

// Failures talking to the Java service: translate network problems into honest HTTP statuses.
function translate(err) {
  if (err instanceof HttpError) return err;
  if (err.name === 'TimeoutError') return new HttpError(504, 'The booking service took too long');
  return new HttpError(503, 'The booking service is unavailable');
}

async function post(fetchImpl, url, form, timeoutMs) {
  const res = await fetchImpl(url, { method: 'POST', body: new URLSearchParams(form), signal: AbortSignal.timeout(timeoutMs) });
  const data = await res.json().catch(() => ({}));
  if (res.ok) return data;
  throw new HttpError(res.status >= 500 ? 502 : res.status, data.error ?? 'Booking failed');
}

// Service-to-service REST call with a timeout (never wait forever on a dependency).
export function makeInspectionClient({ baseUrl, fetchImpl = fetch, timeoutMs = 3000 }) {
  return {
    book: async ({ listingId, date, userId }) => {
      const form = { listingId, date, ...(userId ? { userId } : {}) };
      return post(fetchImpl, `${baseUrl}/inspections`, form, timeoutMs).catch((e) => { throw translate(e); });
    },
  };
}
