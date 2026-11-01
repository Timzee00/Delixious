import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'button:not([disabled])', 'a[href]', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Canonical Delixious dialog: keyboard focus is trapped inside the modal,
 * Escape closes it and focus returns to the opener on unmount.
 */
export default function Modal({ children, onClose, labelledBy, describedBy, className = 'max-w-sm' }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const dialog = dialogRef.current;
    const first = dialog?.querySelector(FOCUSABLE);
    (first || dialog)?.focus();

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;

      const focusables = Array.from(dialog.querySelectorAll(FOCUSABLE))
        .filter(element => element.getClientRects().length > 0 || element.offsetParent !== null);
      // jsdom has no layout, so still trap to actual focusable descendants.
      const elements = focusables.length ? focusables : Array.from(dialog.querySelectorAll(FOCUSABLE));
      if (!elements.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const firstEl = elements[0];
      const lastEl = elements[elements.length - 1];
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? lastEl : firstEl).focus();
      } else if (event.shiftKey && (document.activeElement === firstEl || document.activeElement === dialog)) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && (document.activeElement === lastEl || document.activeElement === dialog)) {
        event.preventDefault();
        firstEl.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = priorOverflow;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/50 px-4 py-6">
      <div ref={dialogRef} role="dialog" aria-modal="true"
        aria-labelledby={labelledBy} aria-describedby={describedBy}
        tabIndex={-1}
        className={`w-full rounded-2xl border border-hairline bg-paper p-6 shadow-xl outline-none focus-visible:ring-2 focus-visible:ring-pepper ${className}`}>
        {children}
      </div>
    </div>
  );
}
