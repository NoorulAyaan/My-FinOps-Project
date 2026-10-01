import { useState } from 'react'
import { Link } from 'react-router-dom'
import MaterialSymbol from '@/components/MaterialSymbol'
import SignInForm from '@/components/auth/SignInForm'
import SignUpForm from '@/components/auth/SignUpForm'

const TABS = [
  { id: 'signin', label: 'Sign In', icon: 'login' },
  { id: 'signup', label: 'Create Account', icon: 'person_add' },
]

export default function Auth({ initialMode = 'signin' }) {
  const [mode, setMode] = useState(initialMode)
  const isSignIn = mode === 'signin'

  return (
    <div className="flex min-h-screen justify-center bg-surface p-space-md font-body-md text-on-surface antialiased selection:bg-primary-container selection:text-on-primary-container">
      {/* Ambient atmospheric glows — fixed so they never affect document height */}
      <div className="pointer-events-none fixed -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary-container/10 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-24 right-1/4 h-80 w-80 rounded-full bg-secondary-container/20 blur-3xl" />

      {/* my-auto keeps the card centred when it fits, and scrollable from the
          top when the taller sign-up form exceeds the viewport. */}
      <main className="my-auto flex w-full flex-col items-center justify-center p-space-md sm:p-space-lg">
        <div className="relative z-10 flex w-full max-w-xl flex-col rounded-xl bg-surface-container/80 p-space-lg shadow-2xl backdrop-blur-xl sm:p-space-xl">
          {/* Brand header */}
          <div className="flex items-center justify-between pb-space-lg">
            <div className="flex items-center gap-space-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-highest text-primary-container shadow-md">
                <MaterialSymbol name="hub" className="text-headline-sm" style={{ fontVariationSettings: "'FILL' 1" }} />
              </div>
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm tracking-tight text-on-surface">CloudPulse</span>
                <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant">
                  Enterprise Observability
                </span>
              </div>
            </div>
            <div className="flex items-center gap-space-xs rounded-full bg-surface-container-lowest px-space-sm py-1 text-label-md text-on-surface-variant">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary-container" />
              All Systems Operational
            </div>
          </div>

          {/* Mode tabs */}
          <div
            role="tablist"
            aria-label="Authentication mode"
            className="mb-space-lg grid select-none grid-cols-2 rounded-lg bg-surface-container-lowest p-1"
          >
            {TABS.map((tab) => {
              const active = mode === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={active}
                  aria-controls={`view-${tab.id}`}
                  onClick={() => setMode(tab.id)}
                  className={`flex items-center justify-center gap-2 rounded py-2 text-center font-title-md text-title-md transition-all duration-200 ${
                    active
                      ? 'bg-surface-container-high text-primary-container shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <MaterialSymbol name={tab.icon} className="text-title-md" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Active view */}
          <div
            role="tabpanel"
            id={`view-${mode}`}
            aria-labelledby={`tab-${mode}`}
            className="flex w-full flex-col"
          >
            {isSignIn ? <SignInForm /> : <SignUpForm />}
          </div>

          {/* Alternate-mode prompt */}
          <div className="mt-space-lg flex items-center justify-center border-t border-surface-container-highest/60 pt-space-md">
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              {isSignIn ? "Don't have an account?" : 'Already have an account?'}
            </span>
            <button
              type="button"
              onClick={() => setMode(isSignIn ? 'signup' : 'signin')}
              className="ml-2 font-title-md text-title-md text-primary-container hover:underline"
            >
              {isSignIn ? 'Sign Up' : 'Sign In'}
            </button>
          </div>
        </div>

        {/* Assurance strip */}
        <div className="mt-space-lg flex w-full flex-wrap items-center justify-center gap-space-lg text-center text-label-md text-on-surface-variant/70">
          <span className="flex items-center gap-1.5">
            <MaterialSymbol name="dns" className="text-code-sm" />
            Multi-Cloud Telemetry Ready
          </span>
          <span aria-hidden="true">•</span>
          <span className="flex items-center gap-1.5">
            <MaterialSymbol name="bolt" className="text-code-sm" />
            Read-Only IAM Ingest
          </span>
          <span aria-hidden="true">•</span>
          <Link to="/" className="flex items-center gap-1.5 transition-colors hover:text-on-surface">
            <MaterialSymbol name="arrow_back" className="text-code-sm" />
            Back to site
          </Link>
        </div>
      </main>
    </div>
  )
}
