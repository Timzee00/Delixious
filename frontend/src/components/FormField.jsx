import { useId, useState } from 'react';

/**
 * Canonical form field for customer, partner and admin forms.
 * Keeps the existing onChange(value) API while supporting accessible errors.
 */
export default function FormField({
  label, type = 'text', as = 'input', value, onChange,
  required = false, placeholder, rows = 3, id, error,
  helpText, disabled = false, className = '', ...fieldProps
}) {
  const generatedId = useId();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const fieldId = id || generatedId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const describedBy = [helpText ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  const sharedClassName = `min-h-11 w-full rounded-xl border bg-paper px-3 py-2.5 text-base text-ink
    placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-pepper/20
    disabled:cursor-not-allowed disabled:bg-sand disabled:text-ink-soft
    ${error ? 'border-danger focus:border-danger' : 'border-hairline focus:border-pepper'} ${className}`;
  const common = {
    id: fieldId, value, required, placeholder, disabled,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    onChange: e => onChange(e.target.value),
    className: sharedClassName,
    ...fieldProps,
  };

  return (
    <div className="block">
      <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-ink">
        {label}{required ? <span className="ml-1 text-danger" aria-hidden="true">*</span> : null}
      </label>
      {as === 'textarea' ? (
        <textarea {...common} rows={rows} className={`${sharedClassName} min-h-24 resize-none`} />
      ) : type === 'password' ? (
        <div className="relative">
          <input {...common} type={passwordVisible ? 'text' : 'password'} autoComplete={fieldProps.autoComplete || 'current-password'} className={`${sharedClassName} pr-12`} />
          <button
            type="button"
            onClick={() => setPasswordVisible(value => !value)}
            aria-label={passwordVisible ? 'Hide password' : 'Show password'}
            aria-pressed={passwordVisible}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-ink-soft transition hover:text-pepper focus-visible:outline focus-visible:outline-2 focus-visible:outline-pepper"
          >
            {passwordVisible ? (
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                <path d="M9.9 5.2A11.7 11.7 0 0 1 12 5c5.5 0 9 7 9 7a16 16 0 0 1-3.2 4.1M6.2 6.2C4.1 7.7 3 12 3 12s3.5 7 9 7a10.7 10.7 0 0 0 4.2-.8" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                <circle cx="12" cy="12" r="2.7" />
              </svg>
            )}
          </button>
        </div>
      ) : (
        <input {...common} type={type} />
      )}
      {helpText && <p id={hintId} className="mt-1.5 text-xs text-ink-soft">{helpText}</p>}
      {error && <p id={errorId} className="mt-1.5 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
