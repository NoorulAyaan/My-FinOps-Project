import MaterialSymbol from './MaterialSymbol'

/**
 * Month-over-month delta chip.
 * Cost going UP is bad (rose); cost going DOWN is good (emerald).
 */
export default function DeltaChip({ value, className = '' }) {
  const up = value > 0
  return (
    <span
      className={`tnum inline-flex items-center gap-0.5 whitespace-nowrap rounded-full px-1.5 py-0.5 font-code-sm text-code-sm font-semibold ${
        up ? 'bg-status-crit/15 text-status-crit' : 'bg-status-ok/15 text-status-ok'
      } ${className}`}
      title={`${Math.abs(value).toFixed(1)}% ${up ? 'increase' : 'decrease'} vs last month`}
    >
      <MaterialSymbol name={up ? 'north_east' : 'south_east'} className="text-[12px] leading-none" />
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}
