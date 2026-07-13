// utils/auth.js
import * as SecureStore from 'expo-secure-store';
import { AUTH_ENDPOINTS, PATIENT_ENDPOINTS, PHLEB_ENDPOINTS, CATALOG_ENDPOINTS, UPLOAD_ENDPOINTS } from '../config/api';

const PHLEB_TOKEN_KEY   = 'musb_phleb_token';
const PHLEB_USER_KEY    = 'musb_phleb_user';
const PATIENT_TOKEN_KEY = 'musb_patient_token';
const PATIENT_USER_KEY  = 'musb_patient_user';

async function postJson(url, body) {
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('NETWORK_ERROR');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('BAD_RESPONSE');
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Request failed (${response.status})`);
  }
  return data;
}

// ── multipart POST helper (kept for endpoints that genuinely accept files —
// NOT used by applyPhleb, since submit_application expects JSON/base64) ────
// Do NOT set 'Content-Type' manually for FormData — fetch/RN needs to set
// its own multipart boundary, or the backend won't be able to parse parts.
async function postFormData(url, formData) {
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: formData,
    });
  } catch {
    throw new Error('NETWORK_ERROR');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('BAD_RESPONSE');
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Request failed (${response.status})`);
  }
  return data;
}

// ── Document upload (S3-backed) ─────────────────────────────────────────
// Guess a MIME type from a filename/uri extension.
function guessContentType(name = '') {
  const ext = (name.split('?')[0].split('.').pop() || '').toLowerCase();
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    heic: 'image/heic', webp: 'image/webp', pdf: 'application/pdf',
  };
  return map[ext] || 'application/octet-stream';
}

// Direct-to-S3 via a presigned POST — the file bytes go straight to S3 and
// never touch our server. Returns the storage key, or null when the server
// says direct upload isn't available (409) so the caller can fall back.
async function presignedUpload({ uri, kind, filename, contentType }) {
  const type = contentType || guessContentType(filename || uri);
  const presignRes = await fetch(UPLOAD_ENDPOINTS.presign, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, filename, content_type: type }),
  });
  if (presignRes.status === 409) return null; // not available → fallback
  if (!presignRes.ok) throw new Error(`Presign failed (${presignRes.status})`);
  const { key, url, fields } = await presignRes.json();

  // Multipart form: policy fields FIRST, the file part LAST (S3 requirement).
  const form = new FormData();
  Object.entries(fields || {}).forEach(([k, v]) => form.append(k, v));
  form.append('file', { uri, name: filename || key.split('/').pop(), type });

  const s3Res = await fetch(url, { method: 'POST', body: form });
  if (!(s3Res.status === 201 || s3Res.status === 204 || s3Res.ok)) {
    throw new Error(`S3 upload failed (${s3Res.status})`);
  }
  return key;
}

// Uploads a single document and returns { key, url? }. Persist the `key`.
// Prefers direct-to-S3 (presigned) when a file uri is available; otherwise
// (or on any hiccup) falls back to the through-server endpoint.
export async function uploadDocument({ base64, uri, kind = 'documents', filename, contentType }) {
  if (uri) {
    try {
      const key = await presignedUpload({ uri, kind, filename, contentType });
      if (key) return { key };
    } catch (e) {
      // fall through to the server-side path below
    }
  }

  let response;
  try {
    if (base64) {
      response = await fetch(UPLOAD_ENDPOINTS.document, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, kind, filename }),
      });
    } else if (uri) {
      const form = new FormData();
      form.append('file', { uri, name: filename || 'upload', type: contentType || 'application/octet-stream' });
      form.append('kind', kind);
      response = await fetch(UPLOAD_ENDPOINTS.document, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: form,
      });
    } else {
      throw new Error('No document provided');
    }
  } catch {
    throw new Error('NETWORK_ERROR');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `Upload failed (${response.status})`);
  }
  return data; // { key, url }
}

// ── Phlebotomist application (steps 1+2 merged, submitted once) ─────────
// POST /api/phleb/apply/ as JSON. Documents are base64-encoded strings,
// not multipart files — this matches submit_application's
// request.data.get('dlFront') / 'dlBack' / 'certificate' / 'insuranceDoc'
// pattern on the Django side exactly.
export async function applyPhleb({
  fullName,
  email,
  phone,
  address,
  website,
  password,
  dlFront,
  dlBack,
  certificate,
  insuranceDoc,
  w9,
  certifications,
  zipCodes,
}) {
  return postJson(PHLEB_ENDPOINTS.apply, {
    fullName,
    email,
    phone,
    address,
    website: website || '',
    password,
    dlFront: dlFront || null,
    dlBack: dlBack || null,
    certificate: certificate || null,
    insuranceDoc: insuranceDoc || null,
    w9: w9 || null,
    certifications: certifications || [],
    zipCodes: zipCodes || [],
  });
}

