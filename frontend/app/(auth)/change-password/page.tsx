'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { changePasswordApi } from '@/lib/api'
import { cleanPhone } from '@/lib/manualClientPicker'
import { useAuthStore, type AuthUser } from '@/stores/authStore'

function strengthScore(pw: string): number {
  let s = 0
  if (pw.length >= 8) s++
  if (/[A-Z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(pw)) s++
  return s
}

export default function ChangePasswordPage() {
  const router = useRouter()
  const { user, access_token, setUser, clearAuth } = useAuthStore()
  const [current, setCurrent] = useState('')
  const [nextPw, setNextPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const needsPhone = Boolean(user?.is_first_login || !user?.phone?.trim())
  const isFirstLogin = Boolean(user?.is_first_login)

  useEffect(() => {
    if (!user || !access_token) router.replace('/login')
  }, [user, access_token, router])

  useEffect(() => {
    setPhone(user?.phone ?? '')
  }, [user?.phone])

  const bars = useMemo(() => strengthScore(nextPw), [nextPw])
  const labels = ['Weak', 'Fair', 'Good', 'Strong']

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (nextPw !== confirm) {
      setError('New password and confirmation do not match.')
      return
    }
    if (needsPhone) {
      const digits = cleanPhone(phone)
      if (digits.length !== 10) {
        setError('Enter a valid 10-digit mobile number.')
        return
      }
    }
    setLoading(true)
    try {
      const res = await changePasswordApi(
        nextPw,
        needsPhone ? cleanPhone(phone) : undefined,
        isFirstLogin ? undefined : current,
      )
      const updated: AuthUser = {
        ...user!,
        is_first_login: false,
        phone: res.phone ?? (needsPhone ? cleanPhone(phone) : user?.phone ?? null),
      }
      setUser(updated)
      router.replace('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password')
    } finally {
      setLoading(false)
    }
  }

  if (!user || !access_token) return null

  return (
    <div className="min-h-screen flex flex-col justify-center bg-surface-page px-6 py-12">
      <div className="w-full max-w-md mx-auto rounded-xl border border-[#E2E6DC] bg-white p-8 shadow-sm">
        <h1 className="text-[22px] font-semibold text-gray-900">
          {user.is_first_login ? 'Complete your account' : 'Set your password'}
        </h1>
        <p className="mt-2 text-[14px] text-surface-muted">
          {user.is_first_login
            ? 'Welcome! Choose a new password and add your mobile number before continuing. You already signed in with the temporary password from your admin — you do not need to enter it again.'
            : 'Update your password. You will stay signed in.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-900">{error}</div>
          )}

          {needsPhone && (
            <div className="space-y-2">
              <label className="text-[12px] font-medium text-gray-700" htmlFor="phone">
                Mobile number
              </label>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-10"
                placeholder="10-digit mobile number"
                required
              />
              <p className="text-[11px] text-surface-muted">
                Shown on quotations you create, alongside your email and name.
              </p>
            </div>
          )}

          {!isFirstLogin && (
            <div className="space-y-2">
              <label className="text-[12px] font-medium text-gray-700" htmlFor="cur-pw">
                Current password
              </label>
              <Input
                id="cur-pw"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="h-10"
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[12px] font-medium text-gray-700" htmlFor="new-pw">
              {isFirstLogin ? 'Password' : 'New password'}
            </label>
            <Input
              id="new-pw"
              type="password"
              autoComplete="new-password"
              value={nextPw}
              onChange={(e) => setNextPw(e.target.value)}
              className="h-10"
              required
            />
            <div className="flex gap-1 pt-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    i < bars
                      ? bars <= 1
                        ? 'bg-red-400'
                        : bars === 2
                          ? 'bg-amber-400'
                          : bars === 3
                            ? 'bg-yellow-400'
                            : 'bg-emerald-500'
                      : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <p className="text-[11px] text-surface-muted">
              Strength:{' '}
              <span className="font-medium text-gray-800">
                {!nextPw ? '—' : labels[Math.max(0, Math.min(bars, 4) - 1)]}
              </span>
              {'. Min 8 chars, uppercase, number, special.'}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[12px] font-medium text-gray-700" htmlFor="conf-pw">
              {isFirstLogin ? 'Confirm password' : 'Confirm new password'}
            </label>
            <Input
              id="conf-pw"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-10"
              required
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" disabled={loading} className="bg-brand-green-500 hover:bg-brand-green-600">
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save and continue'
              )}
            </Button>
            {!user.is_first_login && (
              <Button type="button" variant="ghost" onClick={() => router.push('/dashboard')}>
                Cancel
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="ml-auto"
              onClick={() => {
                clearAuth()
                router.push('/login')
              }}
            >
              Sign out
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
