export interface GeoJSONFeature {
  type: 'Feature'
  geometry:
    | { type: 'LineString'; coordinates: [number, number][] }
    | { type: 'Polygon';    coordinates: [number, number][][] }
  properties: {
    highway?:  string | null
    lanes?:    string | number | null
    name?:     string | null
    building?: string | null
    levels?:   number | null
    amenity?:  string | null
    water?:    string | null
    [key: string]: unknown
  }
}

export interface GeoJSONCollection {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
}
