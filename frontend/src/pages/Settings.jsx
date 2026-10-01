import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import AccountMenu from '@/components/AccountMenu'
import BrandLogo from '@/components/BrandLogo'
import MaterialSymbol from '@/components/MaterialSymbol'
import SettingsNav from '@/components/settings/SettingsNav'
import ProfileSection from '@/components/settings/ProfileSection'
import SecuritySection from '@/components/settings/SecuritySection'
import ConnectionsSection from '@/components/settings/ConnectionsSection'
import SessionsSection from '@/components/settings/SessionsSection'

import { useAuth } from '@/auth/AuthContext'

const SECTIONS = {
  profile: 'Profile',
  security: 'Security',
  connections: 'Cloud accounts',
  sessions: 'Active sessions',
}

export default function Settings() {
  const [section, setSection] = useState('profile')
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-surface font-body-md text-on-surface antialiased">
      <div className="pointer-events-none fixed -top-32 left-1/3 h-96 w-96 rounded-full bg-primary-container/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-margin py-space-md">
        <header className="flex flex-wrap items-center justify-between gap-space-sm border-b border-white/[0.06] pb-space-md">
          <div className="flex items-center gap-space-sm">
            {/* The logo alone is a weak way home, so the way back is an
                explicit control like the Dashboard's "Back to site". */}
            <Link
              to="/"
              className="flex items-center gap-space-xs rounded-lg bg-surface-container-high px-space-sm py-2 font-title-md text-title-md text-on-surface transition-colors hover:bg-surface-bright"
            >
              <MaterialSymbol name="arrow_back" className="text-title-md" />
              <span className="hidden sm:inline">Back to home</span>
            </Link>
            <Link to="/" className="flex items-center gap-space-sm" aria-label="CloudPulse home">
              <BrandLogo className="h-8 w-8" />
              <span className="font-headline-sm text-headline-sm tracking-tight text-primary">
                CloudPulse
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-space-sm">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="hidden items-center gap-space-xs rounded-lg bg-surface-container-high px-space-sm py-2 font-title-md text-title-md text-on-surface transition-colors hover:bg-surface-bright sm:inline-flex"
            >
              <MaterialSymbol name="dashboard" className="text-title-md" />
              Dashboard
            </button>
            <AccountMenu />
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-space-lg py-space-lg lg:flex-row">
          <aside className="lg:w-56 lg:flex-none">
            <SettingsNav active={section} onSelect={setSection} />
          </aside>

          <main className="flex min-w-0 flex-1 flex-col gap-space-md">
            <div>
              <h1 className="font-headline-md text-headline-md tracking-tight">
                {SECTIONS[section]}
              </h1>
              <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                Signed in as {user?.email}
              </p>
            </div>

            {section === 'profile' && <ProfileSection />}
            {section === 'security' && <SecuritySection />}
            {section === 'connections' && <ConnectionsSection />}
            {section === 'sessions' && <SessionsSection />}
          </main>
        </div>
      </div>
    </div>
  )
}