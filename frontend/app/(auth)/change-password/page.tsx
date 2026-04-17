'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

function strength(password: string): { label: string; score: number } {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) score++
  const label = ['Weak', 'Fair', 'Good', 'Strong'][Math.min(score, 3)]
  return { label, score }
}

export default function ChangePasswordPage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const setAuth = useAuthStore((s) => s.setAuth)

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const s = useMemo(() => strength(newPassword), [newPassword])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!oldPassword || !newPassword) return
    if (newPassword !== confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await authApi.changePassword({ old_password: oldPassword, new_password: newPassword })
      const token = useAuthStore.getState().access_token
      const u = useAuthStore.getState().user
      if (token && u) setAuth({ ...u, is_first_login: false }, token)
      router.push('/dashboard')
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    router.replace('/login')
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-page px-6 py-12">
      <div className="w-full max-w-md rounded-xl border border-[#E2E6DC] bg-white p-6 shadow-sm">
        <h1 className="text-[20px] font-semibold text-gray-900">Set your password</h1>
        <p className="mt-1 text-[13px] text-surface-muted">
          Welcome! Please set your password before continuing.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="space-y-2">
            <label className="text-[12px] font-medium text-gray-700">Current password</label>
            <Input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="h-10 bg-white border-[#E2E6DC]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[12px] font-medium text-gray-700">New password</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-10 bg-white border-[#E2E6DC]"
            />
            <div className="mt-2">
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={[
                      'h-1 flex-1 rounded-full',
                      i < s.score
                        ? s.score <= 1
                          ? 'bg-red-400'
                          : s.score === 2
                            ? 'bg-amber-400'
                            : s.score === 3
                              ? 'bg-yellow-400'
                              : 'bg-brand-green-500'
                        : 'bg-[#E2E6DC]',
                    ].join(' ')}
                  />
                ))}
              </div>
              <div className="mt-1 text-[12px] text-surface-muted">{s.label}</div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[12px] font-medium text-gray-700">Confirm new password</label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-10 bg-white border-[#E2E6DC]"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                clearAuth()
                authApi.clearRefreshToken()
                router.push('/login')
              }}
            >
              Sign out
            </Button>
            <Button type="submit" className="flex-1 bg-brand-green-500 hover:bg-brand-green-600" disabled={loading}>
              {loading ? 'Saving…' : 'Save & Continue'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

