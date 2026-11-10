/**
 * Prototype mode (no sign-in): the person you are acting as.
 *
 * Remembered per browser and sent to the API on every request in the
 * X-Coop-Actor header. The API tells Postgres to treat that person exactly like
 * a signed-in user, so permissions still apply to whoever you are acting as.
 */
const STORAGE_KEY = 'coop-actor'

let current: string | null = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
})()

export function readActor(): string | null {
  return current
}

export function writeActor(id: string | null) {
  current = id
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* private mode: keep it in memory only */
  }
}
