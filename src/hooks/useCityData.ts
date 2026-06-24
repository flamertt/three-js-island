import { useState, useEffect } from 'react'
import { fetchCityGeoJSON, cityFromPath } from '../data/overpass'
import { parseCityData } from '../data/osmParser'
import type { CityData } from '../types/osm'

type Status = 'loading' | 'ready' | 'error'

export function useCityData() {
  const [cityData, setCityData] = useState<CityData | null>(null)
  const [status, setStatus]     = useState<Status>('loading')
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    const city = cityFromPath(window.location.pathname)
    fetchCityGeoJSON(city.url)
      .then((geojson) => {
        setCityData(parseCityData(geojson, city.bbox))
        setStatus('ready')
      })
      .catch((err: Error) => {
        setError(err.message)
        setStatus('error')
      })
  }, [])

  return { cityData, status, error }
}
