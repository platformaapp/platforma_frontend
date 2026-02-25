export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://194.67.88.237';

export const endpoints = {
  register: `${API_BASE}/api/auth/register`,
  login: `${API_BASE}/api/auth/login`,
  forgotPassword: `${API_BASE}/api/auth/forgot`,
  users: `${API_BASE}/api/users`,
  studentPayments: `${API_BASE}/api/student/payments`,
  studentPaymentsCallback: `${API_BASE}/api/student/payments/callback`,
  studentPaymentMethods: `${API_BASE}/api/student/payment-methods`,
  studentPaymentMethodsBind: `${API_BASE}/student/payment-methods/bind`,
  paymentsMethod: `${API_BASE}/api/payments/method`,
  studentPaymentMethodsLegacy: `${API_BASE}/api/student/payment-methods`,
  paymentMethodsCallback: `${API_BASE}/api/payments/callback`,
  paymentMethodsCallbackLegacy: `${API_BASE}/payments/callback`,
  switchRole: `${API_BASE}/auth/switch-role`,

  // Tutor (Наставник) — профиль, слоты, события, платежи
  tutorProfile: `${API_BASE}/api/tutor/profile`,
  tutorSlots: `${API_BASE}/api/tutor/slots`,
  tutorEvents: `${API_BASE}/api/tutor/events`,
  tutorPayments: `${API_BASE}/api/tutor/payments`,
  tutorPaymentsSummary: `${API_BASE}/api/tutor/payments/summary`,

  // Events (события) — POST /api/events, PATCH, GET, DELETE, register
  events: `${API_BASE}/api/events`,
};
