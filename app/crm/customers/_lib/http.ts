export async function readJsonResponse<T>(response: Response): Promise<T | null> {
  const raw = await response.text()
  if (!raw.trim()) return null

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}
