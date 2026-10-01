import { Link } from 'react-router-dom'
import MaterialSymbol from '@/components/MaterialSymbol'
import { useAuth } from '@/auth/AuthContext'

/**
 * Shared chrome for every auth screen: the brand header, the card, and the
 * assurance strip. The reset screens reuse it so they match sign-in and sign-up
 * instead of growing their own layout.
 */
export default function AuthShell({ children, footer }) {
  const { status } = useAuth()
  const signedIn = status === 'authenticated'

  return (
    <div className="flex min-h-screen justify-center bg-surface p-space-md font-body-md text-on-surface antialiased selection:bg-primary-container selection:text-on-primary-container">
      {/* Ambient atmospheric glows — fixed so they never affect document height */}
      <div className="pointer-events-none fixed -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary-container/10 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-24 right-1/4 h-80 w-80 rounded-full bg-secondary-container/20 blur-3xl" />

      {/* my-auto keeps the card centred when it fits, and scrollable from the
          top when the taller sign-up form exceeds the viewport. */}
      <main className="my-auto flex w-full flex-col items-center justify-center p-space-md sm:p-space-lg">
        <div className="relative z-10 flex w-full max-w-xl flex-col rounded-xl bg-surface-container/80 p-space-lg shadow-2xl backdrop-blur-xl sm:p-space-xl">
          {/* Explicit way home. The "Back to site" link in the footer is easy to
              miss, so the same destination is offered as a real button at the top
              of the card on every auth screen. */}
          <div className="flex justify-start pb-space-md">
            <Link
              to="/"
              className="inline-flex items-center gap-space-xs rounded-lg bg-surface-container-high px-space-sm py-2 font-title-md text-title-md text-on-surface transition-colors hover:bg-surface-bright"
            >
              <MaterialSymbol name="arrow_back" className="text-title-md" />
              Back to home
            </Link>
          </div>

          {/* Brand header */}
          <div className="flex items-center justify-between pb-space-lg">
            <div className="flex items-center gap-space-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-highest text-primary-container shadow-md">
                <MaterialSymbol
                  name="savings"
                  className="text-headline-sm"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                />
              </div>
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm tracking-tight text-on-surface">
                  CloudPulse
                </span>
                <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant">
                  Multi-Cloud FinOps
                </span>
              </div>
            </div>
            <div className="flex items-center gap-space-xs rounded-full bg-surface-container-lowest px-space-sm py-1 text-label-md text-on-surface-variant">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary-container" />
              All Systems Operational
            </div>
          </div>

          <div className="flex w-full flex-col">{children}</div>

          {footer && (
            <div className="mt-space-lg flex items-center justify-center border-t border-surface-container-highest/60 pt-space-md">
              {footer}
            </div>
          )}
        </div>

        {/* A signed-in visitor has a dashboard to go back to; a first-time one
            does not, so the shortcut is only offered when it leads somewhere. */}
        {signedIn && (
          <Link
            to="/dashboard"
            className="mt-space-lg inline-flex items-center gap-space-xs self-center rounded-lg bg-surface-container-high px-space-md py-space-sm font-title-md text-title-md text-on-surface transition-colors hover:bg-surface-bright"
          >
            <MaterialSymbol name="dashboard" className="text-title-md" />
            Back to Dashboard
          </Link>
        )}

        {/* Assurance strip */}
        <div className="mt-space-lg flex w-full flex-wrap items-center justify-center gap-space-lg text-center text-label-md text-on-surface-variant/70">
          <span className="flex items-center gap-1.5">
            <MaterialSymbol name="dns" className="text-code-sm" />
            AWS · Azure · GCP
          </span>
          <span aria-hidden="true">•</span>
          <span className="flex items-center gap-1.5">
            <MaterialSymbol name="lock" className="text-code-sm" />
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