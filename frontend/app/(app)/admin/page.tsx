'use client'

import { useEffect, useMemo, useState } from 'react'
import { usersApi } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { Permissions } from '@/lib/permissions'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'

export default function AdminPage() {
  return <TeamMembers />
}

type UserRow = {
  id: string
  email: string
  full_name: string
  tier: string
  job_title: string | null
  is_active: boolean
  is_first_login: boolean
  permissions: string[]
  last_login_at: string | null
}

function prettyPermission(p: string): string {
  return p
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ')
}

function tierBadge(tier: string, jobTitle: string | null) {
  if (tier === 'superadmin') return <Badge className="border border-red-200 bg-red-100 text-red-700">Super Admin</Badge>
  if (tier === 'admin') return <Badge className="border border-brand-navy-200 bg-brand-navy-50 text-brand-navy-700">Admin</Badge>
  return (
    <Badge className="border border-brand-green-200 bg-brand-green-50 text-brand-green-700">
      {jobTitle?.trim() ? jobTitle : 'Member'}
    </Badge>
  )
}

function TeamMembers() {
  const isAdminOrAbove = useAuthStore((s) => s.isAdminOrAbove)
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const me = useAuthStore((s) => s.user)

  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [groups, setGroups] = useState<Record<string, string[]>>({})
  const [presets, setPresets] = useState<Record<string, string[]>>({})

  const [sheetOpen, setSheetOpen] = useState(false)
  const [mode, setMode] = useState<'create' | 'edit'>('create')
  const [activeUser, setActiveUser] = useState<UserRow | null>(null)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [tier, setTier] = useState<'member' | 'admin'>('member')
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set())
  const [tempPassword, setTempPassword] = useState<string | null>(null)

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [u, g, p] = await Promise.all([
        usersApi.list<UserRow[]>(),
        usersApi.permissionGroups<Record<string, string[]>>(),
        usersApi.permissionPresets<Record<string, string[]>>(),
      ])
      setUsers(u)
      setGroups(g)
      setPresets(p)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAdminOrAbove()) return
    void loadAll()
  }, [])

  const totalSelected = selectedPerms.size
  const categoriesSelected = useMemo(() => {
    const entries = Object.entries(groups)
    let count = 0
    for (const [, perms] of entries) {
      if (perms.some((p) => selectedPerms.has(p))) count++
    }
    return count
  }, [groups, selectedPerms])

  if (!isAdminOrAbove()) {
    return <div className="text-sm text-surface-muted">Admin access required.</div>
  }

  function openCreate() {
    setMode('create')
    setActiveUser(null)
    setFullName('')
    setEmail('')
    setJobTitle('')
    setTier('member')
    setSelectedPerms(new Set())
    setTempPassword(null)
    setSheetOpen(true)
  }

  function openEdit(u: UserRow) {
    setMode('edit')
    setActiveUser(u)
    setFullName(u.full_name)
    setEmail(u.email)
    setJobTitle(u.job_title ?? '')
    setTier(u.tier === 'admin' ? 'admin' : 'member')
    setSelectedPerms(new Set(u.permissions ?? []))
    setTempPassword(null)
    setSheetOpen(true)
  }

  async function submit() {
    setError('')
    try {
      if (mode === 'create') {
        const res = await usersApi.create<{ user: UserRow; temp_password: string }>({
          email,
          full_name: fullName,
          job_title: jobTitle || null,
          tier,
          permissions: Array.from(selectedPerms),
        })
        setTempPassword(res.temp_password)
        await loadAll()
      } else if (activeUser) {
        const updated = await usersApi.updatePermissions<UserRow>(activeUser.id, Array.from(selectedPerms))
        setUsers((prev) => prev.map((x) => (x.id === updated.id ? (updated as any) : x)))
        setSheetOpen(false)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    }
  }

  function applyPreset(name: string) {
    const perms = presets[name] ?? []
    setSelectedPerms(new Set(perms))
  }

  async function resetPassword(u: UserRow) {
    const res = await usersApi.resetPassword<{ temp_password: string }>(u.id)
    setTempPassword(res.temp_password)
  }

  async function toggleActive(u: UserRow) {
    if (u.is_active) await usersApi.deactivate(u.id)
    else await usersApi.reactivate(u.id)
    await loadAll()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[18px] font-semibold text-gray-900">Team Members</div>
          <div className="text-[13px] text-surface-muted">{users.length} users</div>
        </div>
        <PermissionGate permission={Permissions.USERS_CREATE}>
          <Button className="bg-brand-green-500 hover:bg-brand-green-600" onClick={openCreate}>
            + Add Team Member
          </Button>
        </PermissionGate>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-xl border border-[#E2E6DC] bg-white overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-4 py-3 text-[12px] font-medium text-surface-muted border-b border-[#E2E6DC]">
          <div className="col-span-3">Name</div>
          <div className="col-span-3">Email</div>
          <div className="col-span-2">Tier</div>
          <div className="col-span-2">Permissions</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        {users.map((u) => (
          <div
            key={u.id}
            className="grid grid-cols-12 gap-3 px-4 py-3 text-[13px] border-b border-[#F0F2EA] hover:bg-[#FAFBF7] cursor-pointer"
            onClick={() => openEdit(u)}
          >
            <div className="col-span-3">
              <div className="font-medium text-gray-900">{u.full_name}</div>
              <div className="text-[12px] text-surface-muted">{u.job_title ?? ''}</div>
            </div>
            <div className="col-span-3 font-mono text-[12px] text-surface-muted">{u.email}</div>
            <div className="col-span-2">{tierBadge(u.tier, u.job_title)}</div>
            <div className="col-span-2 text-surface-muted">{(u.permissions ?? []).length} permissions</div>
            <div className="col-span-2 flex justify-end gap-2">
              <PermissionGate permission={Permissions.USERS_EDIT}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    void resetPassword(u)
                    setSheetOpen(true)
                    setMode('edit')
                    setActiveUser(u)
                    setSelectedPerms(new Set(u.permissions ?? []))
                  }}
                >
                  Reset Password
                </Button>
              </PermissionGate>
              <PermissionGate permission={Permissions.USERS_DEACTIVATE}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    void toggleActive(u)
                  }}
                >
                  {u.is_active ? 'Deactivate' : 'Reactivate'}
                </Button>
              </PermissionGate>
            </div>
          </div>
        ))}
        {users.length === 0 && !loading && <div className="p-6 text-sm text-surface-muted">No users found.</div>}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-[600px] sm:max-w-[600px] px-6 py-6">
          <SheetHeader className="mb-4">
            <SheetTitle>{mode === 'create' ? 'Add Team Member' : `Edit Permissions — ${activeUser?.full_name ?? ''}`}</SheetTitle>
          </SheetHeader>

          {tempPassword && (
            <div className="rounded-lg border border-brand-green-200 bg-brand-green-50 p-3 text-sm text-brand-green-700">
              Temporary Password: <span className="font-mono font-semibold">{tempPassword}</span>
            </div>
          )}

          {mode === 'create' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="text-[12px] font-medium text-gray-700">Full Name*</div>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <div className="text-[12px] font-medium text-gray-700">Email*</div>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="text-[12px] font-medium text-gray-700">Job Title</div>
                  <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <div className="text-[12px] font-medium text-gray-700">Tier</div>
                  <div className="flex gap-2">
                    <Button variant={tier === 'member' ? 'default' : 'outline'} onClick={() => setTier('member')}>
                      Member
                    </Button>
                    <Button
                      variant={tier === 'admin' ? 'default' : 'outline'}
                      onClick={() => setTier('admin')}
                      disabled={me?.tier !== 'superadmin'}
                    >
                      Admin
                    </Button>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <div className="text-[12px] font-medium text-gray-700">Quick fill presets</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.keys(presets).map((name) => (
                    <Button key={name} variant="outline" size="sm" onClick={() => applyPreset(name)}>
                      {name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="pt-5">
            <div className="text-[12px] font-medium text-gray-700">Access Permissions</div>
            <div className="mt-2 space-y-4 max-h-[52vh] overflow-auto pr-2">
              {Object.entries(groups).map(([groupName, perms]) => {
                const checkedCount = perms.filter((p) => selectedPerms.has(p)).length
                return (
                  <div key={groupName} className="rounded-lg border border-[#E2E6DC] bg-white">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-[#E2E6DC]">
                      <div className="text-[13px] font-medium text-gray-900">{groupName}</div>
                      <div className="text-[12px] text-surface-muted">
                        ({checkedCount}/{perms.length})
                      </div>
                    </div>
                    <div className="p-3 space-y-2">
                      {perms.map((p) => (
                        <label key={p} className="flex items-center gap-2 text-[13px]">
                          <Checkbox
                            checked={selectedPerms.has(p)}
                            onCheckedChange={(v) => {
                              setSelectedPerms((prev) => {
                                const next = new Set(prev)
                                if (v) next.add(p)
                                else next.delete(p)
                                return next
                              })
                            }}
                          />
                          <span>{prettyPermission(p)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 text-[12px] text-surface-muted">
              {totalSelected} permissions selected across {categoriesSelected} categories
            </div>

            {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            <div className="mt-5 flex gap-2">
              <Button variant="outline" onClick={() => setSheetOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1 bg-brand-green-500 hover:bg-brand-green-600" onClick={() => void submit()}>
                {mode === 'create' ? 'Create User' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
