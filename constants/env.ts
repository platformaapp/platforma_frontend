export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://91.229.9.117:3000';

export const endpoints = {
  register: `${API_BASE}/api/auth/register`,
  login: `${API_BASE}/api/auth/login`,
  users: `${API_BASE}/api/users`,
};


