const LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong']

/**
 * 4-segment password strength meter. Segments below the score are dimmed,
 * filled ones use the strength colour. Score 0-4 derived from length,
 * character-class variety and repeated/sequential characters.
 */
export default function PasswordStrength({ password }) {
  const score = scorePassword(password)
  const filled = password ? score : 0
  const color = ['bg-surface-container-highest', 'bg-status-crit', 'bg-status-warn', 'bg-status-info', 'bg-primary-container'][
    score
  ]

  return (
    <div className="mt-1 flex items-center justify-between px-1">
      <div className="flex w-1/2 gap-1.5" role="img" aria-label={`Password strength: ${LABELS[score]}`}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i <= filled ? color : 'bg-surface-container-highest'}`} />
        ))}
      </div>
      <span
        className={`font-code-sm text-code-sm font-semibold ${
          score >= 3 ? 'text-primary-container' : 'text-on-surface-variant'
        }`}
      >
        Strength: {LABELS[score]}
      </span>
    </div>
  )
}

function scorePassword(pw) {
  if (!pw) return 0

  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++

  // Penalise obvious repetition / sequences
  if (/^(.)\1+$/.test(pw) || /^(0123|1234|abcd|qwer|password|letmein)/i.test(pw)) {
    score = Math.min(score, 1)
  }

  return Math.min(score, 4)
}
