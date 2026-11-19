import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import FavoriteButton from '../src/components/FavoriteButton.jsx';

describe('FavoriteButton', () => {
  it('shows a filled orange heart when the restaurant is saved', () => {
    render(<FavoriteButton active onClick={vi.fn()} label="restaurant"/>);
    const button = screen.getByRole('button', { name: 'Remove restaurant' });
    const heart = button.querySelector('svg');

    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(heart).toHaveAttribute('fill', '#E85A24');
    expect(heart).toHaveAttribute('stroke', '#E85A24');
    expect(button).toHaveClass('bg-[#FFF0E8]');
  });

  it('keeps an unsaved restaurant heart outlined', () => {
    render(<FavoriteButton active={false} onClick={vi.fn()} label="restaurant"/>);
    const button = screen.getByRole('button', { name: 'Add restaurant' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button.querySelector('svg')).toHaveAttribute('fill', 'none');
  });

  it('invokes the saved-state action when pressed', () => {
    const onClick = vi.fn();
    render(<FavoriteButton active={false} onClick={onClick} label="restaurant"/>);
    fireEvent.click(screen.getByRole('button', { name: 'Add restaurant' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
