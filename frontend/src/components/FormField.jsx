import { useId } from 'react';

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
      ) : (
        <input {...common} type={type} />
      )}
      {helpText && <p id={hintId} className="mt-1.5 text-xs text-ink-soft">{helpText}</p>}
      {error && <p id={errorId} className="mt-1.5 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
