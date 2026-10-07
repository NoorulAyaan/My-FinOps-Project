import { Link, NavLink } from 'react-router-dom'
import BrandLogo from './BrandLogo'
import AccountMenu from './AccountMenu'
import { useAuth } from '@/auth/AuthContext'

const NAV = [
  { label: 'Platform', to: '/#platforms' },
  { label: 'Cost', to: '/#cost' },
  { label: 'Resources', to: '/#inventory' },
  { label: 'Savings', to: '/#savings' },
]

export default function Header() {
  const { user, status } = useAuth()
  const signedIn = status === 'authenticated' && user

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-surface/85 shadow-[0_1px_8px_rgba(0,0,0,0.4)] backdrop-blur-xl">
      <div className="flex h-16 w-full items-center justify-between gap-space-md px-margin">
        <Link to="/" className="flex items-center gap-space-sm" aria-label="CloudPulse home">
          <BrandLogo className="h-8 w-8" />
          <span className="font-headline-sm text-headline-sm tracking-tight text-primary">CloudPulse</span>
          <span className="hidden rounded-full border border-primary-container/25 bg-primary-container/10 px-2 py-0.5 font-label-caps text-label-caps uppercase tracking-wider text-primary sm:inline">
            FinOps
          </span>
        </Link>

        <nav className="hidden items-center gap-space-md lg:flex" aria-label="Primary">
          {NAV.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className="font-title-md text-title-md text-on-surface-variant transition-colors hover:text-primary-container"
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-space-md">

          {/* Signed in: show who is here instead of the auth pitch. */}
          {signedIn ? (
            <AccountMenu className="hidden sm:flex" />
          ) : (
            <Link
              to="/login"
              className="hidden rounded-lg bg-surface-container-high px-space-md py-space-sm font-title-md text-title-md text-on-surface transition-colors hover:bg-surface-bright sm:inline-flex"
            >
              Sign in to console
            </Link>
          )}

          <Link
            to="/dashboard"
            className="inline-flex items-center gap-space-xs rounded-lg bg-primary-container px-space-md py-space-sm font-headline-sm text-title-md text-on-primary shadow-[0_0_16px_rgba(0,240,255,0.3)] transition-all hover:shadow-[0_0_24px_rgba(0,240,255,0.5)]"
          >
            <span className="material-symbols-outlined text-title-md leading-none">dashboard</span>
            Cost Dashboard
          </Link>
        </div>
      </div>
    </header>
  )
}
