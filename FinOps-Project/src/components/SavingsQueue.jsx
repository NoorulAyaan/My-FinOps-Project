import { useState } from 'react'
import Panel from './Panel'
import StatusPill from './StatusPill'
import { opportunities, kpis } from '@/data/finops'
import { usd, usdCompact } from '@/utils/format'

const TONE = { aws: 'cyan', azure: 'indigo', gcp: 'sky', multi: 'muted' }
const PROVIDER_LABEL = { aws: 'AWS', azure: 'Azure', gcp: 'GCP', multi: 'Multi-cloud' }

const FILTERS = ['all', 'Rightsizing', 'Idle Resources', 'Commitments', 'Architecture']

export default function SavingsQueue() {
  const [filter, setFilter] = useState('all')
  const [applied, setApplied] = useState(() => new Set())

  const rows = filter === 'all' ? opportunities : opportunities.filter((o) => o.category === filter)
  const potential = rows.reduce((s, o) => s + (applied.has(o.id) ? 0 : o.monthly), 0)

  function toggle(id) {
    setApplied((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <section id="savings" className="w-full scroll-mt-24 px-margin py-space-xl">
      <div className="shell mx-auto flex flex-col gap-space-xl">
        <div className="flex flex-col justify-between gap-space-sm md:flex-row md:items-end">
          <div className="flex flex-col gap-space-xs">
            <span className="font-label-caps text-label-caps uppercase tracking-wider text-primary">
              Continuous Optimisation
            </span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Your Savings Queue</h2>
            <p className="max-w-2xl font-body-md text-body-md text-on-surface-variant">
              Ranked by monthly saving, confidence and effort. Nothing here is a guess — each finding is
              derived from measured utilisation and actual billing data.
            </p>
          </div>
          <div className="flex flex-none flex-col items-end">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Accepting</span>
            <span className="tnum font-headline-md text-headline-md font-bold text-primary">
              {usd(potential)} / mo
            </span>
          </div>
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap items-center gap-space-xs">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`rounded-full border px-space-md py-1.5 font-label-caps text-label-caps uppercase tracking-wider transition-all ${
                filter === f
                  ? 'border-primary-container/40 bg-primary-container/12 text-primary'
                  : 'border-white/[0.10] bg-surface-container text-on-surface-variant hover:border-white/20 hover:text-on-surface'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <Panel
          title="Open Recommendations"
          subtitle={`${rows.length} findings · ${usd(kpis.savingsIdentified)} identified all-time`}
          icon="savings"
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead className="bg-surface-container/95 backdrop-blur-xl">
                <tr className="border-b border-white/[0.08]">
                  {['Recommendation', 'Cloud', 'Confidence', 'Effort', 'Monthly Saving', ''].map((h, i) => (
                    <th
                      key={h || i}
                      scope="col"
                      className={`px-space-md py-space-sm font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant ${
                        i === 3 || i === 4 ? 'text-right' : ''
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const isApplied = applied.has(o.id)
                  return (
                    <tr
                      key={o.id}
                      className={`border-b border-white/[0.04] transition-colors odd:bg-white/[0.015] hover:bg-primary-container/[0.03] ${
                        isApplied ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="px-space-md py-3">
                        <div className="flex flex-col">
                          <span
                            className={`font-body-md text-body-md font-medium ${
                              isApplied ? 'text-on-surface-variant line-through' : 'text-on-surface'
                            }`}
                          >
                            {o.title}
                          </span>
                          <span className="font-code-sm text-code-sm text-on-surface-variant">{o.category}</span>
                        </div>
                      </td>
                      <td className="px-space-md py-3 font-body-sm text-body-sm text-on-surface-variant">
                        {PROVIDER_LABEL[o.provider]}
                      </td>
                      <td className="px-space-md py-3">
                        <StatusPill tone={o.confidence === 'High' ? 'ok' : 'warn'}>{o.confidence}</StatusPill>
                      </td>
                      <td className="px-space-md py-3 text-right font-body-sm text-body-sm text-on-surface-variant">
                        {o.effort}
                      </td>
                      <td className="tnum px-space-md py-3 text-right">
                        <span className="font-code-sm text-code-sm text-on-surface">{usd(o.monthly)}</span>
                        <span className="block font-code-sm text-code-sm text-on-surface-variant">/ mo</span>
                      </td>
                      <td className="px-space-md py-3 text-right">
                        <button
                          type="button"
                          onClick={() => toggle(o.id)}
                          aria-pressed={isApplied}
                          className={`whitespace-nowrap rounded-lg px-space-md py-1.5 font-title-md text-title-md transition-all ${
                            isApplied
                              ? 'bg-surface-container-highest text-on-surface-variant hover:text-on-surface'
                              : 'bg-primary-container text-on-primary hover:bg-surface-tint'
                          }`}
                        >
                          {isApplied ? 'Undo' : 'Accept'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </section>
  )
}