// ── Application status polling (public, no auth) ─────────────────────────
export async function getApplicationStatus(specialistId) {
  let response;
  try {
    response = await fetch(PHLEB_ENDPOINTS.applicationStatus(specialistId), { method: 'GET' });
  } catch {
    throw new Error('NETWORK_ERROR');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('BAD_RESPONSE');
  }

  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }
  return data;
}

// ── Unified login ─────────────────────────────────────────────────────
export async function login(email, password) {
  const data = await postJson(AUTH_ENDPOINTS.login, { email, password });

  if (data.role === 'phlebotomist') {
    // Clear any leftover patient session so the two roles never coexist
    await SecureStore.deleteItemAsync(PATIENT_TOKEN_KEY);
    await SecureStore.deleteItemAsync(PATIENT_USER_KEY);
    if (data.token) await SecureStore.setItemAsync(PHLEB_TOKEN_KEY, data.token);
    if (data.user)  await SecureStore.setItemAsync(PHLEB_USER_KEY, JSON.stringify(data.user));
  } else if (data.role === 'patient') {
    // Clear any leftover phlebotomist session so the two roles never coexist
    await SecureStore.deleteItemAsync(PHLEB_TOKEN_KEY);
    await SecureStore.deleteItemAsync(PHLEB_USER_KEY);
    if (data.token) await SecureStore.setItemAsync(PATIENT_TOKEN_KEY, data.token);
    if (data.user)  await SecureStore.setItemAsync(PATIENT_USER_KEY, JSON.stringify(data.user));
  } else {
    throw new Error(`Unknown role in login response: ${data.role}`);
  }

  return data;
}

// ── Google Sign-In (role-aware) ───────────────────────────────────────
// `role` is 'patient' or 'phlebotomist' — the caller picks based on which
// tab/screen the user is signing in from, since a single Google token has
// no inherent role and the backend has separate collections per role.
export async function loginWithGoogle({ idToken, email, name, picture, role = 'patient' }) {
  const endpoint = role === 'phlebotomist' ? PHLEB_ENDPOINTS.googleLogin : PATIENT_ENDPOINTS.googleLogin;
  const data = await postJson(endpoint, { id_token: idToken, email, name, picture });

  if (role === 'phlebotomist') {
    await SecureStore.deleteItemAsync(PATIENT_TOKEN_KEY);
    await SecureStore.deleteItemAsync(PATIENT_USER_KEY);
    if (data.token) await SecureStore.setItemAsync(PHLEB_TOKEN_KEY, data.token);
    if (data.user)  await SecureStore.setItemAsync(PHLEB_USER_KEY, JSON.stringify(data.user));
  } else {
    await SecureStore.deleteItemAsync(PHLEB_TOKEN_KEY);
    await SecureStore.deleteItemAsync(PHLEB_USER_KEY);
    if (data.token) await SecureStore.setItemAsync(PATIENT_TOKEN_KEY, data.token);
    if (data.user)  await SecureStore.setItemAsync(PATIENT_USER_KEY, JSON.stringify(data.user));
  }
  return { ...data, role };
}

// ── Forgot password (role-aware, OTP-based) ────────────────────────────
// Step 1: request a 6-digit code by email.
export async function requestPasswordResetOtp(email, role = 'patient') {
  const endpoint = role === 'phlebotomist' ? PHLEB_ENDPOINTS.requestOtp : PATIENT_ENDPOINTS.requestOtp;
  // Patient's request-otp endpoint doubles as the signup endpoint, so it
  // validates name/phone/password only if they're present — sending just
  // the email is enough to trigger a code for an existing account.
  return postJson(endpoint, { email });
}

// Step 2: verify the code and set a new password.
// Patient's verify-otp expects the new password in `password`;
// the phlebotomist one (added for this flow) expects `new_password`.
export async function confirmPasswordReset({ email, code, newPassword, role = 'patient' }) {
  if (role === 'phlebotomist') {
    return postJson(PHLEB_ENDPOINTS.verifyOtp, {
      email,
      token: code,
      new_password: newPassword,
    });
  }
  return postJson(PATIENT_ENDPOINTS.verifyOtp, {
    email,
    token: code,
    password: newPassword,
  });
}

