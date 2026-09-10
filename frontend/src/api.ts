import type { ScheduleDraft, ScheduleItem } from './types'

const BASE = '/api'

/** Errors carry a message the UI can show as-is. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(BASE + path, {
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      ...init,
    })
  } catch {
    throw new Error("Can't reach the server. Make sure the backend is running.")
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.message ?? 'Something went wrong. Please try again.')
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  listSchedule: (start: string, end: string) =>
    request<ScheduleItem[]>(`/schedule?start=${start}&end=${end}`),

  createSchedule: (draft: ScheduleDraft) =>
    request<ScheduleItem>('/schedule', { method: 'POST', body: JSON.stringify(draft) }),

  updateSchedule: (id: number, draft: ScheduleDraft) =>
    request<ScheduleItem>(`/schedule/${id}`, { method: 'PATCH', body: JSON.stringify(draft) }),

  deleteSchedule: (id: number) => request<void>(`/schedule/${id}`, { method: 'DELETE' }),
}
