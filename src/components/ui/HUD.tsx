import styles from './HUD.module.css'

export default function HUD() {
  return (
    <div className={styles.hint}>
      Sağ tık döndür &middot; Sol tık kaydır &middot; Scroll zoom &middot; 🧍 WASD &middot; E helikopter &middot; F araba
    </div>
  )
}
