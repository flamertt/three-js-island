import * as M from '../assets/models'

// ─── Model listeleri ──────────────────────────────────────────────────────────
export const SKYSCRAPER_MODELS = [M.skyA, M.skyB, M.skyC, M.skyD, M.skyE]
export const COMMERCIAL_MODELS = [M.comA, M.comB, M.comC, M.comD, M.comE, M.comF]
export const SUBURBAN_MODELS   = [M.subA, M.subB, M.subC, M.subD, M.subE, M.subF]
// Normal şehir trafiği — F1/race ve traktör gibi alakasız modeller çıkarıldı
export const VEHICLE_MODELS    = [
  M.sedan, M.taxi, M.van, M.delivery, M.suv,
  M.truck, M.sedanSports, M.hatchback, M.suvLuxury, M.garbageTruck,
]
// Acil durum araçları (daha hızlı davranış)
export const EMERGENCY_MODELS  = [M.ambulance, M.firetruck, M.police]
export const TREE_MODELS       = [M.treePineA, M.treePineB, M.treeTall]

// ─── Model ölçekleri (SCALE=0.062, ~280 scene unit şehir) ────────────────────
// Şehir genişliğine göre görünür olmaları için büyük tutuldu
export const SKYSCRAPER_SCALE = 5.0
export const COMMERCIAL_SCALE = 4.0
export const SUBURBAN_SCALE   = 3.6

// ─── Bina ölçeği (rng'siz, deterministik) ────────────────────────────────────
// Hem render (OsmBuilding) hem yerleşim (parser) aynı ölçeği kullanır ki
// taşma hesabı tutarlı olsun.
export type BuildKind = 'sky' | 'commercial' | 'suburban'
export function buildingScale(
  area: number, levels: number, id: number, tag: string,
): { kind: BuildKind; scale: number } {
  const s = Math.sqrt(Math.max(area, 0.5))
  const isDefiniteSky = levels >= 12 || tag === 'skyscraper' || tag === 'tower'
  const isLargeSky = levels >= 7 && area > 10
  if (isDefiniteSky || isLargeSky)
    return { kind: 'sky', scale: Math.min(Math.max(s * 1.3, 3.5), SKYSCRAPER_SCALE * 1.4) }

  const idSlot = Math.abs(id) % 20
  if (idSlot < 3 && (levels >= 5 || area > 20))
    return { kind: 'sky', scale: Math.min(Math.max(s * 1.2, 3.0), SKYSCRAPER_SCALE * 1.2) }

  const isCommercialTag = ['commercial', 'retail', 'office', 'hotel', 'apartments', 'mixed_use', 'civic'].includes(tag)
  if (idSlot < 10 || levels >= 3 || isCommercialTag)
    return { kind: 'commercial', scale: Math.min(Math.max(s * 1.4, 2.0), COMMERCIAL_SCALE * 1.3) }

  // İnsan (~4 birim) ve araçlara göre orantılı dursun diye taban büyütüldü.
  // Ayak-izi (= scale×1.05) parser tarafından yoldan ittirilir → yola taşmaz.
  return { kind: 'suburban', scale: Math.min(Math.max(s * 1.9, 2.4), SUBURBAN_SCALE * 1.2) }
}

// Model ayak izi ~ scale × MODEL_HALF; köşegen için biraz pay → taşma garantili.
// (Modeller ~0.85–1.76 birim geniş; yarısı ~0.45–0.88, köşegenle ~1.0×scale)
export function buildingFootprintRadius(scale: number): number {
  return scale * 1.05
}
export const VEHICLE_SCALE    = 1.4   // araç ölçeği
export const SHIP_SCALE       = 3.0   // büyük gemiler
export const BOAT_SCALE       = 1.8   // küçük tekneler

// ─── Ada / kıyı sınırları (Ground 430×360'a göre) ────────────────────────────
export const ISLAND_HALF_X = 200
export const ISLAND_HALF_Z = 165

// ─── Şehir geometrisi ────────────────────────────────────────────────────────
export const CITY_RADIUS = 175   // binalar/proplar bu dairenin içinde
export const RING_RADIUS = 196   // çevre yolu yarıçapı (buraya kadar daire)

// ─── Helikopter pisti (şehir merkezi) ────────────────────────────────────────
export const HELIPAD_RADIUS = 30   // pist yarıçapı; bu daire içinde bina/ağaç yok

// ─── Tarım/park alanı (dış çim kuşağı — boş, bina/yol yok) ───────────────────
export const FARM_CENTER: [number, number] = [-189, -109]
export const FARM_RADIUS = 18

// ─── Organik ada kıyısı (çevre yolundan sonrası) ─────────────────────────────
// Çevre yoluna kadar daire; ondan sonra açıya bağlı harmonik toplamıyla
// asimetrik, gerçek ada gibi düzensiz kıyı. min daima RING_RADIUS'tan büyük.
const COAST_BASE = 226
const COAST_HARMONICS: [number, number, number][] = [
  // [frekans, genlik, faz]
  [2, 9, 0.7],
  [3, 6, 2.1],
  [5, 4, 4.3],
  [7, 3, 1.2],
  [11, 2, 5.0],
]
export function islandRadius(theta: number): number {
  let r = COAST_BASE
  for (const [f, a, p] of COAST_HARMONICS) r += a * Math.sin(f * theta + p)
  return r
}
// min/max'ı örnekleyerek hesapla
function sampleExtents() {
  let mn = Infinity, mx = -Infinity
  for (let i = 0; i < 720; i++) {
    const r = islandRadius((i / 720) * Math.PI * 2)
    if (r < mn) mn = r
    if (r > mx) mx = r
  }
  return { mn, mx }
}
const _ext = sampleExtents()
export const ISLAND_MIN_R = _ext.mn   // ~ 195+ (şehir güvenli)
export const ISLAND_MAX_R = _ext.mx   // çim kıyısının en dış noktası

// Kumsal: çim kıyısından DIŞA, denize doğru eklenen kum şeridi genişliği.
// Çim küçülmez; ada bu kadar büyür.
export const BEACH_WIDTH = 26
export const COAST_OUTER_MAX = ISLAND_MAX_R + BEACH_WIDTH  // kumsalın en dış noktası

// Geriye dönük uyumluluk (eski kod yuvarlak yarıçap bekliyordu)
export const GROUND_RADIUS = COAST_BASE

// ─── Yol görsel genişlikleri (scene unit) ────────────────────────────────────
export const ROAD_WIDTHS: Record<string, number> = {
  primary:       5.5,
  secondary:     4.5,
  tertiary:      3.5,
  residential:   2.8,
  unclassified:  2.8,
  living_street: 2.0,
}

// ─── Bina alan eşikleri (scene unit²) — SCALE=0.062 için kalibre edildi ──────
// Gerçek alan (m²) = scene_area / (0.062²) = scene_area / 0.003844
// 15 scene² → ~3900 m² → büyük blok bina
// 4  scene² → ~1040 m² → orta ticari bina
export const AREA_SKYSCRAPER = 15   // > bu → gökdelen
export const AREA_COMMERCIAL  = 4   // > bu → ticari
