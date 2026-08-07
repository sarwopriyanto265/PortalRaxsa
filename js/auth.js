/**
 * RAXSA Portal — Auth Module (UX State Only)
 *
 * IMPORTANT: This module manages CLIENT-SIDE UX STATE ONLY.
 * It is NOT an authentication mechanism and must NOT be used
 * as a security boundary.
 *
 * Production access control is enforced by Cloudflare Access
 * at the deployment perimeter. This module exists solely to
 * preserve the login UI flow and session UX for users.
 */

const AUTH_KEY = 'raxsa_auth_session';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

function checkAuth() {
  const raw = sessionStorage.getItem(AUTH_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    if (Date.now() > data.expires) {
      logout();
      return false;
    }
    return true;
  } catch {
    sessionStorage.removeItem(AUTH_KEY);
    return false;
  }
}

function login() {
  // UX-only: sets a session flag. No password verification.
  // Real authentication is enforced by Cloudflare Access.
  sessionStorage.setItem(AUTH_KEY, JSON.stringify({
    loginAt: Date.now(),
    expires: Date.now() + SESSION_DURATION_MS
  }));
  return true;
}

function logout() {
  sessionStorage.removeItem(AUTH_KEY);
  window.location.href = '../index.html';
}

window.RaxsaAuth = { checkAuth, login, logout };
