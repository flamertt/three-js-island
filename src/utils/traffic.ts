// Araçların canlı dünya konumları — oyuncu (yaya) çarpışması ve "arabaya bin"
// için paylaşımlı kayıt. NetworkVehicle her karede kendi slotunu yazar.
export interface VehPos { x: number; z: number; rot: number; url: string; active: boolean }

export const vehiclePositions: VehPos[] = []

export function setVehPos(i: number, x: number, z: number, rot: number, url: string) {
  vehiclePositions[i] = { x, z, rot, url, active: true }
}

export function clearVehPos(i: number) {
  if (vehiclePositions[i]) vehiclePositions[i].active = false
}

// Oyuncunun "bindiği" (ele geçirdiği) AI aracının indeksi → o araç gizlenir.
let hijacked = -1
export function setHijacked(i: number) { hijacked = i }
export function getHijacked() { return hijacked }
