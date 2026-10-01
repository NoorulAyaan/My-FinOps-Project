import { Link } from 'react-router-dom'
import BrandLogo from './BrandLogo'

const links = ['Privacy Policy', 'Security', 'Billing API']

export default function SiteFooter() {
  return (
    <footer className="w-full bg-surface-container-lowest py-space-xl shadow-[0_-1px_8px_rgba(0,0,0,0.3)]">
      <div className="flex w-full flex-col items-center justify-between gap-space-md px-margin text-on-surface-variant md:flex-row">
        <div className="flex items-center gap-space-sm">
          <BrandLogo className="h-6 w-6" imgClassName="opacity-70" />
          <span className="font-headline-sm text-title-md text-on-surface">CloudPulse FinOps</span>
        </div>
        <p className="font-body-sm text-body-sm">
          © {new Date().getFullYear()} CloudPulse Inc. Multi-cloud cost &amp; resource intelligence.
        </p>
        <div className="flex items-center gap-space-lg font-body-sm text-body-sm">
          {links.map((link) => (
            <Link key={link} to="/dashboard" className="text-on-surface-variant transition-colors hover:text-on-surface">
              {link}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  )
}
