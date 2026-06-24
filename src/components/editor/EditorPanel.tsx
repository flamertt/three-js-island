import type { EditTool } from './RoadEditor'
import styles from './EditorPanel.module.css'
import {
  PencilIcon, TrashIcon, PlusIcon, CheckIcon, CloseIcon,
  UndoIcon, RestoreIcon, ResetIcon,
} from '../ui/icons'

interface Props {
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
  tool, setTool, draftLen,
  removedCount, addedCount,
  onFinishRoad, onCancelDraft, onUndoAdd, onRestoreRemoved, onResetAll,
}: Props) {
  return (
    <div className={styles.panel}>
      <p className={styles.title}><PencilIcon size={16} /> Yol Editörü</p>

      <div className={styles.row}>
        <button
          className={`${styles.btn} ${tool === 'delete' ? styles.active : ''}`}
          onClick={() => setTool('delete')}
        >
          <TrashIcon size={15} /> Sil
        </button>
        <button
          className={`${styles.btn} ${tool === 'add' ? styles.active : ''}`}
          onClick={() => setTool('add')}
        >
          <PlusIcon size={15} /> Ekle
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
              <CheckIcon size={15} /> Bitir ({draftLen})
            </button>
            <button className={styles.btn} onClick={onCancelDraft} disabled={draftLen === 0}>
              <CloseIcon size={15} /> İptal
            </button>
          </div>
        </>
      )}

      <div className={styles.row}>
        <button className={styles.btn} onClick={onUndoAdd} disabled={addedCount === 0}>
          <UndoIcon size={15} /> Son ekleneni sil
        </button>
      </div>
      <div className={styles.row}>
        <button className={styles.btn} onClick={onRestoreRemoved} disabled={removedCount === 0}>
          <RestoreIcon size={15} /> Silinenleri geri al
        </button>
      </div>
      <div className={styles.row}>
        <button className={`${styles.btn} ${styles.danger}`} onClick={onResetAll}>
          <ResetIcon size={15} /> Tümünü sıfırla
        </button>
      </div>

      <p className={styles.stat}>Silinen: {removedCount} · Eklenen: {addedCount}</p>
    </div>
  )
}
