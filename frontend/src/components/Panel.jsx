/** Panel shell with the design system's top-lit border and optional header actions. */
export default function Panel({ title, subtitle, icon, actions, children, className = '', bodyClassName = '' }) {
  return (
    <section
      className={`flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-surface-container/70 shadow-lg backdrop-blur-xl ${className}`}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-space-sm border-b border-white/[0.06] px-space-lg py-space-md">
          <div className="flex min-w-0 items-center gap-space-sm">
            {icon && (
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-surface-container-high text-primary-container">
                <span className="material-symbols-outlined text-headline-sm leading-none">{icon}</span>
              </span>
            )}
            <div className="min-w-0">
              <h2 className="truncate font-title-md text-title-md text-on-surface">{title}</h2>
              {subtitle && (
                <p className="truncate font-body-sm text-body-sm text-on-surface-variant">{subtitle}</p>
              )}
            </div>
          </div>
          {actions && <div className="flex flex-none items-center gap-space-xs">{actions}</div>}
        </header>
      )}
      <div className={`flex-1 p-space-lg ${bodyClassName}`}>{children}</div>
    </section>
  )
}
