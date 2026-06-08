'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { categoriesApi, customFieldsApi } from '@/lib/api'
import { PlusCircle, Save, Trash2 } from 'lucide-react'

type FieldType = 'text' | 'number' | 'select' | 'radio' | 'checkbox' | 'multi_select' | 'textarea'

type CustomField = {
  id: string
  category_id: number
  key?: string
  field_key?: string
  label: string
  type?: FieldType
  field_type?: FieldType
  required?: boolean
  is_required?: boolean
  sort_order: number
  is_active: boolean
  category_name?: string
  options?: Array<{ id?: string; value: string; label: string; sort_order?: number }>
}

const emptyForm = {
  id: '',
  category_id: '',
  key: '',
  label: '',
  type: 'text' as FieldType,
  required: 'false',
  sort_order: '0',
  is_active: 'true',
  optionsText: '',
}

const slugifyKey = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const flattenCategories = (items: any[] = [], depth = 0, trail = ''): any[] =>
  items.flatMap((item) => {
    const label = trail ? `${trail} / ${item.name}` : item.name
    return [
      { ...item, depth, label },
      ...flattenCategories(item.sub_categories || [], depth + 1, label),
    ]
  })

const typeLabel = (type: string) =>
  ({
    text: 'Kısa yazı',
    number: 'Sayı',
    select: 'Seçenek listesi',
    checkbox: 'Onay kutusu',
    textarea: 'Uzun metin',
    radio: 'Tek seçim',
    multi_select: 'Çoklu seçim',
  })[type] || type

const parseOptionsText = (text: string) =>
  String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [valueRaw, labelRaw] = line.split('|')
      const label = (labelRaw || valueRaw || '').trim()
      const value = (valueRaw || label).trim()
      return { value, label, sort_order: index * 10 }
    })
    .filter((option) => option.value && option.label)

