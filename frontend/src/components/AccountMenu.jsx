import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MaterialSymbol from './MaterialSymbol'
import { displayName, initials } from '@/components/auth/accountName'
import { useAuth } from '@/auth/AuthContext'

/**
 * Avatar + name button that opens a keyboard-accessible account menu. Closes on
 * outside click, Escape, or route change so it never lingers over the page.
 */
export default function AccountMenu({ className = '' }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return undefined

    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        rootRef.current?.querySelector('button')?.focus()
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!user) return null

  const go = (to) => {
    setOpen(false)
    navigate(to)
  }

  const handleSignOut = async () => {
    setOpen(false)
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        title={user.email}
        className="flex items-center gap-space-sm rounded-lg bg-surface-container-high px-space-sm py-1.5 transition-colors hover:bg-surface-bright focus:outline-none focus:ring-2 focus:ring-primary-container/60"
      >
        <Avatar user={user} />
        <span className="hidden min-w-0 flex-col items-start leading-tight sm:flex">
          <span className="truncate font-title-md text-title-md text-on-surface">
            {displayName(user)}
          </span>
          <span className="truncate font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant">
            {user.email}
          </span>
        </span>
        <MaterialSymbol
          name="expand_more"
          className={`text-title-md text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Account menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 overflow-hidden rounded-xl border border-surface-container-highest bg-surface-container shadow-2xl"
        >
          <div className="flex items-center gap-space-sm border-b border-surface-container-highest/70 px-space-md py-space-sm">
            <Avatar user={user} size="lg" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-title-md text-title-md text-on-surface">
                {user.name?.trim() || displayName(user)}
              </span>
              <span className="truncate text-body-sm text-on-surface-variant">{user.email}</span>
            </div>
          </div>

          <div className="flex flex-col p-1.5">
            <MenuItem icon="dashboard" label="Dashboard" onClick={() => go('/dashboard')} />
            <MenuItem icon="hub" label="Connect cloud accounts" onClick={() => go('/connect')} />
            <MenuItem icon="manage_accounts" label="Account settings" onClick={() => go('/settings')} />
          </div>

          <div className="border-t border-surface-container-highest/70 p-1.5">
            <MenuItem icon="logout" label="Sign out" onClick={handleSignOut} danger />
          </div>
        </div>
      )}
    </div>
  )
}

function Avatar({ user, size = 'sm' }) {
  const dimension = size === 'lg' ? 'h-9 w-9 text-body-md' : 'h-7 w-7 text-label-caps'
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        className={`${dimension} shrink-0 rounded-full object-cover`}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={`${dimension} flex shrink-0 items-center justify-center rounded-full bg-primary-container/20 font-label-caps text-primary-container`}
    >
      {initials(user)}
    </span>
  )
}

function MenuItem({ icon, label, onClick, danger = false }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex items-center gap-space-sm rounded-lg px-space-sm py-2 text-left font-title-md text-title-md transition-colors ${
        danger
          ? 'text-error hover:bg-error/10'
          : 'text-on-surface hover:bg-surface-container-high'
      }`}
    >
      <MaterialSymbol name={icon} className="text-title-md" />
      {label}
    </button>
  )
}
