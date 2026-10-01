import { useState } from 'react'
import MaterialSymbol from '@/components/MaterialSymbol'
import Panel from '@/components/Panel'
import PasswordStrength from '@/components/auth/PasswordStrength'
import TextField from '@/components/auth/TextField'
import { api } from '@/api/client'

export default function SecuritySection() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setNotice('')
    setFieldErrors({})

    if (newPassword !== confirm) {
      setFieldErrors({ confirm: 'Passwords do not match.' })
      return
    }

    setSaving(true)
    try {
      const res = await api.changePassword({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirm('')
      setNotice(res?.message ?? 'Password updated. Other devices have been signed out.')
    } catch (err) {
      if (err.details) setFieldErrors(err.details)
      else setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel
      title="Password"
      subtitle="Changing your password signs out every other device."
      icon="lock"
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-space-md">
        <TextField
          label="Current password"
          icon="lock"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          error={fieldErrors.currentPassword}
        />

        <div>
          <TextField
            label="New password"
            icon="key"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            error={fieldErrors.newPassword}
          />
          <PasswordStrength password={newPassword} />
        </div>

        <TextField
          label="Confirm new password"
          icon="key"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          error={fieldErrors.confirm}
        />

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
          <span>{saving ? 'Updating…' : 'Update password'}</span>
          <MaterialSymbol name="password" className="text-title-md" />
        </button>
      </form>
    </Panel>
  )
}
