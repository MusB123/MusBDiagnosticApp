// config/api.js
// Unified API configuration for MusB (Patient + Phlebotomist apps)

const BASE_URL = 'https://musb-diagnostic-website.onrender.com';

const PHLEB_BASE = `${BASE_URL}/api/phleb`;
const PHLEB_GLOBAL = `${BASE_URL}/api/phlebotomists`; // global phlebotomist routes
const DISPATCH_BASE = `${BASE_URL}/api/dispatch`; // ⚠ verify this app exists on the backend
const PATIENT_PREFIX = `${BASE_URL}/api/patients`;

// ── NEW: Unified login (single entry point, routes by `role` in response) ───
export const AUTH_ENDPOINTS = {
  login: `${BASE_URL}/api/login/`,
};

// ── Patient endpoints (unchanged from patient app) ──────────────────────────
export const PATIENT_ENDPOINTS = {
  login: `${PATIENT_PREFIX}/login/`, // ⚠ legacy — kept in case still referenced elsewhere
  dashboard: `${PATIENT_PREFIX}/dashboard/`,
  bookAppointment: `${PATIENT_PREFIX}/book-appointment/`,
  requestOtp: `${PATIENT_PREFIX}/request-otp/`,
  verifyOtp: `${PATIENT_PREFIX}/verify-otp/`,
  addPaymentMethod: `${PATIENT_PREFIX}/add-payment-method/`,
  tracking: `${PATIENT_PREFIX}/tracking/`,
  trackingFor: (appointmentId) => `${PATIENT_PREFIX}/tracking/${appointmentId}/`,
  profile: `${PATIENT_PREFIX}/profile/`,
};

// ── Phlebotomist endpoints (full version, from phleb app) ───────────────────
export const PHLEB_ENDPOINTS = {
  // ── Auth ────────────────────────────────────────────────────────────────
  login: `${PHLEB_BASE}/login/`, // ⚠ legacy — kept in case still referenced elsewhere
  signup: `${PHLEB_BASE}/signup/`,
  apply: `${PHLEB_BASE}/apply/`,
  applicationStatus: (specialistId) => `${PHLEB_BASE}/application-status/${specialistId}/`,
  changePassword: `${PHLEB_BASE}/change-password/`,

  // ── Dashboard / Profile ─────────────────────────────────────────────────
  dashboard: `${PHLEB_BASE}/dashboard/`,
  profile: `${PHLEB_BASE}/profile/`,
  heartbeat: `${PHLEB_BASE}/heartbeat/`,

  // ── Route / Appointments ────────────────────────────────────────────────
  reorderRoute: `${PHLEB_BASE}/reorder-route/`,

  testStatus: (id) => `${PHLEB_BASE}/test/${id}/status/`,
  testReschedule: (id) => `${PHLEB_BASE}/test/${id}/reschedule/`,
  verifyPin: (id) => `${PHLEB_BASE}/test/${id}/verify-pin/`,
  testChecklist: (id) => `${PHLEB_BASE}/test/${id}/checklist/`,

  // ── Broadcasts (job offers) ─────────────────────────────────────────────
  acceptBroadcast: (id) => `${PHLEB_BASE}/broadcasts/${id}/accept/`,
  declineBroadcast: (id) => `${PHLEB_BASE}/broadcasts/${id}/decline/`,

  // ── Hub routes ───────────────────────────────────────────────────────────
  hubRegister: `${PHLEB_BASE}/hubs/register/`,
  hubLogin: `${PHLEB_BASE}/hubs/login/`,
  hubDashboard: `${PHLEB_BASE}/hubs/dashboard/`,
  hubFleet: `${PHLEB_BASE}/hubs/fleet/`,
  hubRegisterSpecialist: `${PHLEB_BASE}/hubs/register-specialist/`,
  hubAssign: `${PHLEB_BASE}/hubs/assign/`,
  hubAutoAllocate: `${PHLEB_BASE}/hubs/auto-allocate/`,
  hubReports: `${PHLEB_BASE}/hubs/reports/`,
  hubVerification: `${PHLEB_BASE}/hubs/verification/`,
  hubVerificationAction: (id) => `${PHLEB_BASE}/hubs/verification/${id}/`,
  hubProfile: `${PHLEB_BASE}/hubs/profile/`,
  hubPayoutsRollout: `${PHLEB_BASE}/hubs/payouts/rollout/`,
  hubRemoveSpecialist: (id) => `${PHLEB_BASE}/hubs/fleet/${id}/remove/`,
  hubToggleAvailability: (id) => `${PHLEB_BASE}/hubs/fleet/${id}/availability/`,

  // ── Global phlebotomist routes (/api/phlebotomists/<id>/…) ──────────────
  phlebStatus: (id) => `${PHLEB_GLOBAL}/${id}/status/`,
  phlebLocation: (id) => `${PHLEB_GLOBAL}/${id}/location/`,
  phlebFcmToken: (id) => `${PHLEB_GLOBAL}/${id}/fcm-token/`,
  phlebJobs: (id) => `${PHLEB_GLOBAL}/${id}/jobs/`,

  // ── Dispatch (⚠ confirm these routes exist on the Django backend) ───────
  dispatch: {
    duty: `${DISPATCH_BASE}/duty/`,
    location: `${DISPATCH_BASE}/location/`,
    pending: `${DISPATCH_BASE}/pending/`,
    respond: `${DISPATCH_BASE}/respond/`,
    activeJob: `${DISPATCH_BASE}/active-job/`,
    nearbyRequests: `${DISPATCH_BASE}/nearby-requests/`,
    officeNearbyRequests: `${DISPATCH_BASE}/office-nearby-requests/`,
  },
};

// ── Catalog (from patient app) ───────────────────────────────────────────────
export const CATALOG_ENDPOINTS = {
  tests: `${BASE_URL}/api/superadmin/catalog/tests/`,
  pricingPreview: `${BASE_URL}/api/pricing/preview/`,
};