'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const router = useRouter()
  const [department, setDepartment] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // TODO: Replace with JWT auth when backend auth endpoints are built
    if (!department) return
    localStorage.setItem('cpq_role', department)
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="hidden lg:flex lg:w-[45%] bg-surface-sidebar flex-col min-h-screen px-10 py-12">
        <div className="flex-1 flex flex-col justify-center items-center text-center max-w-sm mx-auto w-full">
          <div className="flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-xl bg-brand-green-500 flex items-center justify-center text-white text-xl font-semibold tracking-tight">
              PV
            </div>
            <h1 className="text-[28px] font-semibold text-brand-green-300 tracking-[-0.5px]">
              Parth CPQ
            </h1>
            <div className="w-full max-w-[200px] h-px bg-white/15" />
            <p className="text-[13px] text-[#5a7a5e] leading-snug">
              AI-Powered Quotation System
            </p>
          </div>
        </div>
        <div className="flex justify-center pb-2">
          <span className="text-[11px] text-surface-muted border border-white/10 rounded-full px-3 py-1">
            v1.0 mvp
          </span>
        </div>
      </div>

      <div className="flex-1 lg:w-[55%] bg-surface-page flex flex-col justify-center px-6 py-12">
        <div className="w-full max-w-sm mx-auto">
          <h2 className="text-[24px] font-semibold text-gray-900 tracking-[-0.3px]">Sign in</h2>
          <p className="text-[14px] text-surface-muted mt-1 mb-8">
            Select your department to continue
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[12px] font-medium text-gray-700">Department</label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="w-full h-10 rounded-lg border border-[#E2E6DC] bg-white">
                  <SelectValue placeholder="Choose department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[12px] font-medium text-gray-700">Email</label>
              <Input
                type="email"
                autoComplete="email"
                placeholder="your@parthvalve.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 bg-white border-[#E2E6DC]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[12px] font-medium text-gray-700">Password</label>
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 bg-white border-[#E2E6DC]"
              />
            </div>

            <button
              type="submit"
              className="w-full h-10 rounded-lg bg-brand-green-500 hover:bg-brand-green-600 text-white text-sm font-medium transition-colors"
            >
              Continue →
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
