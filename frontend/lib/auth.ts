// Auth calls, built on the shared axios client in ./api. They talk to your FastAPI router:
//   POST /auth/magic-link {email}   -> { success, message }
//   GET  /auth/google               -> 302 to Google (browser navigation)
//   GET  /auth/callback?code=...    -> { access_token, refresh_token, user }  (code exchange)
//   POST /auth/refresh              -> used by the axios interceptor
//   GET  /auth/me                   -> { id, email }
// Supabase sends the user back to the frontend with either ?code=... or #access_token=...
// completeSignIn() handles both.

import axios from "axios"

import { api, getErrorMessage } from "./api"
import { API_URL } from "./config"
import { clearSession, getToken, hasSession, saveSession } from "./session"

export { API_URL, clearSession, getToken, hasSession, saveSession }

export const APP_NAME = "Buildly" // change me

export class AuthError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message)
  }
}

const statusOf = (e: unknown) => (axios.isAxiosError(e) ? e.response?.status : undefined)

/** Use with fetch/EventSource if you ever bypass axios. */
export function authHeaders(): Record<string, string> {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

/** POST /auth/magic-link */
export async function sendMagicLink(email: string): Promise<void> {
  try {
    await api.post<{ success: boolean }>("/auth/magic-link", { email })
  } catch (e) {
    const status = statusOf(e)
    if (status === 422) throw new AuthError("Enter a valid email address.", 422)
    throw new AuthError(getErrorMessage(e, "Could not send the link. Try again."), status)
  }
}

/** Browser navigation: GET /auth/google redirects to Google. */
export function startGoogle() {
  window.location.href = `${API_URL}/auth/google`
}

/**
 * Finishes a sign-in. Reads the URL the user came back on:
 * - ?error_description=...        -> throws
 * - #access_token=... (implicit)  -> saves it
 * - ?code=...                     -> GET /auth/callback?code=... on FastAPI, saves the tokens
 */
export async function completeSignIn(): Promise<void> {
  const url = new URL(window.location.href)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""))

  const problem = url.searchParams.get("error_description") ?? hash.get("error_description")
  if (problem) throw new AuthError(problem)

  const accessToken = hash.get("access_token")
  if (accessToken) {
    saveSession(accessToken, hash.get("refresh_token"))
    window.history.replaceState(null, "", window.location.pathname) // keep tokens out of history
    return
  }

  const code = url.searchParams.get("code")
  if (!code) throw new AuthError("This link is missing its code.")

  try {
    const data = await api.get<{ access_token?: string; refresh_token?: string }>("/auth/callback", {
      params: { code },
    })
    if (!data.access_token) throw new AuthError("The server did not return a session.")
    saveSession(data.access_token, data.refresh_token)
    window.history.replaceState(null, "", window.location.pathname) // the code is single use: drop it
  } catch (e) {
    if (e instanceof AuthError) throw e
    throw new AuthError(getErrorMessage(e, "This link is invalid or has expired."), statusOf(e))
  }
}

/** GET /auth/me */
export async function getCurrentUser(): Promise<{ id: string; email: string }> {
  return api.get<{ id: string; email: string }>("/auth/me")
}

export function signOut() {
  clearSession()
  window.location.href = "/auth"
}

/** Only allow same-site relative redirects (blocks open redirects). */
export function safeNext(next: string | null | undefined, fallback = "/project") {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback
  return next
}