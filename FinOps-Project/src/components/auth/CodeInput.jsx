import { useEffect, useRef, useState } from 'react'
import MaterialSymbol from '@/components/MaterialSymbol'

/**
 * Six single-character boxes for the emailed code. The first box holds focus on
 * mount and typing advances through the boxes; Backspace on an empty box moves
 * back, and a paste of six digits fills them all.
 */
export default function CodeInput({ value, onChange, length = 6, disabled }) {
  const [digits, setDigits] = useState(() => value.split('').slice(0, length))
  const refs = useRef([])

  useEffect(() => {
    setDigits(value.split('').slice(0, length))
  }, [value, length])

  function commit(next) {
    const filled = next.join('')
    setDigits(next)
    onChange(filled)
    return filled
  }

  function handleChange(index, raw) {
    // Strip anything that is not a digit, so a paste of "123 456" still works.
    const digit = raw.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = digit
    const filled = commit(next)
    if (digit && filled.length === length) return
    if (digit && index < length - 1) refs.current[index + 1]?.focus()
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits]
      next[index - 1] = ''
      commit(next)
      refs.current[index - 1]?.focus()
      return
    }
    if (e.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus()
    if (e.key === 'ArrowRight' && index < length - 1) refs.current[index + 1]?.focus()
  }

  function handlePaste(e) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    const next = pasted.split('')
    while (next.length < length) next.push('')
    commit(next)
    refs.current[Math.min(pasted.length, length - 1)]?.focus()
  }

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="Verification code">
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          value={digits[i] ?? ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          aria-label={`Digit ${i + 1} of ${length}`}
          className="h-14 w-full rounded-lg border border-surface-container-highest bg-surface-container-lowest text-center font-headline-md text-headline-md text-on-surface focus:border-primary-container focus:outline-none focus:ring-1 focus:ring-primary-container disabled:opacity-50"
        />
      ))}
      {value.length === length && (
        <MaterialSymbol name="check_circle" className="hidden text-primary-container" aria-hidden />
      )}
    </div>
  )
}
