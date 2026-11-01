import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '../src/components/Modal.jsx';

function Dialog({ onClose }) {
  return (
    <Modal onClose={onClose} labelledBy="dialog-heading" describedBy="dialog-description">
      <h2 id="dialog-heading">Cancel order?</h2>
      <p id="dialog-description">This cannot be undone.</p>
      <button type="button">Keep order</button>
      <button type="button">Cancel order</button>
    </Modal>
  );
}

describe('shared modal keyboard behavior', () => {
  it('focuses the first dialog action and traps forward and backward Tab', () => {
    render(<Dialog onClose={vi.fn()} />);
    const first = screen.getByRole('button', { name: 'Keep order' });
    const last = screen.getByRole('button', { name: 'Cancel order' });
    expect(first).toHaveFocus();
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(first).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
  });

  it('restores the original focus and scroll settings when closed', () => {
    const { unmount } = render(
      <>
        <button type="button">Open dialog</button>
      </>
    );
    screen.getByRole('button', { name: 'Open dialog' }).focus();
    const modal = render(<Dialog onClose={vi.fn()} />);
    expect(document.body.style.overflow).toBe('hidden');
    modal.unmount();
    expect(screen.getByRole('button', { name: 'Open dialog' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
    unmount();
  });

  it('closes when Escape is pressed', () => {
    const close = vi.fn();
    render(<Dialog onClose={close} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
  });
});
