import type { GeoJSONCollection } from '../types/geojson'

export interface BBox { south: number; west: number; north: number; east: number }

export interface CityConfig {
  key: string
  name: string
  bbox: BBox
  url: string
}

// Şehirler — her biri OSM'den çekilip kırpılmış GeoJSON dosyası kullanır
export const CITIES: Record<string, CityConfig> = {
  shinjuku: {
    key: 'shinjuku',
    name: 'Nishi-Shinjuku, Tokyo',
    bbox: { south: 35.666, west: 139.680, north: 35.706, east: 139.740 },
    url: '/data/shinjuku-trim.geojson',
  },
}

export const DEFAULT_CITY = 'shinjuku'

// URL yoluna göre şehir seç (/konya → konya, / → shinjuku)
export function cityFromPath(pathname: string): CityConfig {
  const seg = pathname.replace(/^\/+|\/+$/g, '').toLowerCase()
  return CITIES[seg] ?? CITIES[DEFAULT_CITY]
}

// Geriye dönük uyumluluk
export const CITY_BBOX = CITIES[DEFAULT_CITY].bbox

export async function fetchCityGeoJSON(url: string): Promise<GeoJSONCollection> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GeoJSON yüklenemedi: ${res.status}`)
  return res.json()
}
