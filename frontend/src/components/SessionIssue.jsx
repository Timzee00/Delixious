export default function SessionIssue({ message, onRetry }) {
  return (
    <section role="alert" className="mx-auto flex min-h-[45vh] max-w-lg items-center px-4 py-12">
      <div className="w-full rounded-2xl border border-hairline bg-paper p-7 text-center">
        <h1 className="font-display text-xl font-bold text-ink">Unable to check your session</h1>
        <p className="mt-3 text-sm leading-6 text-ink-soft">{message}</p>
        <button type="button" onClick={onRetry}
          className="mt-6 min-h-11 rounded-xl bg-pepper px-6 py-2.5 text-sm font-semibold text-white hover:bg-pepper-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-pepper">
          Try again
        </button>
      </div>
    </section>
  );
}
