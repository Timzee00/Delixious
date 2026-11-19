export default function FavoriteButton({ active, onClick, disabled = false, label = 'Favorite' }) {
  const accent = '#E85A24';

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `Remove ${label}` : `Add ${label}`}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pepper ${
        active
          ? 'border-[#E85A24] bg-[#FFF0E8] text-[#E85A24] shadow-sm'
          : 'border-hairline bg-paper text-ink-soft hover:border-[#E85A24] hover:bg-[#FFF8F3] hover:text-[#E85A24]'
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill={active ? accent : 'none'}
        stroke={active ? accent : 'currentColor'}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={active ? 'drop-shadow-[0_1px_1px_rgba(232,90,36,0.15)]' : ''}
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" />
      </svg>
    </button>
  );
}
