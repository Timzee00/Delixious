import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../src/lib/api.js', () => ({ default: { get: vi.fn() } }));
vi.mock('../src/context/AuthContext.jsx', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

import api from '../src/lib/api.js';
import RestaurantReviewsModal from '../src/components/RestaurantReviewsModal.jsx';

const restaurant = {
  id: 'restaurant-1',
  name: 'Delixious Kitchen',
  rating_avg: 4.5,
  rating_count: 11,
};

function review(id, name, rating = 5) {
  return {
    id,
    reviewer_name: name,
    rating,
    comment: 'Fresh food and a good experience.',
    created_at: '2026-11-18T12:00:00.000Z',
    verified_purchase: true,
  };
}

function renderModal() {
  return render(
    <MemoryRouter>
      <RestaurantReviewsModal restaurant={restaurant} onClose={vi.fn()}/>
    </MemoryRouter>
  );
}

describe('RestaurantReviewsModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads the first page and displays verified customer feedback', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        restaurant: { rating_avg: 4.5, rating_count: 11 },
        reviews: [review('review-1', 'A Customer')],
        has_more: false,
        next_cursor: null,
      },
    });

    renderModal();

    expect(await screen.findByText('A Customer')).toBeInTheDocument();
    expect(screen.getByText('Verified order')).toBeInTheDocument();
    expect(screen.getByText('Fresh food and a good experience.')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/restaurants/restaurant-1/reviews', expect.objectContaining({
      params: { limit: 10 },
    }));
  });

  it('loads older reviews with the returned cursor and appends them', async () => {
    api.get
      .mockResolvedValueOnce({
        data: {
          restaurant: { rating_avg: 4.5, rating_count: 11 },
          reviews: [review('review-1', 'Recent Customer')],
          has_more: true,
          next_cursor: 'cursor-next',
        },
      })
      .mockResolvedValueOnce({
        data: {
          restaurant: { rating_avg: 4.5, rating_count: 11 },
          reviews: [review('review-2', 'Earlier Customer', 4)],
          has_more: false,
          next_cursor: null,
        },
      });

    renderModal();
    expect(await screen.findByText('Recent Customer')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Load older reviews' }));

    expect(await screen.findByText('Earlier Customer')).toBeInTheDocument();
    expect(screen.getByText('Recent Customer')).toBeInTheDocument();
    expect(api.get).toHaveBeenLastCalledWith('/restaurants/restaurant-1/reviews', {
      params: { limit: 10, cursor: 'cursor-next' },
    });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Load older reviews' })).not.toBeInTheDocument());
  });
});
