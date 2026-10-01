import MaterialSymbol from './MaterialSymbol'
import { capabilities } from '@/data/finops'

export default function FeaturesBento() {
  return (
    <section id="platform" className="w-full scroll-mt-24 px-margin py-space-xl">
      <div className="shell mx-auto flex flex-col gap-space-xl">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-space-xs text-center">
          <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary">
            The FinOps Operating Model
          </span>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">
            Visibility, Accountability, Continuous Optimisation
          </h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            The three things a cloud cost programme needs — and the reason most of them stall after the first
            invoice.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((c) => (
            <article
              key={c.title}
              className="group flex flex-col justify-between gap-space-md rounded-2xl bg-surface-container p-space-lg shadow-md transition-all hover:bg-surface-bright hover:shadow-xl"
            >
              <div className="flex flex-col gap-space-md">
                <div className="flex items-center justify-between">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-high ${c.accent}`}
                  >
                    <MaterialSymbol name={c.icon} className="text-headline-md" />
                  </div>
                  <span
                    className={`inline-flex h-[22px] items-center rounded-full bg-surface-container-high px-space-xs font-label-caps text-label-caps uppercase tracking-wider ${c.tagAccent}`}
                  >
                    {c.tag}
                  </span>
                </div>

                <div className="flex flex-col gap-space-xs">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">{c.title}</h3>
                  <p className="font-body-md text-body-md text-on-surface-variant">{c.body}</p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-surface-container-low p-space-sm">
                <span className="font-code-sm text-code-sm text-on-surface-variant">{c.footLabel}</span>
                <span className={`tnum font-code-sm text-code-sm ${c.footAccent}`}>{c.footValue}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
