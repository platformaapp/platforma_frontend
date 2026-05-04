export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'https://platformaapp.ru';

export const endpoints = {
  register: `${API_BASE}/api/auth/register`,
  login: `${API_BASE}/api/auth/login`,
  refreshToken: `${API_BASE}/api/auth/refresh`,
  forgotPassword: `${API_BASE}/api/auth/forgot`,
  resetPassword: `${API_BASE}/api/auth/reset`,
  users: `${API_BASE}/api/users`,
  tutors: `${API_BASE}/api/users/tutors`,
  uploadImage: `${API_BASE}/api/uploads/image`,
  studentPayments: `${API_BASE}/api/student/payments`,
  studentPaymentsCallback: `${API_BASE}/api/student/payments/callback`,
  studentPaymentMethods: `${API_BASE}/api/student/payment-methods`,
  studentPaymentMethodsBind: `${API_BASE}/api/student/payment-methods/bind`,
  /** return_url для YooKassa — бэкенд должен использовать этот путь, не /api/student/payments */
  studentPaymentMethodsCallback: `${API_BASE}/api/student/payment-methods/callback`,
  paymentsMethod: `${API_BASE}/api/payments/method`,
  studentPaymentMethodsLegacy: `${API_BASE}/api/student/payment-methods`,
  paymentMethodsCallback: `${API_BASE}/api/payments/callback`,
  paymentMethodsCallbackLegacy: `${API_BASE}/payments/callback`,
  switchRole: `${API_BASE}/api/auth/switch-role`,

  // Student (Ученик) — профиль
  studentProfile: `${API_BASE}/api/student/profile`,

  // Tutor (Наставник) — профиль, слоты, события, платежи
  tutorProfile: `${API_BASE}/api/tutor/profile`,
  tutorSlots: `${API_BASE}/api/tutor/slots`,
  tutorEvents: `${API_BASE}/api/tutor/events`,
  tutorPayments: `${API_BASE}/api/tutor/payments`,
  tutorPaymentsSummary: `${API_BASE}/api/tutor/payments/summary`,

  // Events (события)
  events: `${API_BASE}/api/events`,
  eventsFeed: `${API_BASE}/api/events/feed`,
  /** Мои мероприятия / session_based (студент): GET ?role=student&filter=... */
  eventsMy: `${API_BASE}/api/events/my`,

  // Student → booking slots (личные встречи с наставниками)
  studentBookings: `${API_BASE}/api/student/bookings`,

  // Tutor → встречи с учениками
  tutorBookings: `${API_BASE}/api/tutor/bookings`,

  // Student → публичные слоты конкретного тьютора
  studentTutorSlotsBase: `${API_BASE}/api/student/tutors`,

  // Payment status sync with YooKassa (per event)
  studentPaymentEventStatusBase: `${API_BASE}/api/student/payments/event`,

  // Admin
  adminLogin: `${API_BASE}/api/admin/auth/login`,
  adminApplications: `${API_BASE}/api/admin/tutor-applications`,
};
