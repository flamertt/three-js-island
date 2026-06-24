export interface VehicleData {
  url: string
  waypoints: [number, number][]   // tüm yol boyunca noktalar [x, z]
  lateralOffset: number           // şeridi belirler (sağ/sol)
  speed: number                   // scene units / sec
  startT: number                  // 0-1 başlangıç konumu
  reverse: boolean                // ters yön (karşı şerit)
}
