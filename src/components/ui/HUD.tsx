import styles from './HUD.module.css'

export default function HUD() {
  return (
    <div className={styles.hint}>
      Fare ile döndür &middot; Scroll ile zoom &middot; Sağ tık + sürükle ile kaydır
    </div>
  )
}
