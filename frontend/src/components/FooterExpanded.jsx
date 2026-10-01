import { Link } from 'react-router-dom'
import BrandLogo from './BrandLogo'
import { footerColumns } from '@/data/finops'

const legalLinks = ['Terms of Service', 'Privacy Policy', 'Cookie Preferences']

export default function FooterExpanded() {
  return (
    <section className="w-full bg-surface-container-lowest pb-space-lg pt-space-xl">
      <div className="shell gutter-x flex flex-col gap-space-xl">
        <div className="grid grid-cols-2 gap-gutter md:grid-cols-3 lg:grid-cols-6">
          {/* Brand summary — 2 columns */}
          <div className="col-span-2 flex flex-col gap-space-md">
            <div className="flex items-center gap-space-sm">
              <BrandLogo className="h-7 w-7" />
              <span className="font-headline-sm text-headline-sm tracking-tight text-primary">CloudPulse</span>
              <span className="rounded-full border border-primary-container/25 bg-primary-container/10 px-2 py-0.5 font-label-caps text-label-caps uppercase tracking-wider text-primary">
                FinOps
              </span>
            </div>
            <p className="max-w-sm font-body-sm text-body-sm text-on-surface-variant">
              Multi-cloud cost intelligence and resource governance. Read-only ingestion for AWS, Azure and
              Google Cloud — allocation, forecasting and continuous optimisation in one place.
            </p>
            <div className="inline-flex w-fit items-center gap-space-xs rounded-full bg-surface-container-high px-space-sm py-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-status-ok" />
              <span className="font-label-caps text-label-caps uppercase text-on-surface">
                Ingestion Healthy · 99.99% uptime
              </span>
            </div>
          </div>

          {footerColumns.map((col) => (
            <nav key={col.title} className="flex flex-col gap-space-sm" aria-label={col.title}>
              <span className="font-title-md text-title-md text-on-surface">{col.title}</span>
              <div className="flex flex-col gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
                {col.links.map((link) => (
                  <Link key={link} to="/dashboard" className="transition-colors hover:text-primary-container">
                    {link}
                  </Link>
                ))}
              </div>
            </nav>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-space-sm pt-space-md font-body-sm text-body-sm text-on-surface-variant md:flex-row">
          <span>
            © {new Date().getFullYear()} CloudPulse Platform Inc. Multi-cloud cost management for
            hyperscale infrastructure.
          </span>
          <div className="flex items-center gap-space-md">
            {legalLinks.map((link) => (
              <a key={link} href="#top" className="transition-colors hover:text-on-surface">
                {link}
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
