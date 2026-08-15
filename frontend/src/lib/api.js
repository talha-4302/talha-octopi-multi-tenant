import { ERROR_CODE } from './constants.js';

const BASE = import.meta.env.VITE_API_URL;

// The access token lives in memory only. Putting it in localStorage would
// expose it to any injected script; the refresh cookie is httpOnly and is
// what survives a reload.
let accessToken = null;
let onUnauthenticated = () => {};

export const setAccessToken = (token) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;
export const setUnauthenticatedHandler = (fn) => {
  onUnauthenticated = fn;
};

export class ApiError extends Error {
  constructor({ status, code, message, fields }) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

async function toError(res) {
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* empty or non JSON body */
  }
  return new ApiError({
    status: res.status,
    code: body?.error?.code ?? ERROR_CODE.INTERNAL,
    message: body?.error?.message ?? 'Something went wrong.',
    fields: body?.error?.fields,
  });
}

async function raw(path, { method = 'GET', body, signal } = {}) {
  return fetch(`${BASE}${path}`, {
    method,
    signal,
    credentials: 'include', // required for the refresh cookie
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

// A single in-flight refresh, shared by every caller that hits a 401 at once.
// Without this, five parallel queries would rotate the refresh token five times
// and four of them would trip the reuse detector.
let refreshing = null;

async function refresh() {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json();
      accessToken = data.accessToken;
      return data;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function request(path, options = {}) {
  let res = await raw(path, options);

  // TOKEN_EXPIRED is the ONLY code that triggers a retry. A 403, or a 401 from
  // bad credentials, must not spend a refresh token.
  if (res.status === 401) {
    const err = await toError(res.clone());
    if (err.code === ERROR_CODE.TOKEN_EXPIRED) {
      const refreshed = await refresh();
      if (refreshed) res = await raw(path, options);
      else {
        onUnauthenticated();
        throw err;
      }
    }
  }

  if (!res.ok) throw await toError(res);
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  del: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
};
