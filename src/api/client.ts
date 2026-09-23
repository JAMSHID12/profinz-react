import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import type { ApiResponse, AuthResponse, SessionUser } from '../types';

const ACCESS_TOKEN_KEY = 'tmp.accessToken';
const REFRESH_TOKEN_KEY = 'tmp.refreshToken';
const USER_KEY = 'tmp.user';

export const tokenStore = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  getUser: (): SessionUser | null => {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionUser;
    } catch {
      return null;
    }
  },
  save: (auth: AuthResponse) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, auth.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, auth.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
  },
  saveUser: (user: SessionUser) => localStorage.setItem(USER_KEY, JSON.stringify(user)),
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = tokenStore.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Fired when the session can no longer be recovered so the app can show the login screen. */
export const SESSION_EXPIRED_EVENT = 'tmp:session-expired';

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStore.getRefreshToken();
  if (!refreshToken) return null;
  try {
    const response = await axios.post<ApiResponse<AuthResponse>>(
      `${http.defaults.baseURL}/auth/refresh`,
      { refreshToken },
      { headers: { 'Content-Type': 'application/json' } },
    );
    tokenStore.save(response.data.data);
    return response.data.data.accessToken;
  } catch {
    return null;
  }
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const original = error.config as AxiosRequestConfig & { _retried?: boolean };
    const isAuthCall = original?.url?.includes('/auth/login') || original?.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;
      // Only one refresh runs even when several requests fail at once.
      refreshInFlight = refreshInFlight ?? refreshAccessToken();
      const token = await refreshInFlight;
      refreshInFlight = null;
      if (token) {
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
        return http.request(original);
      }
      tokenStore.clear();
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  },
);

/** Extracts the backend message from any failure so screens can show something useful. */
export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  const axiosError = error as AxiosError<ApiResponse<unknown>>;
  const data = axiosError?.response?.data;
  if (data?.errors && Object.keys(data.errors).length > 0) {
    return Object.values(data.errors)[0];
  }
  if (data?.message) return data.message;
  if (axiosError?.message === 'Network Error') return 'Cannot reach the server';
  return fallback;
}

/** Field-level validation messages from a 400 response, keyed by request field. */
export function fieldErrors(error: unknown): Record<string, string> {
  return (error as AxiosError<ApiResponse<unknown>>)?.response?.data?.errors ?? {};
}

type Params = Record<string, string | number | boolean | null | undefined>;

/** Drops empty filter values so they are not sent as "?batchId=". */
function clean(params?: Params): Params | undefined {
  if (!params) return undefined;
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

export async function get<T>(url: string, params?: Params): Promise<T> {
  const response = await http.get<ApiResponse<T>>(url, { params: clean(params) });
  return response.data.data;
}

export async function post<T>(url: string, body?: unknown, params?: Params): Promise<T> {
  const response = await http.post<ApiResponse<T>>(url, body ?? {}, { params: clean(params) });
  return response.data.data;
}

export async function put<T>(url: string, body?: unknown, params?: Params): Promise<T> {
  const response = await http.put<ApiResponse<T>>(url, body ?? {}, { params: clean(params) });
  return response.data.data;
}
