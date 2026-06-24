import type { EditTool } from './RoadEditor'
import styles from './EditorPanel.module.css'

interface Props {
  open: boolean
  setOpen: (v: boolean) => void
  tool: EditTool
  setTool: (t: EditTool) => void
  draftLen: number
  removedCount: number
  addedCount: number
  onFinishRoad: () => void
  onCancelDraft: () => void
  onUndoAdd: () => void
  onRestoreRemoved: () => void
  onResetAll: () => void
}

export default function EditorPanel({
  open, setOpen, tool, setTool, draftLen,
  removedCount, addedCount,
  onFinishRoad, onCancelDraft, onUndoAdd, onRestoreRemoved, onResetAll,
}: Props) {
  if (!open) {
    return (
      <button className={styles.toggle} onClick={() => setOpen(true)}>
        ✏️ Yol Düzenle
      </button>
    )
  }

  return (
    <div className={styles.panel}>
      <p className={styles.title}>✏️ Yol Editörü</p>

      <div className={styles.row}>
        <button
          className={`${styles.btn} ${tool === 'delete' ? styles.active : ''}`}
          onClick={() => setTool('delete')}
        >
          🗑 Sil
        </button>
        <button
          className={`${styles.btn} ${tool === 'add' ? styles.active : ''}`}
          onClick={() => setTool('add')}
        >
          ➕ Ekle
        </button>
      </div>

      {tool === 'delete' && (
        <p className={styles.hint}>Silmek için bir yola tıkla.</p>
      )}

      {tool === 'add' && (
        <>
          <p className={styles.hint}>
            Zemine tıklayarak nokta ekle. En az 2 nokta sonra “Bitir”.
          </p>
          <div className={styles.row}>
            <button
              className={`${styles.btn} ${styles.primary}`}
              onClick={onFinishRoad}
              disabled={draftLen < 2}
            >
              ✓ Bitir ({draftLen})
            </button>
            <button className={styles.btn} onClick={onCancelDraft} disabled={draftLen === 0}>
              İptal
            </button>
          </div>
        </>
      )}

      <div className={styles.row}>
        <button className={styles.btn} onClick={onUndoAdd} disabled={addedCount === 0}>
          ↶ Son ekleneni sil
        </button>
      </div>
      <div className={styles.row}>
        <button className={styles.btn} onClick={onRestoreRemoved} disabled={removedCount === 0}>
          Silinenleri geri al
        </button>
      </div>
      <div className={styles.row}>
        <button className={`${styles.btn} ${styles.danger}`} onClick={onResetAll}>
          Tümünü sıfırla
        </button>
      </div>

      <p className={styles.stat}>Silinen: {removedCount} · Eklenen: {addedCount}</p>

      <div className={styles.row} style={{ marginTop: 4 }}>
        <button className={styles.btn} onClick={() => setOpen(false)}>Kapat</button>
      </div>
    </div>
  )
}
