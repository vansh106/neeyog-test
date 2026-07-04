import { useCallback, useEffect, useMemo, useState } from 'react'
import { clientsApi } from '@/lib/api'
import type {
  BranchResponse,
  ClientEmployeeResponse,
  CompanyResponse,
} from '@/types'

export const BRANCH_PRIMARY_CONTACT = '__branch_primary__'

export type ManualClientSnapshot = {
  client_name: string
  client_company?: string
  client_email?: string
  client_phone?: string
  client_employee_id?: string
}

export function isValidEmail(email: string): boolean {
  if (!email) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function cleanPhone(phone: string): string {
  return phone.replace(/[^\d]/g, '').slice(-10)
}

export function dummyCompaniesForSearch(): CompanyResponse[] {
  const mk = (
    coId: string,
    company_name: string,
    bid: string,
    contact_name: string,
    email: string,
    phone: string,
    city: string,
    erp: string,
  ): CompanyResponse => ({
    id: coId,
    company_name,
    gst_number: null,
    industry: null,
    erp_code: erp,
    is_erp_synced: true,
    total_enquiry_count: 0,
    branch_count: 1,
    is_active: true,
    created_at: '',
    branches: [
      {
        id: bid,
        branch_name: 'Main',
        is_headquarters: true,
        contact_name,
        designation: null,
        phone,
        email,
        city,
        state: null,
        pincode: null,
        address_line1: null,
        country: 'India',
        enquiry_count: 0,
        is_active: true,
      },
    ],
  })
  return [
    mk('dc-1', 'Bharat Industrial Supplies', 'dummy-001', 'Ramesh Joshi', 'ramesh@bharatind.com', '9823001001', 'Pune', 'FC0101'),
    mk('dc-2', 'Nashik Engineering Works', 'dummy-002', 'Sunita Patil', 'sunita@nashikeng.in', '9765400200', 'Nashik', 'FC0202'),
    mk('dc-3', 'Maharashtra Process Equipment', 'dummy-003', 'Vijay Kulkarni', 'vijay@mpequip.com', '9712300303', 'Mumbai', 'FC0303'),
    mk('dc-4', 'Aurangabad Fluid Systems', 'dummy-004', 'Pradeep Shinde', 'pradeep@afsystems.in', '9823400404', 'Aurangabad', 'FC0404'),
  ]
}

const defaultNewClient = {
  company_name: '',
  gst_number: '',
  industry: '',
  branch_name: 'Head Office',
  contact_name: '',
  designation: '',
  phone: '',
  email: '',
  city: '',
  state: '',
  pincode: '',
  address_line1: '',
  country: 'India',
  address: '',
}

const defaultInlineBranch = {
  branch_name: '',
  contact_name: '',
  designation: '',
  phone: '',
  email: '',
  city: '',
  state: '',
  pincode: '',
  address_line1: '',
  country: 'India',
}

function clientFieldsComplete(
  clientMode: 'existing' | 'new',
  selectedCompany: CompanyResponse | null,
  selectedBranchId: string | null,
  newClient: typeof defaultNewClient,
): boolean {
  if (clientMode === 'existing') {
    return !!(selectedCompany && selectedBranchId)
  }
  const ph = cleanPhone(newClient.phone || '')
  return (
    (newClient.company_name || '').trim().length >= 2 &&
    !!(newClient.branch_name || '').trim() &&
    !!(newClient.city || '').trim() &&
    !!(newClient.state || '').trim() &&
    !!(newClient.contact_name || '').trim() &&
    ph.length === 10 &&
    (!(newClient.email || '').trim() || isValidEmail((newClient.email || '').trim()))
  )
}

export function buildManualClientSnapshot(args: {
  clientMode: 'existing' | 'new'
  selectedCompany: CompanyResponse | null
  selectedBranch: BranchResponse | null
  selectedBranchId: string | null
  selectedQuoteEmployee: ClientEmployeeResponse | null
  selectedClientEmployeeId: string | null
  inlineNewEmployeeName: string
  inlineNewEmployeePhone: string
  inlineNewEmployeeEmail: string
  newClient: typeof defaultNewClient
  newClientQuoteEmployeeName: string
  newClientQuoteEmployeePhone: string
  newClientQuoteEmployeeEmail: string
}): ManualClientSnapshot {
  const {
    clientMode,
    selectedCompany,
    selectedBranch,
    selectedBranchId,
    selectedQuoteEmployee,
    selectedClientEmployeeId,
    inlineNewEmployeeName,
    inlineNewEmployeePhone,
    inlineNewEmployeeEmail,
    newClient,
    newClientQuoteEmployeeName,
    newClientQuoteEmployeePhone,
    newClientQuoteEmployeeEmail,
  } = args

  if (clientMode === 'existing' && selectedCompany && selectedBranch && selectedBranchId) {
    const inlineName = inlineNewEmployeeName.trim()
    const useInline = inlineName && !selectedClientEmployeeId
    const contactName = useInline
      ? inlineName
      : (selectedQuoteEmployee?.full_name || selectedBranch.contact_name || 'Client').trim()
    const email = useInline
      ? inlineNewEmployeeEmail.trim() || undefined
      : (selectedQuoteEmployee?.email || selectedBranch.email || undefined)?.trim() || undefined
    const phone = useInline
      ? inlineNewEmployeePhone.trim() || undefined
      : (selectedQuoteEmployee?.phone || selectedBranch.phone || undefined)?.trim() || undefined

    return {
      client_name: contactName,
      client_company: selectedCompany.company_name,
      client_email: email,
      client_phone: phone,
      client_employee_id:
        selectedClientEmployeeId && !selectedBranchId.startsWith('dummy-')
          ? selectedClientEmployeeId
          : undefined,
    }
  }

  const nqName = newClientQuoteEmployeeName.trim()
  return {
    client_name: (nqName || newClient.contact_name).trim(),
    client_company: newClient.company_name.trim() || undefined,
    client_email:
      (newClientQuoteEmployeeEmail.trim() || newClient.email.trim() || undefined) || undefined,
    client_phone:
      (newClientQuoteEmployeePhone.trim() || newClient.phone.trim() || undefined) || undefined,
  }
}

export function useManualClientPicker() {
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing')
  const [newClient, setNewClient] = useState(defaultNewClient)
  const [companyQuery, setCompanyQuery] = useState('')
  const [debouncedCompanyQuery, setDebouncedCompanyQuery] = useState('')
  const [companyOptions, setCompanyOptions] = useState<CompanyResponse[]>([])
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<CompanyResponse | null>(null)
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const [showAddBranch, setShowAddBranch] = useState(false)
  const [addBranchSaving, setAddBranchSaving] = useState(false)
  const [inlineBranch, setInlineBranch] = useState(defaultInlineBranch)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [branchEmployees, setBranchEmployees] = useState<ClientEmployeeResponse[]>([])
  const [employeesLoading, setEmployeesLoading] = useState(false)
  const [selectedClientEmployeeId, setSelectedClientEmployeeId] = useState<string | null>(null)
  const [inlineNewEmployeeAddressCode, setInlineNewEmployeeAddressCode] = useState('')
  const [inlineNewEmployeeName, setInlineNewEmployeeName] = useState('')
  const [inlineNewEmployeePhone, setInlineNewEmployeePhone] = useState('')
  const [inlineNewEmployeeEmail, setInlineNewEmployeeEmail] = useState('')
  const [inlineNewEmployeeDepartment, setInlineNewEmployeeDepartment] = useState('')
  const [inlineNewEmployeeDesignation, setInlineNewEmployeeDesignation] = useState('')
  const [addEmployeeSaving, setAddEmployeeSaving] = useState(false)
  const [addEmployeeErr, setAddEmployeeErr] = useState<string | null>(null)
  const [newClientQuoteEmployeeAddressCode, setNewClientQuoteEmployeeAddressCode] = useState('')
  const [newClientQuoteEmployeeName, setNewClientQuoteEmployeeName] = useState('')
  const [newClientQuoteEmployeePhone, setNewClientQuoteEmployeePhone] = useState('')
  const [newClientQuoteEmployeeEmail, setNewClientQuoteEmployeeEmail] = useState('')
  const [newClientQuoteEmployeeDepartment, setNewClientQuoteEmployeeDepartment] = useState('')
  const [newClientQuoteEmployeeDesignation, setNewClientQuoteEmployeeDesignation] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCompanyQuery(companyQuery), 300)
    return () => clearTimeout(t)
  }, [companyQuery])

  useEffect(() => {
    let cancelled = false
    clientsApi
      .searchCompanies(debouncedCompanyQuery.trim() || undefined, 40)
      .then((rows) => {
        if (!cancelled) setCompanyOptions(rows)
      })
      .catch(() => {
        if (!cancelled) setCompanyOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [debouncedCompanyQuery])

  const mergedCompanyOptions = useMemo(() => {
    const q = debouncedCompanyQuery.trim().toLowerCase()
    const dummies = dummyCompaniesForSearch().filter(
      (co) => !q || co.company_name.toLowerCase().includes(q),
    )
    return [...dummies, ...companyOptions]
  }, [companyOptions, debouncedCompanyQuery])

  useEffect(() => {
    if (!selectedCompany) {
      setSelectedBranchId(null)
      return
    }
    const active = (selectedCompany.branches || []).filter((b) => b.is_active)
    if (active.length === 1) {
      setSelectedBranchId(active[0].id)
      return
    }
    setSelectedBranchId((cur) => {
      if (cur && active.some((b) => b.id === cur)) return cur
      return null
    })
  }, [selectedCompany])

  useEffect(() => {
    if (clientMode === 'new') {
      setSelectedCompany(null)
      setSelectedBranchId(null)
      setCompanyQuery('')
      setCompanyMenuOpen(false)
    }
  }, [clientMode])

  useEffect(() => {
    setSelectedClientEmployeeId(null)
    setBranchEmployees([])
    setAddEmployeeErr(null)
    if (clientMode !== 'existing' || !selectedCompany || !selectedBranchId) return
    if (selectedBranchId.startsWith('dummy-')) return
    let cancelled = false
    setEmployeesLoading(true)
    clientsApi
      .listBranchEmployees(selectedCompany.id, selectedBranchId)
      .then((rows) => {
        if (!cancelled) setBranchEmployees(rows)
      })
      .catch(() => {
        if (!cancelled) setBranchEmployees([])
      })
      .finally(() => {
        if (!cancelled) setEmployeesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [clientMode, selectedCompany?.id, selectedBranchId])

  const selectedBranch = useMemo((): BranchResponse | null => {
    if (!selectedCompany || !selectedBranchId) return null
    return (selectedCompany.branches || []).find((b) => b.id === selectedBranchId) ?? null
  }, [selectedCompany, selectedBranchId])

  const selectedQuoteEmployee = useMemo((): ClientEmployeeResponse | null => {
    if (!selectedClientEmployeeId) return null
    const sid = selectedClientEmployeeId.toLowerCase()
    return branchEmployees.find((e) => e.id.toLowerCase() === sid) ?? null
  }, [branchEmployees, selectedClientEmployeeId])

  const quoteContactSelectLabel = useMemo(() => {
    if (!selectedClientEmployeeId) return 'Branch primary contact (above)'
    if (selectedQuoteEmployee) {
      const n = selectedQuoteEmployee.full_name?.trim() || 'Contact'
      return selectedQuoteEmployee.email ? `${n} · ${selectedQuoteEmployee.email}` : n
    }
    return employeesLoading ? 'Loading…' : 'Saved contact'
  }, [selectedClientEmployeeId, selectedQuoteEmployee, employeesLoading])

  const isComplete = useMemo(
    () => clientFieldsComplete(clientMode, selectedCompany, selectedBranchId, newClient),
    [clientMode, selectedCompany, selectedBranchId, newClient],
  )

  const validate = useCallback((): boolean => {
    const e: Record<string, string> = {}
    if (clientMode === 'existing') {
      if (!selectedCompany) e.client = 'Please search and select a company'
      else if (!selectedBranchId) e.client = 'Please select a branch'
    } else {
      if ((newClient.company_name || '').trim().length < 2) e.company_name = 'Company name is required'
      if (!(newClient.branch_name || '').trim()) e.branch_name = 'Branch name is required'
      if (!(newClient.city || '').trim()) e.city = 'City is required'
      if (!(newClient.state || '').trim()) e.state = 'State is required'
      if (!(newClient.contact_name || '').trim()) e.contact_name = 'Contact name is required'
      const ph = cleanPhone(newClient.phone || '')
      if (ph.length !== 10) e.phone = 'Enter a valid 10-digit phone number'
      if ((newClient.email || '').trim() && !isValidEmail((newClient.email || '').trim())) {
        e.email = 'Enter a valid email'
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }, [clientMode, selectedCompany, selectedBranchId, newClient])

  const getSnapshot = useCallback((): ManualClientSnapshot => {
    return buildManualClientSnapshot({
      clientMode,
      selectedCompany,
      selectedBranch,
      selectedBranchId,
      selectedQuoteEmployee,
      selectedClientEmployeeId,
      inlineNewEmployeeName,
      inlineNewEmployeePhone,
      inlineNewEmployeeEmail,
      newClient,
      newClientQuoteEmployeeName,
      newClientQuoteEmployeePhone,
      newClientQuoteEmployeeEmail,
    })
  }, [
    clientMode,
    selectedCompany,
    selectedBranch,
    selectedBranchId,
    selectedQuoteEmployee,
    selectedClientEmployeeId,
    inlineNewEmployeeName,
    inlineNewEmployeePhone,
    inlineNewEmployeeEmail,
    newClient,
    newClientQuoteEmployeeName,
    newClientQuoteEmployeePhone,
    newClientQuoteEmployeeEmail,
  ])

  const reset = useCallback(() => {
    setClientMode('existing')
    setNewClient(defaultNewClient)
    setCompanyQuery('')
    setDebouncedCompanyQuery('')
    setCompanyOptions([])
    setCompanyMenuOpen(false)
    setSelectedCompany(null)
    setSelectedBranchId(null)
    setShowAddBranch(false)
    setAddBranchSaving(false)
    setInlineBranch(defaultInlineBranch)
    setErrors({})
    setBranchEmployees([])
    setEmployeesLoading(false)
    setSelectedClientEmployeeId(null)
    setInlineNewEmployeeAddressCode('')
    setInlineNewEmployeeName('')
    setInlineNewEmployeePhone('')
    setInlineNewEmployeeEmail('')
    setInlineNewEmployeeDepartment('')
    setInlineNewEmployeeDesignation('')
    setAddEmployeeSaving(false)
    setAddEmployeeErr(null)
    setNewClientQuoteEmployeeAddressCode('')
    setNewClientQuoteEmployeeName('')
    setNewClientQuoteEmployeePhone('')
    setNewClientQuoteEmployeeEmail('')
    setNewClientQuoteEmployeeDepartment('')
    setNewClientQuoteEmployeeDesignation('')
  }, [])

  return {
    clientMode,
    setClientMode,
    newClient,
    setNewClient,
    companyQuery,
    setCompanyQuery,
    companyMenuOpen,
    setCompanyMenuOpen,
    mergedCompanyOptions,
    selectedCompany,
    setSelectedCompany,
    selectedBranchId,
    setSelectedBranchId,
    selectedBranch,
    showAddBranch,
    setShowAddBranch,
    addBranchSaving,
    setAddBranchSaving,
    inlineBranch,
    setInlineBranch,
    errors,
    branchEmployees,
    setBranchEmployees,
    employeesLoading,
    selectedClientEmployeeId,
    setSelectedClientEmployeeId,
    selectedQuoteEmployee,
    quoteContactSelectLabel,
    inlineNewEmployeeAddressCode,
    setInlineNewEmployeeAddressCode,
    inlineNewEmployeeName,
    setInlineNewEmployeeName,
    inlineNewEmployeePhone,
    setInlineNewEmployeePhone,
    inlineNewEmployeeEmail,
    setInlineNewEmployeeEmail,
    inlineNewEmployeeDepartment,
    setInlineNewEmployeeDepartment,
    inlineNewEmployeeDesignation,
    setInlineNewEmployeeDesignation,
    addEmployeeSaving,
    setAddEmployeeSaving,
    addEmployeeErr,
    setAddEmployeeErr,
    newClientQuoteEmployeeAddressCode,
    setNewClientQuoteEmployeeAddressCode,
    newClientQuoteEmployeeName,
    setNewClientQuoteEmployeeName,
    newClientQuoteEmployeePhone,
    setNewClientQuoteEmployeePhone,
    newClientQuoteEmployeeEmail,
    setNewClientQuoteEmployeeEmail,
    newClientQuoteEmployeeDepartment,
    setNewClientQuoteEmployeeDepartment,
    newClientQuoteEmployeeDesignation,
    setNewClientQuoteEmployeeDesignation,
    isComplete,
    validate,
    getSnapshot,
    reset,
  }
}

export type ManualClientPickerState = ReturnType<typeof useManualClientPicker>