export default function CustomFieldsManager() {
  const [categories, setCategories] = useState<any[]>([])
  const [fields, setFields] = useState<CustomField[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>(emptyForm)

  const load = async () => {
    setLoading(true)
    try {
      const [categoryResult, fieldResult] = await Promise.allSettled([
        categoriesApi.getAll({ include_inactive: true }),
        customFieldsApi.adminList(),
      ])
      if (categoryResult.status === 'fulfilled') {
        setCategories(categoryResult.value.data.data || [])
      } else {
        toast.error(categoryResult.reason?.response?.data?.message || 'Kategori listesi alınamadı')
      }
      if (fieldResult.status === 'fulfilled') {
        setFields(fieldResult.value.data.data || [])
      } else {
        setFields([])
        toast.error(fieldResult.reason?.response?.data?.message || 'Alan listesi alınamadı')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Alan listesi alınamadı')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const categoryOptions = useMemo(() => flattenCategories(categories || []), [categories])
  const reset = () => setForm(emptyForm)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload: any = {
        ...(form.id ? { id: form.id } : {}),
        category_id: Number(form.category_id),
        key: slugifyKey(form.key || form.label),
        label: String(form.label || '').trim(),
        type: form.type,
        required: form.required === 'true',
        sort_order: Number(form.sort_order || 0),
        is_active: form.is_active === 'true',
      }
      if (['select', 'radio', 'multi_select'].includes(form.type)) {
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

  const edit = (field: CustomField) => {
    const type = (field.type || field.field_type || 'text') as FieldType
    setForm({
      id: field.id,
      category_id: String(field.category_id || ''),
      key: field.key || field.field_key || '',
      label: field.label || '',
      type,
      required: field.required || field.is_required ? 'true' : 'false',
      sort_order: String(field.sort_order ?? 0),
      is_active: field.is_active === false ? 'false' : 'true',
      optionsText: Array.isArray(field.options)
        ? field.options.map((option) => (option.label && option.label !== option.value ? `${option.value}|${option.label}` : option.value)).join('\n')
        : '',
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
      <div className="border-b border-gray-100 p-4">
        <h2 className="font-black">Alan Yönetimi</h2>
        <p className="mt-1 text-sm text-gray-500">Seçilen kategoriye bağlı ilan alanlarını yönetin.</p>
      </div>

      <form onSubmit={save} className="grid gap-3 border-b border-gray-100 p-4 lg:grid-cols-[1.2fr_1fr_1fr_150px_120px_110px_auto] lg:items-end">
        <div>
          <label className="label">Kategori *</label>
          <select value={form.category_id} onChange={(e) => setForm((current: any) => ({ ...current, category_id: e.target.value }))} className="input" required>
            <option value="">Seç</option>
            {categoryOptions.map((category: any) => (
              <option key={category.id} value={category.id}>
                {'- '.repeat(category.depth)}{category.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Alan adı *</label>
          <input
            value={form.label}
            onChange={(e) =>
              setForm((current: any) => ({
                ...current,
                label: e.target.value,
                key: !current.id && (!current.key || current.key === slugifyKey(current.label)) ? slugifyKey(e.target.value) : current.key,
              }))
            }
            className="input"
            placeholder="Örn: Renk, KM, Yakıt tipi"
            required
          />
        </div>
        <div>
          <label className="label">Teknik anahtar</label>
          <input value={form.key} onChange={(e) => setForm((current: any) => ({ ...current, key: e.target.value }))} className="input" placeholder="Otomatik oluşur" />
        </div>
        <div>
          <label className="label">Tip</label>
          <select value={form.type} onChange={(e) => setForm((current: any) => ({ ...current, type: e.target.value }))} className="input">
            <option value="text">Kısa yazı</option>
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
          <select value={form.required} onChange={(e) => setForm((current: any) => ({ ...current, required: e.target.value }))} className="input">
            <option value="false">Hayır</option>
            <option value="true">Evet</option>
          </select>
        </div>
        <div>
          <label className="label">Sıra</label>
          <input type="number" value={form.sort_order} onChange={(e) => setForm((current: any) => ({ ...current, sort_order: e.target.value }))} className="input" />
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

        {['select', 'radio', 'multi_select'].includes(form.type) && (
          <div className="lg:col-span-7">
            <label className="label">Seçenekler</label>
            <textarea
              value={form.optionsText}
              onChange={(e) => setForm((current: any) => ({ ...current, optionsText: e.target.value }))}
              rows={4}
              className="input resize-none font-mono text-xs"
              placeholder={'kirmizi|Kırmızı\nmavi|Mavi\nsiyah|Siyah'}
            />
          </div>
        )}
      </form>

      <div className="flex items-center gap-2 p-4 text-sm font-semibold text-gray-500">
        <PlusCircle className="h-4 w-4 text-brand" />
        Toplam: {fields.length.toLocaleString('tr-TR')} alan
      </div>

      <div className="overflow-x-auto border-t border-gray-100">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="p-3 text-left">Alan</th>
              <th className="p-3 text-left">Kategori</th>
              <th className="p-3 text-left">Tip</th>
              <th className="p-3 text-left">Zorunlu</th>
              <th className="p-3 text-left">Sıra</th>
              <th className="p-3 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => {
              const fieldKey = field.key || field.field_key || ''
              const fieldType = field.type || field.field_type || 'text'
              const required = field.required || field.is_required
              return (
                <tr key={field.id} className="border-t border-gray-50">
                  <td className="p-3">
                    <p className="font-black">{field.label}</p>
                    <p className="font-mono text-xs text-gray-500">{fieldKey}</p>
                  </td>
                  <td className="p-3 text-gray-700">{field.category_name || field.category_id}</td>
                  <td className="p-3">{typeLabel(fieldType)}</td>
                  <td className="p-3">{required ? 'Evet' : 'Hayır'}</td>
                  <td className="p-3">{field.sort_order ?? 0}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => edit(field)} className="btn-outline px-3 py-1.5 text-xs">Düzenle</button>
                      <button type="button" onClick={() => remove(field.id)} className="btn-outline flex items-center gap-1 px-3 py-1.5 text-xs text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
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
