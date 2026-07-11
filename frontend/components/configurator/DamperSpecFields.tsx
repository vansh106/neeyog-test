'use client'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  damperFieldsForKey,
  type DamperFieldDef,
} from '@/lib/damperSchema'

const SELECT_EMPTY = '__none__'
const SPEC_SELECT_TRIGGER_CLASS =
  'h-10 w-full min-w-0 overflow-hidden py-0 *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:truncate'

const toSelectValue = (v: string | null | undefined): string =>
  v != null && String(v).trim() !== '' ? String(v).trim() : SELECT_EMPTY

const fromSelectValue = (v: string | null | undefined): string =>
  !v || v === SELECT_EMPTY ? '' : v

type Props = {
  catalogKey: string
  fieldValues: Record<string, string>
  onFieldChange: (key: string, value: string) => void
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: DamperFieldDef
  value: string
  onChange: (v: string) => void
}) {
  if (field.input_type === 'manual') {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Manual entry (optional)"
        className="h-10"
      />
    )
  }
  return (
    <Select value={toSelectValue(value)} onValueChange={(raw) => onChange(fromSelectValue(raw ?? ''))}>
      <SelectTrigger className={SPEC_SELECT_TRIGGER_CLASS}>
        <SelectValue placeholder={`Select ${field.sub_label || field.label}`} />
      </SelectTrigger>
      <SelectContent variant="wide" align="start">
        <SelectItem value={SELECT_EMPTY}>
          <span className="text-muted-foreground">Select…</span>
        </SelectItem>
        {field.options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default function DamperSpecFields({ catalogKey, fieldValues, onFieldChange }: Props) {
  const fields = damperFieldsForKey(catalogKey)

  const grouped: { title: string; fields: DamperFieldDef[] }[] = []
  const seen = new Set<string>()
  for (const f of fields) {
    const title = f.group ?? f.label
    if (!seen.has(title)) {
      seen.add(title)
      grouped.push({ title, fields: fields.filter((x) => (x.group ?? x.label) === title) })
    }
  }

  return (
    <div className="space-y-4">
      {grouped.map((g) => (
        <div key={g.title} className="rounded-xl border border-surface-border bg-surface-page/50 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-navy-600">
            {g.title}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {g.fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <div className="text-[10px] font-medium uppercase tracking-wide text-[#8A9488]">
                  {f.sub_label ? `${g.title} — ${f.sub_label}` : f.label}
                  {f.input_type === 'manual' ? (
                    <span className="ml-1 text-brand-gold-700">(ME — optional)</span>
                  ) : f.required ? (
                    <span className="text-red-500"> *</span>
                  ) : null}
                </div>
                <FieldControl
                  field={f}
                  value={fieldValues[f.key] ?? ''}
                  onChange={(v) => onFieldChange(f.key, v)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
