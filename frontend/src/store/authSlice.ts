import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { canAccessAdminArea, hasAnyPermission, hasPermission } from '../auth/rbac';
import { API_BASE_URL } from '../config/api';
const AUTH_STORAGE_KEY = 'kanban-auth-token';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  /** Canonical role key (e.g. admin, member). */
  roleKey: string;
  /** Alias of roleKey for backward compatibility. */
  role: string;
  permissions: string[];
  status?: 'active' | 'inactive';
  phone?: string;
  lastLoginAt?: string | null;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

const getInitialToken = () => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(AUTH_STORAGE_KEY);
};

const initialState: AuthState = {
  token: getInitialToken(),
  user: null,
  loading: false,
  error: null,
};

function normalizeAuthUser(raw: unknown): AuthUser {
  const u = raw as Partial<AuthUser> & { id?: string; name?: string; email?: string };
  const rk = u.roleKey ?? u.role ?? 'member';
  return {
    id: u.id ?? '',
    name: u.name ?? '',
    email: u.email ?? '',
    roleKey: rk,
    role: rk,
    permissions: Array.isArray(u.permissions) ? u.permissions : [],
    status: u.status,
    phone: u.phone,
    lastLoginAt: u.lastLoginAt ?? null,
  };
}

export const signup = createAsyncThunk<
  { token: string; user: AuthUser },
  { name: string; email: string; password: string }
>('auth/signup', async (payload) => {
  const response = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Signup failed (${response.status})`);
  }
  return (await response.json()) as { token: string; user: AuthUser };
});

export const login = createAsyncThunk<
  { token: string; user: AuthUser },
  { email: string; password: string }
>('auth/login', async (payload) => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Login failed (${response.status})`);
  }
  return (await response.json()) as { token: string; user: AuthUser };
});

export const fetchMe = createAsyncThunk<AuthUser, void, { state: { auth: AuthState } }>(
  'auth/fetchMe',
  async (_arg, { getState }) => {
    const token = getState().auth.token;
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(body.message ?? `Auth check failed (${response.status})`);
    }

    const data = (await response.json()) as { user: AuthUser };
    return data.user;
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuthError: (state) => {
      state.error = null;
    },
    logout: (state) => {
      state.token = null;
      state.user = null;
      state.error = null;
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signup.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signup.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = normalizeAuthUser(action.payload.user);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(AUTH_STORAGE_KEY, action.payload.token);
        }
      })
      .addCase(signup.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Signup failed';
      })
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = normalizeAuthUser(action.payload.user);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(AUTH_STORAGE_KEY, action.payload.token);
        }
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Login failed';
      })
      .addCase(fetchMe.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.loading = false;
        state.user = normalizeAuthUser(action.payload);
      })
      .addCase(fetchMe.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Authentication failed';
        state.token = null;
        state.user = null;
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      });
  },
});

export const { clearAuthError, logout } = authSlice.actions;
export const authReducer = authSlice.reducer;
export const selectAuthToken = (state: { auth: AuthState }) => state.auth.token;
export const selectAuthUser = (state: { auth: AuthState }) => state.auth.user;
export const selectAuthPermissions = (state: { auth: AuthState }) => state.auth.user?.permissions ?? [];
/** @deprecated Prefer permission checks; kept for legacy call sites. */
export const selectIsAdmin = (state: { auth: AuthState }) =>
  state.auth.user?.roleKey === 'admin' || state.auth.user?.role === 'admin';
export const selectCanAccessAdminArea = (state: { auth: AuthState }) =>
  canAccessAdminArea(state.auth.user?.permissions);
export const selectHasPermission = (key: string) => (state: { auth: AuthState }) =>
  hasPermission(state.auth.user?.permissions, key);
export const selectHasAnyPermission = (keys: string[]) => (state: { auth: AuthState }) =>
  hasAnyPermission(state.auth.user?.permissions, keys);
export const selectAuthLoading = (state: { auth: AuthState }) => state.auth.loading;
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error;
