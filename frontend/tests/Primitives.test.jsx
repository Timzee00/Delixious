import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Icon from '../src/components/ui/Icon.jsx';
import { Button, SearchField, InlineStatus } from '../src/components/ui/Primitives.jsx';

describe('Delixious shared UI primitives', () => {
  it('renders decorative SVG icons without a redundant screen-reader name', () => {
    const { container } = render(<Icon name="wallet" size={22} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('width', '22');
  });

  it('makes explicitly labeled icons available to screen readers', () => {
    render(<Icon name="search" aria-label="Search" />);
    expect(screen.getByRole('img', { name: 'Search' })).toBeInTheDocument();
  });

  it('clears the search input using a keyboard-accessible button', () => {
    const onChange = vi.fn();
    render(<SearchField id="search-dishes" label="Search dishes" value="rice" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear search dishes' }));
    expect(onChange).toHaveBeenCalledWith('');
    expect(screen.getByRole('searchbox', { name: 'Search dishes' })).toHaveFocus();
  });

  it('keeps a busy button disabled to prevent duplicate checkout clicks', () => {
    render(<Button busy>Place order</Button>);
    expect(screen.getByRole('button', { name: /Place order/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Place order/i })).toHaveAttribute('aria-busy', 'true');
  });

  it('provides an accessible error role and visible text', () => {
    render(<InlineStatus tone="error">Network unavailable. Retry.</InlineStatus>);
    expect(screen.getByRole('alert')).toHaveTextContent('Network unavailable. Retry.');
  });
});
