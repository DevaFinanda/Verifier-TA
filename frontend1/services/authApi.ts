/**
 * Auth API Service
 * Calls POST /api/auth/login and POST /api/auth/logout on the backend.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://202.155.132.71:3002';

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    fasikesName?: string;
  };
}

export class AuthApiError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'AuthApiError';
  }
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const json = await res.json();

  if (!res.ok) {
    throw new AuthApiError(
      json?.message || 'Login gagal. Periksa email dan password.',
      res.status,
    );
  }

  const data: LoginResponse = json?.data ?? json;
  return data;
}

export async function logout(): Promise<void> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (!token) return;

  await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  }).catch(() => {/* ignore network errors on logout */});
}
