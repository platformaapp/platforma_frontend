export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://194.67.88.237';

export const endpoints = {
  register: `${API_BASE}/api/auth/register`,
  login: `${API_BASE}/api/auth/login`,
  forgotPassword: `${API_BASE}/api/auth/forgot`,
  users: `${API_BASE}/api/users`,
  studentPayments: `${API_BASE}/api/student/payments`,
  studentPaymentsCallback: `${API_BASE}/api/student/payments/callback`,
  bindPaymentMethod: `${API_BASE}/api/student/payment-methods/bind`,
  switchRole: `${API_BASE}/api/auth/switch-role`,
};


