// ─── Parsed city entities (parser output) ─────────────────────────────────────

export interface RoadSegment {
  id: string
  points: [number, number][]   // [x, z] scene coords
  type: string                 // OSM highway value
  lanes: number
}

export interface BuildingEntity {
  id: number
  center: [number, number]     // [x, z] scene coords
  area: number                 // scene units²
  levels: number
  tags: Record<string, string>
  rot?: number                 // en yakın yola hizalı yön (radyan)
}

export interface WaterPolygon {
  id: number
  points: [number, number][]
}

export interface CityData {
  roads: RoadSegment[]
  buildings: BuildingEntity[]
  water: WaterPolygon[]
  bounds: {
    minX: number; maxX: number
    minZ: number; maxZ: number
  }
}
