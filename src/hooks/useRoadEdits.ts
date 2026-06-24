import { useState, useCallback, useEffect, useRef } from 'react'
import type { RoadSegment } from '../types/osm'
import { cityFromPath } from '../data/overpass'

const API = `/api/road-edits?city=${cityFromPath(window.location.pathname).key}`

interface Persisted {
  removed: string[]
  added: RoadSegment[]
}

export function useRoadEdits() {
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [added, setAdded]     = useState<RoadSegment[]>([])
  const [loaded, setLoaded]   = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Başlangıçta veri dosyasından yükle
  useEffect(() => {
    fetch(API)
      .then((r) => r.json())
      .then((d: Persisted) => {
        setRemoved(new Set(d.removed ?? []))
        setAdded(d.added ?? [])
      })
      .catch(() => { /* dosya yoksa boş başla */ })
      .finally(() => setLoaded(true))
  }, [])

  // Değişince dosyaya yaz (yüklendikten sonra, debounce'lu)
  useEffect(() => {
    if (!loaded) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const body: Persisted = { removed: [...removed], added }
      fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(() => { /* yok say */ })
    }, 300)
  }, [removed, added, loaded])

  const removeRoad = useCallback((id: string) => {
    if (id.startsWith('user-')) {
      // kendi eklediğin yol → added dizisinden tamamen çıkar
      setAdded((prev) => prev.filter((r) => r.id !== id))
      return
    }
    setRemoved((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const addRoad = useCallback((points: [number, number][], type = 'primary') => {
    if (points.length < 2) return
    setAdded((prev) => [
      ...prev,
      { id: `user-${prev.length}-${Math.round(points[0][0])}`, points, type, lanes: 2 },
    ])
  }, [])

  const undoAdd = useCallback(() => setAdded((prev) => prev.slice(0, -1)), [])
  const restoreRemoved = useCallback(() => setRemoved(new Set()), [])
  const resetAll = useCallback(() => { setRemoved(new Set()); setAdded([]) }, [])

  return { removed, added, loaded, removeRoad, addRoad, undoAdd, restoreRemoved, resetAll }
}
