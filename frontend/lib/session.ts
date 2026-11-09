// Token storage only. Kept separate from api.ts and auth.ts so they can both import it
// without a circular import.

const TOKEN_KEY = "token"
const REFRESH_KEY = "refresh_token"

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null // server render, or storage blocked
  }
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY)
  } catch {
    return null
  }
}

export function saveSession(accessToken: string, refreshToken?: string | null) {
  try {
    localStorage.setItem(TOKEN_KEY, accessToken)
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken)
  } catch {}
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
  } catch {}
}

export function hasSession(): boolean {
  return Boolean(getToken())
}