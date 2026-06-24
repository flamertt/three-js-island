import styles from './LoadingScreen.module.css'

interface Props {
  error?: string | null
}

export default function LoadingScreen({ error }: Props) {
  return (
    <div className={styles.overlay}>
      {error ? (
        <>
          <div className={styles.icon}>⚠</div>
          <p className={styles.title}>Harita yüklenemedi</p>
          <p className={styles.sub}>{error}</p>
        </>
      ) : (
        <>
          <div className={styles.spinner} />
          <p className={styles.title}>Yükleniyor…</p>
        </>
      )}
    </div>
  )
}
