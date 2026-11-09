export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
// mocks stay on until NEXT_PUBLIC_USE_MOCKS=0 (no backend, no auth enforcement)
export const USE_MOCKS = false
//process.env.NEXT_PUBLIC_USE_MOCKS !== "1"