'use client';
import styles from './Modal.module.css';

interface Props {
  show: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  show, title, message,
  confirmLabel = 'Yes', cancelLabel = 'Cancel',
  onConfirm, onCancel,
}: Props) {
  if (!show) return null;
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.msg}>{message}</p>
        <div className={styles.btnRow}>
          <button className={styles.btnPrimary} onClick={onConfirm}>{confirmLabel}</button>
          <button className={styles.btnGhost} onClick={onCancel}>{cancelLabel}</button>
        </div>
      </div>
    </div>
  );
}
