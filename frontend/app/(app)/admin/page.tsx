'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy, Loader2, Mail, Users } from 'lucide-react'

import PageShell from '@/components/layout/PageShell'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { mailboxesApi, usersApi } from '@/lib/api'
import { Permissions } from '@/lib/permissions'
import { useMailboxes, usePermissionGroups, usePermissionPresets, useTeamUsers } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'

const PERM_LABELS: Record<string, string> = {
  upload_email: 'Upload Emails',
  view_enquiries: 'View Enquiries',
  delete_enquiries: 'Delete Enquiries',
  export_enquiries: 'Export Enquiries',
  view_quotations: 'View Quotations',
  approve_quotations: 'Approve Quotations',
  delete_quotations: 'Delete Quotations',
  download_pdf: 'Download PDF',
  view_purchase_orders: 'View Purchase Orders',
  create_purchase_orders: 'Create Purchase Orders',
  delete_purchase_orders: 'Delete Purchase Orders',
  download_po_pdf: 'Download PO PDF',
  hitl_approve: 'Approve HITL Decisions',
  hitl_edit_email: 'Edit Email in HITL',
  hitl_custom_prompt: 'Use AI Instructions in HITL',
  client_verify: 'Client Verification',
  client_view: 'View Clients',
  erp_export: 'ERP Export',
  erp_download: 'ERP Download',
  masters_view: 'View Masters',
  masters_edit: 'Edit Masters & Pricing',
  masters_upload_pricelist: 'Upload Pricelist',
  email_sync_view: 'View Email Sync',
  email_sync_trigger: 'Trigger Email Sync',
  reports_view: 'View Reports',
  reports_export: 'Export Reports',
  view_indiamart: 'View IndiaMart Leads',
  users_view: 'View Team',
  users_create: 'Create Team Members',
  users_edit: 'Edit Team Permissions',
  users_deactivate: 'Deactivate Users',
  system_settings_view: 'View System Settings',
  system_settings_edit: 'Edit System Settings',
  audit_log_view: 'View Audit Log',
}

function relTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const m = Math.floor((Date.now() - t) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

type MailboxAccessRow = {
  mailbox_id: string
  display_name?: string
  email_address?: string
  can_view?: boolean
  can_process?: boolean
  can_trigger_sync?: boolean
}

type TeamUser = {
  id: string
  email: string
  full_name: string
  tier: string
  job_title: string | null
  monthly_booking_target?: number
  is_active: boolean
  is_first_login: boolean
  permissions: string[]
  mailbox_access?: MailboxAccessRow[]
  last_login_at: string | null
}

type MbToggle = { can_view: boolean; can_process: boolean; can_trigger_sync: boolean }

export default function AdminPage() {
  const qc = useQueryClient()
  const self = useAuthStore((s) => s.user)
  const isAdmin = useAuthStore((s) => s.isAdminOrAbove())
  const isSuper = self?.tier === 'superadmin'
  const { data: users = [], isLoading, isError, error } = useTeamUsers(true)
  const { data: groups = {} } = usePermissionGroups()
  const { data: presets = {} } = usePermissionPresets()
  const { data: mailboxList = [], refetch: refetchMailboxes } = useMailboxes()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editUser, setEditUser] = useState<TeamUser | null>(null)
  const [mode, setMode] = useState<'create' | 'edit'>('create')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [tier, setTier] = useState<'member' | 'admin' | 'indiamart'>('member')
  const [monthlyBookingTarget, setMonthlyBookingTarget] = useState('1000000')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [pwModal, setPwModal] = useState<{ title: string; email: string; name: string; temp: string } | null>(null)

  const [mbAccess, setMbAccess] = useState<Record<string, MbToggle>>({})
  const [mbDisplayName, setMbDisplayName] = useState('')
  const [mbEmail, setMbEmail] = useState('')
  const [mbAppPw, setMbAppPw] = useState('')

  const createMut = useMutation({
    mutationFn: () =>
      usersApi.create({
        email: email.trim(),
        full_name: fullName.trim(),
        job_title: jobTitle.trim() || null,
        tier,
        permissions: [...selected],
        mailbox_access: Object.entries(mbAccess)
          .filter(([, v]) => v.can_view)
          .map(([mailbox_id, v]) => ({
            mailbox_id,
            can_view: v.can_view,
            can_process: v.can_process,
            can_trigger_sync: v.can_trigger_sync,
          })),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      setSheetOpen(false)
      setPwModal({
        title: 'User created',
        name: (data.user as { full_name?: string })?.full_name ?? fullName,
        email: (data.user as { email?: string })?.email ?? email,
        temp: data.temp_password,
      })
      resetForm()
    },
  })

  const savePermsMut = useMutation({
    mutationFn: () => {
      if (!editUser) throw new Error('No user')
      return usersApi.updatePermissions(editUser.id, [...selected])
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      setSheetOpen(false)
      setEditUser(null)
    },
  })

  const saveMbAccessMut = useMutation({
    mutationFn: () => {
      if (!editUser) throw new Error('No user')
      const access = Object.entries(mbAccess)
        .filter(([, v]) => v.can_view)
        .map(([mailbox_id, v]) => ({
          mailbox_id,
          can_view: v.can_view,
          can_process: v.can_process,
          can_trigger_sync: v.can_trigger_sync,
        }))
      return usersApi.updateMailboxAccess(editUser.id, access)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })

  const saveMonthlyTargetMut = useMutation({
    mutationFn: () => {
      if (!editUser) throw new Error('No user')
      const value = Number(monthlyBookingTarget)
      if (!Number.isFinite(value) || value < 0) throw new Error('Enter a valid monthly target')
      return usersApi.updateMonthlyTarget(editUser.id, value)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      qc.invalidateQueries({ queryKey: ['analytics', 'booking-target'] })
    },
  })

  const createMailboxMut = useMutation({
    mutationFn: () =>
      mailboxesApi.create({
        display_name: mbDisplayName.trim(),
        email_address: mbEmail.trim(),
        app_password: mbAppPw,
      }),
    onSuccess: () => {
      setMbDisplayName('')
      setMbEmail('')
      setMbAppPw('')
      void refetchMailboxes()
    },
  })

  const deactivateMut = useMutation({
    mutationFn: (id: string) => usersApi.deactivate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const reactivateMut = useMutation({
    mutationFn: (id: string) => usersApi.reactivate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const resetPwMut = useMutation({
    mutationFn: (id: string) => usersApi.resetPassword(id),
    onSuccess: (data, id) => {
      const u = (users as TeamUser[]).find((x) => x.id === id)
      setPwModal({
        title: 'Password reset',
        name: u?.full_name ?? '',
        email: u?.email ?? '',
        temp: data.temp_password,
      })
    },
  })

  function initMbAccessFromDefaults(t: 'member' | 'admin' | 'indiamart') {
    const next: Record<string, MbToggle> = {}
    for (const m of mailboxList as Array<{ id: string }>) {
      next[m.id] = {
        can_view: true,
        can_process: true,
        can_trigger_sync: t === 'admin',
      }
    }
    setMbAccess(next)
  }

  function resetForm() {
    setFullName('')
    setEmail('')
    setJobTitle('')
    setTier('member')
    setMonthlyBookingTarget('1000000')
    setSelected(new Set())
  }

  useEffect(() => {
    if (!sheetOpen) return
    if (mode === 'create') {
      initMbAccessFromDefaults(tier)
      if (tier === 'indiamart' && presets['IndiaMart Account']) {
        setSelected(new Set(presets['IndiaMart Account']))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initMbAccessFromDefaults is stable helper
  }, [sheetOpen, mode, tier, mailboxList, presets])

  useEffect(() => {
    if (!sheetOpen || mode !== 'edit' || !editUser) return
    const next: Record<string, MbToggle> = {}
    const byId = new Map((editUser.mailbox_access || []).map((x) => [x.mailbox_id, x]))
    for (const m of mailboxList as Array<{ id: string }>) {
      const row = byId.get(m.id)
      next[m.id] = row
        ? {
            can_view: !!row.can_view,
            can_process: !!row.can_process,
            can_trigger_sync: !!row.can_trigger_sync,
          }
        : { can_view: false, can_process: false, can_trigger_sync: false }
    }
    setMbAccess(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen, mode, editUser, mailboxList])

  function openCreate() {
    setMode('create')
    setEditUser(null)
    resetForm()
    setSheetOpen(true)
  }

  function openEdit(u: TeamUser) {
    setMode('edit')
    setEditUser(u)
    setFullName(u.full_name)
    setEmail(u.email)
    setJobTitle(u.job_title ?? '')
    setTier(u.tier === 'admin' ? 'admin' : u.tier === 'indiamart' ? 'indiamart' : 'member')
    setMonthlyBookingTarget(String(u.monthly_booking_target ?? 1000000))
    setSelected(new Set(u.permissions))
    setSheetOpen(true)
  }

  function setMbToggle(id: string, key: keyof MbToggle, value: boolean) {
    setMbAccess((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || { can_view: false, can_process: false, can_trigger_sync: false }), [key]: value },
    }))
  }

  function togglePerm(p: string) {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(p)) n.delete(p)
      else n.add(p)
      return n
    })
  }

  function applyPreset(name: string) {
    const list = presets[name]
    if (!list) return
    setSelected(new Set(list))
  }

  const groupEntries = useMemo(() => Object.entries(groups), [groups])

  function toggleGroupAll(perms: string[]) {
    const allOn = perms.every((p) => selected.has(p))
    setSelected((prev) => {
      const n = new Set(prev)
      if (allOn) perms.forEach((p) => n.delete(p))
      else perms.forEach((p) => n.add(p))
      return n
    })
  }

  const busy =
    createMut.isPending ||
    savePermsMut.isPending ||
    saveMbAccessMut.isPending ||
    saveMonthlyTargetMut.isPending ||
    createMailboxMut.isPending

  if (!isAdmin) {
    return (
      <PageShell title="Administration">
        <div className="mx-auto max-w-3xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
          Admin access is required to view or manage team members.
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell title="Administration" subtitle="Team members and access permissions.">
      <div className="mx-auto max-w-6xl space-y-6">
        {isSuper && (
          <Card>
            <CardHeader className="border-b border-surface-border">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-navy-50 text-brand-navy-700">
                  <Mail className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-[17px]">Connected mailboxes</CardTitle>
                  <CardDescription className="text-[13px]">
                    Superadmin only — IMAP accounts that sync into the Emails tab. App passwords are stored encrypted.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Input placeholder="Display name" value={mbDisplayName} onChange={(e) => setMbDisplayName(e.target.value)} />
                <Input type="email" placeholder="Email address" value={mbEmail} onChange={(e) => setMbEmail(e.target.value)} />
                <Input type="password" placeholder="App password" value={mbAppPw} onChange={(e) => setMbAppPw(e.target.value)} />
                <Button
                  type="button"
                  className="bg-brand-navy-600 text-white hover:bg-brand-navy-700"
                  disabled={createMailboxMut.isPending || !mbDisplayName.trim() || !mbEmail.trim() || !mbAppPw}
                  onClick={() => createMailboxMut.mutate()}
                >
                  {createMailboxMut.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Add mailbox'}
                </Button>
              </div>
              {createMailboxMut.isError && (
                <p className="text-[12px] text-red-700">
                  {createMailboxMut.error instanceof Error ? createMailboxMut.error.message : 'Failed'}
                </p>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(mailboxList as Array<{ id: string; display_name: string; email_address: string; is_active: boolean }>).map(
                    (m) => (
                      <TableRow key={m.id}>
                        <TableCell className="pl-4 font-medium">{m.display_name}</TableCell>
                        <TableCell className="font-mono text-[12px] text-surface-muted">{m.email_address}</TableCell>
                        <TableCell>{m.is_active ? 'Yes' : 'No'}</TableCell>
                        <TableCell className="text-right pr-4 space-x-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              mailboxesApi.testConnection(m.id).then(() => alert('IMAP OK')).catch((e: Error) => alert(e.message))
                            }
                          >
                            Test
                          </Button>
                          {m.is_active && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-600"
                              onClick={() => mailboxesApi.deactivate(m.id).then(() => void refetchMailboxes())}
                            >
                              Deactivate
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ),
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 border-b border-surface-border">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-green-50 text-brand-green-700">
                <Users className="size-5" />
              </div>
              <div>
                <CardTitle className="text-[17px]">Team Members</CardTitle>
                <CardDescription className="text-[13px]">
                  {(users as TeamUser[]).length} user{(users as TeamUser[]).length === 1 ? '' : 's'} (including inactive)
                </CardDescription>
              </div>
            </div>
            <PermissionGate permission={Permissions.USERS_CREATE}>
              <Button type="button" className="bg-brand-green-500 text-white hover:bg-brand-green-600" onClick={openCreate}>
                + Add team member
              </Button>
            </PermissionGate>
          </CardHeader>
          <CardContent className="p-0">
            {isError ? (
              <div className="px-4 py-8 text-center text-[13px] text-red-700">
                {error instanceof Error && /Invalid or expired token|401/i.test(error.message)
                  ? 'Session expired — refresh the page or sign in again.'
                  : error instanceof Error
                    ? error.message
                    : 'You do not have permission to list users, or the request failed.'}
              </div>
            ) : isLoading ? (
              <div className="flex justify-center py-12 text-surface-muted text-[13px]">
                <Loader2 className="size-5 animate-spin mr-2" /> Loading…
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Last active</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(users as TeamUser[]).map((u) => (
                    <TableRow key={u.id} className="cursor-pointer" onClick={() => openEdit(u)}>
                      <TableCell className="pl-4">
                        <div className="font-medium text-gray-900">{u.full_name}</div>
                        <div className="text-[12px] text-surface-muted">{u.job_title || '—'}</div>
                      </TableCell>
                      <TableCell className="font-mono text-[12px] text-surface-muted">{u.email}</TableCell>
                      <TableCell>
                        <span className="rounded-full border px-2 py-0.5 text-[11px] capitalize">{u.tier}</span>
                      </TableCell>
                      <TableCell className="text-[12px] text-surface-muted">{u.permissions?.length ?? 0} selected</TableCell>
                      <TableCell className="text-[12px]">{relTime(u.last_login_at)}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-medium',
                            u.is_active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600',
                          )}
                        >
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right pr-4 space-x-2" onClick={(e) => e.stopPropagation()}>
                        <PermissionGate permission={Permissions.USERS_EDIT}>
                          <Button type="button" variant="outline" size="sm" onClick={() => resetPwMut.mutate(u.id)}>
                            Reset password
                          </Button>
                        </PermissionGate>
                        <PermissionGate permission={Permissions.USERS_DEACTIVATE}>
                          {u.tier !== 'superadmin' &&
                            (u.is_active ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-red-600"
                                onClick={() => deactivateMut.mutate(u.id)}
                              >
                                Deactivate
                              </Button>
                            ) : (
                              <Button type="button" variant="ghost" size="sm" onClick={() => reactivateMut.mutate(u.id)}>
                                Reactivate
                              </Button>
                            ))}
                        </PermissionGate>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[600px] overflow-y-auto pl-6 pr-14 pt-5 pb-8 sm:pl-8 sm:pr-16"
        >
          <SheetHeader className="p-0">
            <SheetTitle>{mode === 'create' ? 'Add team member' : `Edit permissions — ${editUser?.full_name}`}</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {mode === 'create' && (
              <>
                <div className="space-y-2">
                  <label className="text-[12px] font-medium">Full name</label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[12px] font-medium">Email</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[12px] font-medium">Job title (optional)</label>
                  <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <span className="text-[12px] font-medium">Tier</span>
                  <div className="flex flex-wrap gap-3 text-[13px]">
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={tier === 'member'} onChange={() => setTier('member')} />
                      Member
                    </label>
                    {isSuper && (
                      <label className="flex items-center gap-2">
                        <input type="radio" checked={tier === 'admin'} onChange={() => setTier('admin')} />
                        Admin
                      </label>
                    )}
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={tier === 'indiamart'} onChange={() => setTier('indiamart')} />
                      IndiaMart account
                    </label>
                  </div>
                </div>
              </>
            )}

            {mode === 'edit' && editUser && (
              <div className="space-y-3">
                <div className="rounded-lg border border-surface-border bg-surface-page/60 p-3 text-[13px] text-surface-muted">
                  <div>
                    <span className="font-medium text-gray-800">Tier:</span> {editUser.tier}
                  </div>
                  <div>
                    <span className="font-medium text-gray-800">Last active:</span> {relTime(editUser.last_login_at)}
                  </div>
                </div>
                <PermissionGate permission={Permissions.USERS_EDIT}>
                  <div className="space-y-2">
                    <label className="text-[12px] font-medium">Monthly booking target (₹)</label>
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      value={monthlyBookingTarget}
                      onChange={(e) => setMonthlyBookingTarget(e.target.value)}
                      disabled={editUser.id === self?.id || editUser.tier === 'superadmin'}
                    />
                    <p className="text-[11px] text-surface-muted">
                      Revenue target for dashboard booking tracker. Default is ₹10,00,000.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        busy || editUser.id === self?.id || editUser.tier === 'superadmin'
                      }
                      onClick={() => saveMonthlyTargetMut.mutate()}
                    >
                      {saveMonthlyTargetMut.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        'Save monthly target'
                      )}
                    </Button>
                  </div>
                </PermissionGate>
              </div>
            )}

            <div>
              <p className="text-[12px] font-medium text-gray-800">Quick fill</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.keys(presets).map((name) => (
                  <Button key={name} type="button" variant="outline" size="sm" className="rounded-full" onClick={() => applyPreset(name)}>
                    {name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[13px] font-medium">Access permissions</p>
              {groupEntries.map(([gname, perms]) => {
                const checked = perms.filter((p) => selected.has(p)).length
                return (
                  <details key={gname} className="rounded-lg border border-surface-border">
                    <summary className="cursor-pointer select-none px-3 py-2 text-[13px] font-medium flex flex-wrap items-center justify-between gap-2 bg-white">
                      <span>
                        {gname}{' '}
                        <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-normal text-slate-700">
                          {checked}/{perms.length}
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={(ev) => {
                          ev.preventDefault()
                          toggleGroupAll(perms)
                        }}
                      >
                        Toggle all
                      </Button>
                    </summary>
                    <div className="border-t border-surface-border px-3 py-2 space-y-2 bg-surface-page/40">
                      {perms.map((p) => (
                        <label key={p} className="flex items-start gap-2 text-[13px]">
                          <input type="checkbox" checked={selected.has(p)} onChange={() => togglePerm(p)} className="mt-1" />
                          <span>
                            <span className="font-medium text-gray-900">{PERM_LABELS[p] ?? p}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </details>
                )
              })}
            </div>

            {mailboxList.length > 0 && (
              <div className="space-y-2 rounded-lg border border-surface-border p-3">
                <p className="text-[13px] font-medium">Mailbox access</p>
                <p className="text-[12px] text-surface-muted">
                  Choose which connected inboxes this user can see in the Emails tab and whether they can process or trigger sync.
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(mailboxList as Array<{ id: string; display_name: string; email_address: string }>).map((m) => {
                    const row = mbAccess[m.id] || { can_view: false, can_process: false, can_trigger_sync: false }
                    return (
                      <div key={m.id} className="flex flex-wrap items-center gap-3 text-[12px] border-b border-surface-border/60 pb-2 last:border-0">
                        <span className="font-medium text-gray-900 min-w-[120px]">{m.display_name}</span>
                        <label className="flex items-center gap-1">
                          <input type="checkbox" checked={row.can_view} onChange={(e) => setMbToggle(m.id, 'can_view', e.target.checked)} />
                          View
                        </label>
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={row.can_process}
                            disabled={!row.can_view}
                            onChange={(e) => setMbToggle(m.id, 'can_process', e.target.checked)}
                          />
                          Process
                        </label>
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={row.can_trigger_sync}
                            disabled={!row.can_view}
                            onChange={(e) => setMbToggle(m.id, 'can_trigger_sync', e.target.checked)}
                          />
                          Sync
                        </label>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <p className="text-[12px] text-surface-muted">
              {selected.size} permission{selected.size === 1 ? '' : 's'} selected across {groupEntries.length} categories
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setSheetOpen(false)}>
                Cancel
              </Button>
              {mode === 'create' ? (
                <PermissionGate permission={Permissions.USERS_CREATE}>
                  <Button type="button" className="bg-brand-green-500 text-white" disabled={busy} onClick={() => createMut.mutate()}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : 'Create user'}
                  </Button>
                </PermissionGate>
              ) : (
                <div className="flex flex-wrap justify-end gap-2">
                  <PermissionGate permission={Permissions.USERS_EDIT}>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy || editUser?.id === self?.id || editUser?.tier === 'superadmin'}
                      onClick={() => saveMbAccessMut.mutate()}
                    >
                      {saveMbAccessMut.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Save mailbox access'}
                    </Button>
                  </PermissionGate>
                  <PermissionGate permission={Permissions.USERS_EDIT}>
                    <Button
                      type="button"
                      className="bg-brand-green-500 text-white"
                      disabled={busy || editUser?.id === self?.id || editUser?.tier === 'superadmin'}
                      onClick={() => savePermsMut.mutate()}
                    >
                      {savePermsMut.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Save permissions'}
                    </Button>
                  </PermissionGate>
                </div>
              )}
            </div>
            {(createMut.error || savePermsMut.error || saveMbAccessMut.error || saveMonthlyTargetMut.error) && (
              <p className="text-[12px] text-red-700">
                {(createMut.error || savePermsMut.error || saveMbAccessMut.error || saveMonthlyTargetMut.error) instanceof Error
                  ? (createMut.error || savePermsMut.error || saveMbAccessMut.error || saveMonthlyTargetMut.error)!.message
                  : 'Request failed'}
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!pwModal} onOpenChange={(o) => !o && setPwModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pwModal?.title}</DialogTitle>
            <DialogDescription>
              Share the temporary password once. They must change it on first login if flagged.
            </DialogDescription>
          </DialogHeader>
          {pwModal && (
            <div className="space-y-2 text-[13px]">
              <div>
                <span className="text-surface-muted">Name:</span> {pwModal.name}
              </div>
              <div>
                <span className="text-surface-muted">Email:</span> {pwModal.email}
              </div>
              <div className="flex items-center gap-2 rounded-md border border-surface-border bg-surface-page p-2 font-mono text-[13px]">
                <span className="flex-1 truncate">{pwModal.temp}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(pwModal.temp)}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setPwModal(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
