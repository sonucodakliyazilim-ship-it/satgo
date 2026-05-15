'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { categoriesApi, customFieldsApi } from '@/lib/api'
import { PlusCircle, Save, Trash2 } from 'lucide-react'

type CustomField = {
  id: string
  category_id: number
  sub_category_id?: number | null
  field_key: string
  label: string
  field_type: 'input' | 'text' | 'number' | 'select' | 'checkbox' | 'boolean' | 'textarea' | 'radio' | 'multi_select'
  is_required: boolean
  sort_order: number
  is_active: boolean
  options?: Array<{ id?: string; value: string; label: string; sort_order?: number; is_active?: boolean }>
}

const emptyForm = {
  id: '',
  category_id: '',
  sub_category_id: '',
  field_key: '',
  label: '',
  field_type: 'input',
  is_required: 'false',
  sort_order: '0',
  is_active: 'true',
  optionsText: '',
}

const slugifyKey = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const flattenCategories = (items: any[] = [], depth = 0, parent?: any): any[] =>
  items.flatMap((item) => [
    { ...item, depth, parent },
    ...flattenCategories(item.sub_categories || [], depth + 1, item),
  ])

const rootIdOf = (category: any): string => {
  let current = category
  while (current?.parent) current = current.parent
  return String(current?.id || category?.id || '')
}

const fullCategoryName = (category: any): string => {
  const names = []
  let current = category
  while (current) {
    names.unshift(current.name)
    current = current.parent
  }
  return names.join(' / ')
}

const typeLabel = (type: string) =>
  ({
    input: 'Kısa yazı',
    text: 'Kısa yazı',
    number: 'Sayı',
    select: 'Seçenek listesi',
    checkbox: 'Onay kutusu',
    boolean: 'Onay kutusu',
    textarea: 'Uzun metin',
    radio: 'Tek seçim',
    multi_select: 'Çoklu seçim',
  })[type] || type

const parseOptionsText = (text: string) => {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      // formats:
      // value
      // value|label
      const [valueRaw, labelRaw] = line.split('|')
      const value = (valueRaw || '').trim()
      const label = (labelRaw || valueRaw || '').trim()
      return { value, label, sort_order: index * 10, is_active: true }
    })
    .filter((o) => o.value && o.label)
}

