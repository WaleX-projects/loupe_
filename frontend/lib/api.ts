import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios"

import { API_URL } from "./config"
import { clearSession, getRefreshToken, getToken, saveSession } from "./session"

const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000, // AI/backend tasks can be slow
  headers: {
    "Content-Type": "application/json",
  },
})

/* ───────── attach the access token ───────── */
axiosInstance.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

/* ───────── refresh once on 401, then retry ───────── */
type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

// auth endpoints that must never trigger a refresh (they are how you get a session in the first place)
const NO_REFRESH = ["/auth/magic-link", "/auth/callback", "/auth/refresh", "/auth/google"]

let refreshing: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken()
  if (!refresh) return null
  try {
    // plain axios on purpose: going through axiosInstance would re-enter this interceptor
    const { data } = await axios.post<{ access_token: string; refresh_token?: string }>(
      `${API_URL}/auth/refresh`,
      { refresh_token: refresh },
      { timeout: 15000 }
    )
    saveSession(data.access_token, data.refresh_token)
    return data.access_token
  } catch {
    return null
  }
}

function sessionExpired() {
  clearSession()
  if (typeof window === "undefined") return
  const here = window.location.pathname + window.location.search
  if (window.location.pathname.startsWith("/login") || window.location.pathname.startsWith("/auth/")) return
  window.location.href = `/auth?next=${encodeURIComponent(here)}`
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined
    const url = original?.url ?? ""

    if (
      error.response?.status !== 401 ||
      !original ||
      original._retry ||
      NO_REFRESH.some((p) => url.startsWith(p))
    ) {
      return Promise.reject(error)
    }

    original._retry = true
    // several requests can fail at once: share one refresh call between them
    refreshing ??= refreshAccessToken().finally(() => {
      refreshing = null
    })
    const token = await refreshing

    if (!token) {
      sessionExpired()
      return Promise.reject(error)
    }
    original.headers.Authorization = `Bearer ${token}`
    return axiosInstance(original)
  }
)

/* ───────── helpers ───────── */

type ValidationIssue = { loc?: (string | number)[]; msg?: string }

/**
 * Turns any axios/FastAPI error into a STRING you can render.
 * FastAPI sends `detail` as a string for HTTPException, but as an ARRAY of objects
 * ({ type, loc, msg, input }) for 422 validation errors. Never render `detail` directly:
 * React throws "Objects are not valid as a React child". Always go through this.
 */
export function getErrorMessage(e: unknown, fallback = "Something went wrong. Try again."): string {
  if (axios.isAxiosError(e)) {
    if (!e.response) return "Could not reach the server. Check your connection and try again."

    const detail = (e.response.data as { detail?: unknown } | undefined)?.detail
    if (typeof detail === "string" && detail) return detail

    if (Array.isArray(detail)) {
      const messages = (detail as ValidationIssue[])
        .map((issue) => {
          const field = issue.loc?.filter((part) => part !== "body" && part !== "query").join(".")
          const msg = issue.msg ?? "Invalid input"
          return field ? `${field}: ${msg}` : msg
        })
        .filter(Boolean)
      if (messages.length) return messages.join(". ")
    }
  }
  return fallback
}

/**
 * WebSocket URL with the access token attached (browsers cannot set headers on a WebSocket).
 * Verify it server-side with supabase.auth.get_user(token) before accepting the socket.
 * Example: new WebSocket(wsUrl(`/ws/projects/${id}`))
 */
export function wsUrl(path: string): string {
  const base = API_URL.replace(/^http/, "ws")
  const token = getToken()
  return `${base}${path}${token ? `?token=${encodeURIComponent(token)}` : ""}`
}

// Complete Project CRUD & Job Operations API Wrapper
export const api = {
  post: async <T, D = Record<string, unknown>>(url: string, data?: D, config?: AxiosRequestConfig): Promise<T> => {
    const response: AxiosResponse<T> = await axiosInstance.post(url, data, config)
    return response.data
  },
  response: async <T, D = Record<string, unknown>>(url: string, data?: D, config?: AxiosRequestConfig): Promise<T> => {
    const response: AxiosResponse<T> = await axiosInstance.post(url, data, config)
    return response.data
  },

  get: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const response: AxiosResponse<T> = await axiosInstance.get(url, config)
    return response.data
  },

  patch: async <T, D = Record<string, unknown>>(url: string, data?: D, config?: AxiosRequestConfig): Promise<T> => {
    const response: AxiosResponse<T> = await axiosInstance.patch(url, data, config)
    return response.data
  },

  delete: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const response: AxiosResponse<T> = await axiosInstance.delete(url, config)
    return response.data
  },
}