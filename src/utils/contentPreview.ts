export function parseContentPreview(source: string | null | undefined) {
  const fallback = { body: source || '', hashtags: [] as string[], summary: '' }
  if (!source) return fallback

  try {
    const parsed = JSON.parse(source) as Record<string, unknown>
    if (!parsed || Array.isArray(parsed)) return fallback

    return {
      body: typeof parsed.body === 'string' ? parsed.body : source,
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.filter((item): item is string => typeof item === 'string') : typeof parsed.hashtags === 'string' ? [parsed.hashtags] : [],
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    }
  } catch {
    return fallback
  }
}