export async function getActiveSession() {
  const [phlebToken, patientToken] = await Promise.all([
    SecureStore.getItemAsync(PHLEB_TOKEN_KEY),
    SecureStore.getItemAsync(PATIENT_TOKEN_KEY),
  ]);

  if (phlebToken) {
    const raw = await SecureStore.getItemAsync(PHLEB_USER_KEY);
    return { role: 'phlebotomist', token: phlebToken, user: raw ? JSON.parse(raw) : null };
  }
  if (patientToken) {
    const raw = await SecureStore.getItemAsync(PATIENT_USER_KEY);
    return { role: 'patient', token: patientToken, user: raw ? JSON.parse(raw) : null };
  }
  return null;
}

export async function loginPhleb(email, password) {
  const data = await postJson(PHLEB_ENDPOINTS.login, { email, password });
  // Clear any leftover patient session so the two roles never coexist
  await SecureStore.deleteItemAsync(PATIENT_TOKEN_KEY);
  await SecureStore.deleteItemAsync(PATIENT_USER_KEY);
  if (data.token) await SecureStore.setItemAsync(PHLEB_TOKEN_KEY, data.token);
  if (data.user)  await SecureStore.setItemAsync(PHLEB_USER_KEY, JSON.stringify(data.user));
  return data;
}

export async function getStoredPhlebToken() {
  return SecureStore.getItemAsync(PHLEB_TOKEN_KEY);
}

