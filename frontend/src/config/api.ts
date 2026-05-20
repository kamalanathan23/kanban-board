/**
 * API base for fetch(). In dev, default `/api` is proxied by Vite to the backend (same-origin, reliable Authorization headers).
 * Override with VITE_API_BASE_URL e.g. `http://localhost:4000/api` if you run without the proxy.
 */
const envUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
export const API_BASE_URL = envUrl ? envUrl.replace(/\/$/, '') : '/api';

/** Socket.IO server: same origin when using Vite proxy; full URL when API is cross-origin. */
export function getSocketOrigin(): string | undefined {
  if (envUrl?.startsWith('http')) {
    try {
      return new URL(envUrl).origin;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
