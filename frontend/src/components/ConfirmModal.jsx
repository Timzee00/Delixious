import Modal from './Modal.jsx';
import { Button } from './ui/Primitives.jsx';

export default function ConfirmModal({ title, message, confirmLabel = 'Confirm', onCancel, onConfirm }) {
  return (
    <Modal onClose={onCancel} labelledBy="confirm-modal-title" describedBy="confirm-modal-description">
      <h3 id="confirm-modal-title" className="font-display text-lg font-bold text-ink">
        {title}
      </h3>
      <p id="confirm-modal-description" className="mt-2 text-sm leading-6 text-ink-soft">{message}</p>
      <div className="mt-6 flex gap-3">
        <Button variant="secondary" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button onClick={onConfirm} className="flex-1">{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