export async function getStoredPhlebUser() {
  const raw = await SecureStore.getItemAsync(PHLEB_USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function logoutPhleb() {
  await SecureStore.deleteItemAsync(PHLEB_TOKEN_KEY);
  await SecureStore.deleteItemAsync(PHLEB_USER_KEY);
}

export async function authFetch(url, options = {}, role = 'phleb') {
  const token = role === 'patient'
    ? await SecureStore.getItemAsync(PATIENT_TOKEN_KEY)
    : await SecureStore.getItemAsync(PHLEB_TOKEN_KEY);

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw { status: response.status, data };
  }
  return data;
}

export const authGet   = (url, role = 'phleb') => authFetch(url, { method: 'GET' }, role);
export const authPost  = (url, body, role = 'phleb') => authFetch(url, { method: 'POST', body: JSON.stringify(body) }, role);
export const authPut   = (url, body, role = 'phleb') => authFetch(url, { method: 'PUT', body: JSON.stringify(body) }, role);
export const authPatch = (url, body, role = 'phleb') => authFetch(url, { method: 'PATCH', body: JSON.stringify(body) }, role);

// ── Patient (MusB App) ───────────────────────────────────────────────────
export async function requestOtp(email,phone) {
  return postJson(PATIENT_ENDPOINTS.requestOtp, { email,phone, client: 'mobile' });
}

export async function verifyOtpAndCreateAccount({ email, token, name, password,phone }) {
  const data = await postJson(PATIENT_ENDPOINTS.verifyOtp, { method: 'email', email, token, name, password,phone });
  // Clear any leftover phlebotomist session so the two roles never coexist
  await SecureStore.deleteItemAsync(PHLEB_TOKEN_KEY);
  await SecureStore.deleteItemAsync(PHLEB_USER_KEY);
  if (data.token) await SecureStore.setItemAsync(PATIENT_TOKEN_KEY, data.token);
  if (data.user)  await SecureStore.setItemAsync(PATIENT_USER_KEY, JSON.stringify(data.user));
  return data;
}

export async function loginPatient(email, password) {
  const data = await postJson(PATIENT_ENDPOINTS.login, { email, password });
  // Clear any leftover phlebotomist session so the two roles never coexist
  await SecureStore.deleteItemAsync(PHLEB_TOKEN_KEY);
  await SecureStore.deleteItemAsync(PHLEB_USER_KEY);
  if (data.token) await SecureStore.setItemAsync(PATIENT_TOKEN_KEY, data.token);
  if (data.user)  await SecureStore.setItemAsync(PATIENT_USER_KEY, JSON.stringify(data.user));
  return data;
}

export async function getStoredPatientToken() {
  return SecureStore.getItemAsync(PATIENT_TOKEN_KEY);
}

export async function getStoredPatientUser() {
  const raw = await SecureStore.getItemAsync(PATIENT_USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function logoutPatient() {
  await SecureStore.deleteItemAsync(PATIENT_TOKEN_KEY);
  await SecureStore.deleteItemAsync(PATIENT_USER_KEY);
}

export async function fetchPatientDashboard() {
  const token = await getStoredPatientToken();
  if (!token) throw new Error('NOT_LOGGED_IN');

  let response;
  try {
    response = await fetch(PATIENT_ENDPOINTS.dashboard, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error('NETWORK_ERROR');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('BAD_RESPONSE');
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Request failed (${response.status})`);
  }
  return data;
}

export async function bookAppointment(bookingData) {
  const token = await getStoredPatientToken();
  if (!token) throw new Error('NOT_LOGGED_IN');

  let response;
  try {
    response = await fetch(PATIENT_ENDPOINTS.bookAppointment, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(bookingData),
    });
  } catch {
    throw new Error('NETWORK_ERROR');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('BAD_RESPONSE');
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Request failed (${response.status})`);
  }
  return data;
}
export async function markAppointmentPaid(appointmentId) {
  const token = await getStoredPatientToken();
  if (!token) throw new Error('NOT_LOGGED_IN');

  let response;
  try {
    response = await fetch(PATIENT_ENDPOINTS.markAppointmentPaid(appointmentId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error('NETWORK_ERROR');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('BAD_RESPONSE');
  }

  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }
  return data;
}

export async function fetchPatientProfile() {
  const token = await getStoredPatientToken();
  if (!token) throw new Error('NOT_LOGGED_IN');

  let response;
  try {
    response = await fetch(PATIENT_ENDPOINTS.profile, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error('NETWORK_ERROR');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('BAD_RESPONSE');
  }

  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }
  return data;
}

export async function updatePatientProfile(updates) {
  const token = await getStoredPatientToken();
  if (!token) throw new Error('NOT_LOGGED_IN');

  let response;
  try {
    response = await fetch(PATIENT_ENDPOINTS.profile, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(updates),
    });
  } catch {
    throw new Error('NETWORK_ERROR');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('BAD_RESPONSE');
  }

  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }

  if (data.user) {
    await SecureStore.setItemAsync(PATIENT_USER_KEY, JSON.stringify(data.user));
  }
  return data;
}

export async function fetchPatientHistory() {
  const token = await getStoredPatientToken();
  if (!token) throw new Error('NOT_LOGGED_IN');

  let response;
  try {
    response = await fetch(PATIENT_ENDPOINTS.dashboard, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error('NETWORK_ERROR');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('BAD_RESPONSE');
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Request failed (${response.status})`);
  }
  return data.past ?? [];
}

// ── Catalog (public, no auth) ────────────────────────────────────────────
export async function fetchAvailableTests() {
  let response;
  try {
    response = await fetch(CATALOG_ENDPOINTS.tests, { method: 'GET' });
  } catch {
    throw new Error('NETWORK_ERROR');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('BAD_RESPONSE');
  }

  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }
  return Array.isArray(data) ? data : [];
}

export async function fetchPricing({ address, zipCode, bookingDate, bookingTime } = {}) {
  if (!address && !zipCode) {
    throw new Error('Address or zip code is required to calculate pricing.');
  }

  let response;
  try {
    response = await fetch(CATALOG_ENDPOINTS.pricingPreview, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: address || '',
        zip_code: zipCode || '',
        booking_date: bookingDate || '',
        booking_time: bookingTime || '',
        provider_type: 'INDEPENDENT_PHLEBOTOMIST',
      }),
    });
  } catch {
    throw new Error('NETWORK_ERROR');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('BAD_RESPONSE');
  }

  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }
  return data;
}

export async function changePatientPassword({ currentPassword, newPassword }) {
  const token = await getStoredPatientToken();
  if (!token) throw new Error('NOT_LOGGED_IN');

  let response;
  try {
    response = await fetch(PATIENT_ENDPOINTS.changePassword, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
  } catch {
    throw new Error('NETWORK_ERROR');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('BAD_RESPONSE');
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Request failed (${response.status})`);
  }
  return data;
}

export async function rateAppointment(appointmentId, rating, comment = '') {
  const token = await getStoredPatientToken();
  if (!token) throw new Error('NOT_LOGGED_IN');

  let response;
  try {
    response = await fetch(PATIENT_ENDPOINTS.rateAppointment(appointmentId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rating, comment }),
    });
  } catch {
    throw new Error('NETWORK_ERROR');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('BAD_RESPONSE');
  }

  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }
  return data;
}