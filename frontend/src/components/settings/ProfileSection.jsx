import { useEffect, useMemo, useRef, useState } from 'react'
import MaterialSymbol from '@/components/MaterialSymbol'
import Panel from '@/components/Panel'
import { initials } from '@/components/auth/accountName'
import { api } from '@/api/client'
import { useAuth } from '@/auth/AuthContext'

// Intl exposes the IANA database in every browser we target, but fall back to a
// short manual list so the picker still works if it is missing.
function timezoneOptions() {
  const fallback = ['UTC', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney']
  try {
    return Intl.supportedValuesOf?.('timeZone') ?? fallback
  } catch {
    return fallback
  }
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const ACCEPTED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

export default function ProfileSection() {
  const { user, updateUser } = useAuth()
  const zones = useMemo(timezoneOptions, [])

  const [name, setName] = useState(user?.name ?? '')
  const [timezone, setTimezone] = useState(user?.timezone ?? '')
  const [fieldError, setFieldError] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const fileRef = useRef(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState('')

  // Keep the fields in step if the profile changes elsewhere (e.g. after an
  // avatar upload that returns the whole user).
  useEffect(() => {
    setName(user?.name ?? '')
    setTimezone(user?.timezone ?? '')
  }, [user?.name, user?.timezone])

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setNotice('')
    setFieldError('')

    const trimmed = name.trim()
    if (!trimmed) {
      setFieldError('Name cannot be empty.')
      return
    }

    setSaving(true)
    try {
      const res = await api.updateProfile({ name: trimmed, timezone: timezone || null })
      updateUser(res.user)
      setNotice('Profile updated.')
    } catch (err) {
      if (err.details?.name) setFieldError(err.details.name)
      else setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatar(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setAvatarError('')
    setError('')
    setNotice('')

    if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) {
      setAvatarError('Choose a PNG, JPEG, WebP, or GIF image.')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError('That image is larger than 2 MB.')
      return
    }

    setAvatarBusy(true)
    try {
      const res = await api.uploadAvatar(file)
      updateUser(res.user)
      setNotice('Avatar updated.')
    } catch (err) {
      setAvatarError(err.message)
    } finally {
      setAvatarBusy(false)
    }
  }

  async function handleRemoveAvatar() {
    setAvatarError('')
    setError('')
    setNotice('')
    setAvatarBusy(true)
    try {
      const res = await api.removeAvatar()
      updateUser(res.user)
      setNotice('Avatar removed.')
    } catch (err) {
      setAvatarError(err.message)
    } finally {
      setAvatarBusy(false)
    }
  }

  return (
    <Panel
      title="Profile"
      subtitle="How you appear across the dashboard and emails."
      icon="person"
    >
      <div className="flex flex-col gap-space-lg">
        <div className="flex flex-wrap items-center gap-space-md">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt="Your avatar"
              className="h-16 w-16 rounded-full object-cover ring-2 ring-surface-container-highest"
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-container/20 font-headline-sm text-headline-sm text-primary-container ring-2 ring-surface-container-highest">
              {initials(user)}
            </span>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-space-xs">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={avatarBusy}
                className="btn-secondary py-2"
              >
                <MaterialSymbol name="upload" className="text-title-md" />
                {avatarBusy ? 'Working…' : 'Upload image'}
              </button>
              {user?.avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={avatarBusy}
                  className="btn-secondary py-2 text-error"
                >
                  <MaterialSymbol name="delete" className="text-title-md" />
                  Remove
                </button>
              )}
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              PNG, JPEG, WebP or GIF · 2 MB maximum.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_AVATAR_TYPES.join(',')}
              onChange={handleAvatar}
              className="hidden"
            />
          </div>
        </div>

        {avatarError && (
          <p role="alert" className="flex items-center gap-space-xs text-body-sm text-error">
            <MaterialSymbol name="error" className="text-body-sm" />
            {avatarError}
          </p>
        )}

        <form onSubmit={handleSave} noValidate className="flex flex-col gap-space-md">
          <label className="flex flex-col gap-1.5">
            <span className="font-label-md text-label-md text-on-surface-variant">Display name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              autoComplete="name"
              className={inputClass(fieldError)}
            />
            {fieldError && (
              <span role="alert" className="flex items-center gap-space-xs text-body-sm text-error">
                <MaterialSymbol name="error" className="text-body-sm" />
                {fieldError}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-label-md text-label-md text-on-surface-variant">Timezone</span>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className={inputClass(false)}
            >
              <option value="">Use account default</option>
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-label-md text-label-md text-on-surface-variant">Email</span>
            <input
              value={user?.email ?? ''}
              readOnly
              disabled
              className={`${inputClass(false)} cursor-not-allowed opacity-60`}
            />
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Email cannot be changed here. Contact support if you need to move accounts.
            </span>
          </label>

          {error && (
            <p role="alert" className="flex items-center gap-space-xs text-body-sm text-error">
              <MaterialSymbol name="error" className="text-body-sm" />
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="flex items-center gap-space-xs text-body-sm text-status-ok">
              <MaterialSymbol name="check_circle" className="text-body-sm" />
              {notice}
            </p>
          )}

          <button type="submit" className="btn-auth-primary sm:self-start" disabled={saving}>
            <span>{saving ? 'Saving…' : 'Save profile'}</span>
            <MaterialSymbol name="save" className="text-title-md" />
          </button>
        </form>
      </div>
    </Panel>
  )
}

const inputClass = (error) =>
  `w-full rounded-lg bg-surface-container-lowest px-3 py-2.5 text-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-1 focus:ring-primary-container ${
    error ? 'ring-1 ring-status-crit' : ''
  }`