export default function CustomFieldsManager() {
  const [categories, setCategories] = useState<any[]>([])
  const [fields, setFields] = useState<CustomField[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>(emptyForm)

  const load = async () => {
    setLoading(true)
    try {
      const [c, f] = await Promise.all([categoriesApi.getAll({ include_inactive: true }), customFieldsApi.adminList()])
      setCategories(c.data.data || [])
      setFields(f.data.data || [])
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Custom field listesi alınamadı')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const reset = () => setForm(emptyForm)

  const categoryOptions = useMemo(() => {
    const all = flattenCategories(categories || [])
    const roots = all.filter((category: any) => !category.parent_id)
    const subs = all.filter((category: any) => category.parent_id)
    return { roots, subs, all }
  }, [categories])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload: any = {
        ...(form.id ? { id: form.id } : {}),
        category_id: Number(form.category_id),
        sub_category_id: form.sub_category_id ? Number(form.sub_category_id) : null,
        field_key: slugifyKey(form.field_key || form.label),
        label: String(form.label || '').trim(),
        field_type: form.field_type,
        is_required: form.is_required === 'true',
        sort_order: Number(form.sort_order || 0),
        is_active: form.is_active === 'true',
      }
      if (['select', 'radio', 'multi_select'].includes(form.field_type)) {
        payload.options = parseOptionsText(form.optionsText)
      }
      await customFieldsApi.adminUpsert(payload)
      toast.success('Alan kaydedildi')
      reset()
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Alan kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  const edit = (field: any) => {
    setForm({
      id: field.id,
      category_id: String(field.category_id || ''),
      sub_category_id: field.sub_category_id ? String(field.sub_category_id) : '',
      field_key: field.field_key || '',
      label: field.label || '',
      field_type: field.field_type === 'text' ? 'input' : field.field_type === 'boolean' ? 'checkbox' : field.field_type || 'input',
      is_required: field.is_required ? 'true' : 'false',
      sort_order: String(field.sort_order ?? 0),
      is_active: field.is_active ? 'true' : 'false',
      optionsText: Array.isArray(field.options) ? field.options.map((o: any) => (o.label && o.label !== o.value ? `${o.value}|${o.label}` : o.value)).join('\n') : '',
    })
  }

  const remove = async (id: string) => {
    if (!window.confirm('Bu alan silinsin mi?')) return
    try {
      await customFieldsApi.adminDelete(id)
      toast.success('Alan silindi')
      if (form.id === id) reset()
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Alan silinemedi')
    }
  }

  return (
    <section className="card overflow-hidden border-2 border-brand/20">
      <div className="p-4 border-b border-gray-100">
        <h2 className="font-black">Alan Yönetimi</h2>
        <p className="text-sm text-gray-500 mt-1">Kategori seçilince ilan verme formunda otomatik açılacak alanları buradan ekle.</p>
      </div>

      <form onSubmit={save} className="p-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_160px_120px_120px_auto] lg:items-end border-b border-gray-100">
        <div>
          <label className="label">Kategori *</label>
          <select value={form.category_id} onChange={(e) => setForm((f: any) => ({ ...f, category_id: e.target.value, sub_category_id: '' }))} className="input" required>
            <option value="">Seç</option>
            {categoryOptions.roots.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Alt kategori (opsiyonel)</label>
          <select value={form.sub_category_id} onChange={(e) => setForm((f: any) => ({ ...f, sub_category_id: e.target.value }))} className="input" disabled={!form.category_id}>
            <option value="">Yok</option>
            {categoryOptions.subs
              .filter((s: any) => rootIdOf(s) === String(form.category_id))
              .map((s: any) => (
                <option key={s.id} value={s.id}>{fullCategoryName(s)}</option>
              ))}
          </select>
        </div>
        <div>
          <label className="label">Alan adı *</label>
          <input
            value={form.label}
            onChange={(e) =>
              setForm((f: any) => ({
                ...f,
                label: e.target.value,
                field_key:
                  !f.id && (!f.field_key || f.field_key === slugifyKey(f.label))
                    ? slugifyKey(e.target.value)
                    : f.field_key,
              }))
            }
            className="input"
            placeholder="Örn: Renk, KM, Yakıt tipi"
            required
          />
        </div>
        <div>
          <label className="label">Teknik anahtar</label>
          <input value={form.field_key} onChange={(e) => setForm((f: any) => ({ ...f, field_key: e.target.value }))} className="input" placeholder="Otomatik oluşur" />
        </div>
        <div>
          <label className="label">Tip</label>
          <select value={form.field_type} onChange={(e) => setForm((f: any) => ({ ...f, field_type: e.target.value }))} className="input">
            <option value="input">Kısa yazı</option>
            <option value="number">Sayı</option>
            <option value="select">Seçenek listesi</option>
            <option value="radio">Tek seçim</option>
            <option value="multi_select">Çoklu seçim</option>
            <option value="checkbox">Onay kutusu</option>
            <option value="textarea">Uzun metin</option>
          </select>
        </div>
        <div>
          <label className="label">Zorunlu</label>
          <select value={form.is_required} onChange={(e) => setForm((f: any) => ({ ...f, is_required: e.target.value }))} className="input">
            <option value="false">Hayır</option>
            <option value="true">Evet</option>
          </select>
        </div>
        <div>
          <label className="label">Sıra</label>
          <input type="number" value={form.sort_order} onChange={(e) => setForm((f: any) => ({ ...f, sort_order: e.target.value }))} className="input" />
        </div>
        <div className="flex gap-2">
          <button disabled={saving} className="btn-brand flex items-center gap-2 whitespace-nowrap">
            <Save className="h-4 w-4" />
            {saving ? 'Kaydediliyor...' : form.id ? 'Güncelle' : 'Ekle'}
          </button>
          <button type="button" onClick={reset} className="btn-outline px-3 whitespace-nowrap">
            {form.id ? 'Vazgeç' : 'Temizle'}
          </button>
        </div>

        {['select', 'radio', 'multi_select'].includes(form.field_type) && (
          <div className="lg:col-span-8">
            <label className="label">Seçenekler (her satıra bir seçenek)</label>
            <textarea
              value={form.optionsText}
              onChange={(e) => setForm((f: any) => ({ ...f, optionsText: e.target.value }))}
              rows={4}
              className="input resize-none font-mono text-xs"
              placeholder={'Kırmızı\nMavi\nSiyah'}
            />
          </div>
        )}
      </form>

      <div className="p-4 flex items-center gap-2 text-sm font-semibold text-gray-500">
        <PlusCircle className="w-4 h-4 text-brand" />
        Toplam: {fields.length.toLocaleString('tr-TR')} alan
      </div>

      <div className="overflow-x-auto border-t border-gray-100">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left p-3">Alan</th>
              <th className="text-left p-3">Kategori</th>
              <th className="text-left p-3">Tip</th>
              <th className="text-left p-3">Zorunlu</th>
              <th className="text-left p-3">Sıra</th>
              <th className="text-right p-3">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.id} className="border-t border-gray-50">
                <td className="p-3">
                  <p className="font-black">{f.label}</p>
                  <p className="text-xs font-mono text-gray-500">{f.field_key}{f.sub_category_id ? ` (sub:${f.sub_category_id})` : ''}</p>
                </td>
                <td className="p-3 text-gray-700">
                  {String((f as any).category_name || f.category_id)}
                  {(f as any).sub_category_name ? <span className="text-gray-400"> / {(f as any).sub_category_name}</span> : null}
                </td>
                <td className="p-3">{typeLabel(f.field_type)}</td>
                <td className="p-3">{f.is_required ? 'Evet' : 'Hayır'}</td>
                <td className="p-3">{f.sort_order ?? 0}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => edit(f)} className="btn-outline px-3 py-1.5 text-xs">Düzenle</button>
                    <button type="button" onClick={() => remove(f.id)} className="btn-outline flex items-center gap-1 px-3 py-1.5 text-xs text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                      Sil
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !fields.length && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-400">Henüz alan yok.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
