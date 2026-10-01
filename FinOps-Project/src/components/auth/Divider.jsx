/** Horizontal rule with a centred uppercase caption. */
export default function Divider({ children, className = '' }) {
  return (
    <div className={`flex items-center ${className}`}>
      <div className="h-px flex-1 bg-surface-container-highest" />
      <span className="px-space-md font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant">
        {children}
      </span>
      <div className="h-px flex-1 bg-surface-container-highest" />
    </div>
  )
}
