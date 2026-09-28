import supabase from '../lib/supabase';
import API_URL from '../lib/config';

/**
 * Universal authenticated API fetch helper.
 * - Injects Authorization: Bearer <token> from active Supabase session
 * - Injects Content-Type: application/json when body is present
 * - Parses JSON response
 * - Throws descriptive Error with .status on failure
 */
export async function apiFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();

  const headers = { ...(options.headers || {}) };

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  let body = options.body;
  if (
    body !== undefined &&
    body !== null &&
    typeof body === 'object' &&
    !(body instanceof FormData)
  ) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  } else if (body !== undefined && body !== null && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const cleanBase = (API_URL || '').replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${cleanBase}${cleanPath}`;

  const response = await fetch(url, {
    ...options,
    headers,
    body,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data && data.error ? data.error : `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export function apiGet(path, options = {}) {
  return apiFetch(path, { ...options, method: 'GET' });
}

export function apiPost(path, body, options = {}) {
  return apiFetch(path, { ...options, method: 'POST', body });
}

export function apiPatch(path, body, options = {}) {
  return apiFetch(path, { ...options, method: 'PATCH', body });
}

export default apiFetch;
