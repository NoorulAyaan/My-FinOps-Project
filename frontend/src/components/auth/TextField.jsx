import { forwardRef, useId, useState } from 'react'
import MaterialSymbol from '@/components/MaterialSymbol'

/**
 * Labelled text input with a leading Material icon and an optional
 * show/hide password toggle. Matches the auth design's input treatment:
 * sunken `surface-container-lowest` field, 1px cyan focus ring.
 */
const TextField = forwardRef(function TextField(
  {
    label,
    icon,
    type = 'text',
    placeholder,
    value,
    onChange,
    autoComplete,
    className = '',
    inputClassName = '',
    error,
    // The auth forms sit on light input fills, where the default light text is
    // unreadable. Pass darkText to switch the input value to black.
    darkText = false,
  },
  ref,
) {
  const id = useId()
  const errorId = `${id}-error`
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'
  const resolvedType = isPassword && revealed ? 'text' : type

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="font-label-md text-label-md text-on-surface-variant">
        {label}
      </label>

      <div className="relative flex items-center">
        <MaterialSymbol
          name={icon}
          className="pointer-events-none absolute left-3 text-headline-sm text-on-surface-variant"
        />

        <input
          ref={ref}
          id={id}
          type={resolvedType}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`w-full rounded-lg bg-surface-container-lowest py-2.5 pl-10 text-body-md font-body-md ${
            darkText ? 'text-neutral-900' : 'text-on-surface'
          } placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-1 focus:ring-primary-container ${
            isPassword ? 'pr-10' : 'pr-4'
          } ${error ? 'ring-1 ring-status-crit' : ''} ${inputClassName}`}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            className="absolute right-3 text-on-surface-variant transition-colors hover:text-on-surface focus:outline-none focus-visible:text-primary-container"
          >
            <MaterialSymbol name={revealed ? 'visibility_off' : 'visibility'} className="text-headline-sm" />
          </button>
        )}
      </div>

      {error && (
        <p id={errorId} role="alert" className="flex items-center gap-space-xs text-body-sm text-error">
          <MaterialSymbol name="error" className="text-body-sm" />
          {error}
        </p>
      )}
    </div>
  )
})

export default TextField
