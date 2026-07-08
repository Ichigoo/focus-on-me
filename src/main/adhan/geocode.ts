import type { AdhanLocation } from '@shared/types'

interface OpenMeteoResult {
  name: string
  latitude: number
  longitude: number
  country?: string
  admin1?: string
}

interface OpenMeteoResponse {
  results?: OpenMeteoResult[]
}

export async function searchLocation(query: string): Promise<AdhanLocation[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = (await res.json()) as OpenMeteoResponse
  return (data.results ?? []).map((r) => ({
    lat: r.latitude,
    lon: r.longitude,
    label: [r.name, r.admin1, r.country].filter(Boolean).join(', ')
  }))
}
