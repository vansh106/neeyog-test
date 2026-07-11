'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/authStore'

export default function LoginPage() {
  const router = useRouter()
  const login = useAuthStore((s) => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { is_first_login } = await login(email.trim(), password)
      if (is_first_login) router.replace('/change-password')
      else router.replace('/dashboard')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cannot reach server'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="hidden lg:flex lg:w-[45%] bg-surface-sidebar flex-col min-h-screen px-10 py-12">
        <div className="flex-1 flex flex-col justify-center items-center text-center max-w-sm mx-auto w-full">
          <div className="flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-xl bg-brand-green-500 flex items-center justify-center text-white text-xl font-semibold tracking-tight">
              PV
            </div>
            <h1 className="text-[28px] font-semibold text-brand-green-300 tracking-[-0.5px]">Parth CPQ</h1>
            <div className="w-full max-w-[200px] h-px bg-white/15" />
            <p className="text-[13px] text-[#5a7a5e] leading-snug">AI-Powered Quotation System</p>
          </div>
        </div>
        <div className="flex justify-center pb-2">
          <span className="text-[11px] text-surface-muted border border-white/10 rounded-full px-3 py-1">v1.0 mvp</span>
        </div>
      </div>

      <div className="flex-1 lg:w-[55%] bg-surface-page flex flex-col justify-center px-6 py-12">
        <div className="w-full max-w-sm mx-auto">
          <h2 className="text-[24px] font-semibold text-gray-900 tracking-[-0.3px]">Sign in</h2>
          <p className="text-[14px] text-surface-muted mt-1 mb-8">Use the account issued by your administrator.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-900" role="alert">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[12px] font-medium text-gray-700" htmlFor="login-email">
                Email
              </label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="your@parthvalve.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 bg-white border-[#E2E6DC]"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[12px] font-medium text-gray-700" htmlFor="login-password">
                Password
              </label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 bg-white border-[#E2E6DC] pr-10"
                  required
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-muted hover:text-gray-700 p-1"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg bg-brand-green-500 hover:bg-brand-green-600 text-white text-sm font-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                'Continue →'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
