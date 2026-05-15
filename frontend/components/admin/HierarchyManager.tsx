'use client'

import { useEffect, useMemo, useState } from 'react'
import { Database, FileUp, Pencil, PlusCircle, Save, Trash2, UploadCloud } from 'lucide-react'
import toast from 'react-hot-toast'
import { categoriesApi, hierarchyApi } from '@/lib/api'

type Node = {
  id: string
  label: string
  parent_id?: string | null
  sort_order?: number
  level?: number
  children?: Node[]
}

type GroupOption = {
  value: string
  label: string
  hint: string
}

const emptyForm = {
  parent_id: '',
  label: '',
  sort_order: '0',
}

const defaultGroups: GroupOption[] = [
  { value: 'vehicle', label: 'Araç', hint: 'Marka > Model > Seri > Paket' },
  { value: 'motor', label: 'Motor', hint: 'Marka > Model > Seri > Paket' },
  { value: 'telefon', label: 'Telefon', hint: 'Telefon tipi > Marka > Model > Hafıza' },
  { value: 'elektronik', label: 'Elektronik', hint: 'Tür > Marka > Model > Seri' },
  { value: 'emlak', label: 'Emlak', hint: 'Tip > İlan Tipi > Alt Tür' },
  { value: 'ev-esyasi', label: 'Ev Eşyası', hint: 'Grup > Ürün > Detay' },
  { value: 'giyim', label: 'Giyim', hint: 'Cinsiyet > Ürün > Tür > Detay' },
  { value: 'hizmet', label: 'Hizmet', hint: 'Hizmet > Alan > Detay > Paket' },
  { value: 'is-ilanlari', label: 'İş İlanları', hint: 'Çalışma tipi > Departman > Pozisyon' },
  { value: 'spor', label: 'Spor', hint: 'Branş > Ürün > Tür > Detay' },
  { value: 'spor-outdoor', label: 'Spor & Outdoor', hint: 'Alan > Ürün > Tür > Detay' },
  { value: 'kisisel-bakim-kozmetik', label: 'Kişisel Bakım & Kozmetik', hint: 'Grup > Ürün > Tür > Detay' },
  { value: 'anne-bebek-oyuncak', label: 'Anne & Bebek & Oyuncak', hint: 'Grup > Ürün > Tür > Detay' },
  { value: 'hobi-kitap-muzik', label: 'Hobi & Kitap & Müzik', hint: 'Grup > Ürün > Tür > Detay' },
  { value: 'ofis-kirtasiye', label: 'Ofis & Kırtasiye', hint: 'Grup > Ürün > Tür > Detay' },
  { value: 'diger-araclar', label: 'Diğer Araçlar', hint: 'Araç grubu > Tür > Alt tür > Detay' },
  { value: 'antika', label: 'Antika', hint: 'Grup > Ürün > Tür > Detay' },
  { value: 'pet-shop', label: 'Pet Shop', hint: 'Grup > Ürün > Tür > Detay' },
  { value: 'diger', label: 'Diğer', hint: 'Grup > Alt grup > Tür > Detay' },
]

const sampleCsv = `BMW,X5,xDrive,M Sport
BMW,X5,xDrive,Executive
Mercedes-Benz,C180,AMG,Premium
Telefon,Apple,iPhone 15,Pro`

const groupFromCategory = (category: any) => {
  if (category.slug === 'arac') return 'vehicle'
  if (category.slug === 'motor') return 'motor'
  return category.slug
}

const flatten = (nodes: Node[], depth = 0, parentLabel = ''): Array<Node & { depth: number; parentLabel: string }> =>
  nodes.flatMap((node) => [
    { ...node, depth, parentLabel },
    ...flatten(node.children || [], depth + 1, node.label),
  ])

const flattenCategories = (categories: any[] = [], parentName = ''): any[] =>
  categories.flatMap((category) => [
    { ...category, parentName },
    ...flattenCategories(category.sub_categories || [], category.name),
  ])

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
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export default function HierarchyManager() {
  const [group, setGroup] = useState('vehicle')
  const [groups, setGroups] = useState<GroupOption[]>(defaultGroups)
  const [nodes, setNodes] = useState<Node[]>([])
  const [levelLabels, setLevelLabels] = useState<string[]>([])
  const [groupLabel, setGroupLabel] = useState('')
  const [groupHint, setGroupHint] = useState('')
  const [newGroupKey, setNewGroupKey] = useState('')
  const [newGroupLabel, setNewGroupLabel] = useState('')
  const [newGroupHint, setNewGroupHint] = useState('')
  const [savingLabels, setSavingLabels] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [csvText, setCsvText] = useState(sampleCsv)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)

  const rows = useMemo(() => flatten(nodes), [nodes])
  const activeGroup = groups.find((item) => item.value === group) || groups[0]
  const rootCount = nodes.length
  const leafCount = rows.filter((row) => !row.children?.length).length

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await hierarchyApi.getTree(group)
      setNodes(data.data || [])
    } catch (err: any) {
      const detail =
        err?.response?.data?.message ||
        (typeof err?.message === 'string' && err.message !== 'Network Error' ? err.message : '')
      toast.error(detail || 'Hiyerarşi alınamadı. API veya veritabanı bağlantısını kontrol edin.')
    } finally {
      setLoading(false)
    }
  }

  const loadLabels = async () => {
    try {
      const { data } = await hierarchyApi.getGroupSettings(group)
      setLevelLabels(data.data?.level_labels || [])
      setGroupLabel(data.data?.group_label || '')
      setGroupHint(data.data?.group_hint || '')
    } catch {
      setLevelLabels([])
      setGroupLabel('')
      setGroupHint('')
    }
  }

  const loadGroupSettings = async () => {
    try {
      const { data } = await hierarchyApi.listGroupSettings()
      const dbGroups = (data.data || []).map((item: any) => ({
        value: item.group_key,
        label: item.group_label || item.group_key,
        hint: item.group_hint || '',
      }))
      setGroups((current) =>
        [...current, ...dbGroups].filter((item, index, list) => list.findIndex((x) => x.value === item.value) === index),
      )
    } catch {}
  }

  useEffect(() => {
    categoriesApi
      .getAll({ include_inactive: true })
      .then(({ data }) => {
        const categoryGroups = flattenCategories(data.data || []).map((category: any) => ({
          value: groupFromCategory(category),
          label: category.parentName ? `${category.parentName} / ${category.name}` : category.name,
          hint: category.slug === 'arac' || category.slug === 'motor' ? 'Marka > Model > Seri > Paket' : 'Seviye 1 > Seviye 2 > Seviye 3',
        }))
        const merged = [...defaultGroups, ...categoryGroups].filter(
          (item, index, list) => list.findIndex((candidate) => candidate.value === item.value) === index,
        )
        setGroups(merged)
      })
      .catch(() => setGroups(defaultGroups))
    loadGroupSettings()
  }, [])

  useEffect(() => {
    load()
    loadLabels()
  }, [group])

  const reset = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const edit = (node: Node) => {
    setEditingId(node.id)
    setForm({
      parent_id: node.parent_id || '',
      label: node.label || '',
      sort_order: String(node.sort_order ?? 0),
    })
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        group_key: group,
        parent_id: form.parent_id || null,
        label: form.label,
        sort_order: Number(form.sort_order || 0),
      }
      if (editingId) await hierarchyApi.update(editingId, payload)
      else await hierarchyApi.create(payload)
      toast.success(editingId ? 'Kayıt güncellendi' : 'Kayıt eklendi')
      reset()
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Kayıt kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm('Bu kayıt ve alt kayıtları pasife alınsın mı?')) return
    try {
      await hierarchyApi.delete(id)
      toast.success('Kayıt silindi')
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Kayıt silinemedi')
    }
  }

  const importCsv = async (e: React.FormEvent) => {
    e.preventDefault()
    setImporting(true)
    try {
      if (csvFile) {
        const fd = new FormData()
        fd.append('group_key', group)
        fd.append('file', csvFile)
        await hierarchyApi.importCsv(fd)
      } else {
        await hierarchyApi.importCsv({ group_key: group, csv: csvText })
      }
      toast.success('CSV aktarıldı')
      setCsvFile(null)
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'CSV aktarılamadı')
    } finally {
      setImporting(false)
    }
  }

  const readCsvFile = async (file?: File | null) => {
    if (!file) return
    setCsvFile(file)
    setCsvText(await file.text())
  }

  const saveLabels = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingLabels(true)
    try {
      await hierarchyApi.updateGroupSettings({
        group_key: group,
        group_label: groupLabel,
        group_hint: groupHint,
        level_labels: levelLabels,
      })
      toast.success('Veri grubu ve seviye isimleri güncellendi')
      setGroups((current) =>
        current.map((item) =>
          item.value === group
            ? { ...item, label: groupLabel || item.label, hint: groupHint || item.hint }
            : item,
        ),
      )
      loadLabels()
      loadGroupSettings()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Ayarlar kaydedilemedi')
    } finally {
      setSavingLabels(false)
    }
  }

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    const key = slugifyKey(newGroupKey || newGroupLabel)
    if (!key) {
      toast.error('Veri grubu anahtarı gerekli')
      return
    }
    try {
      await hierarchyApi.updateGroupSettings({
        group_key: key,
        group_label: newGroupLabel.trim() || key,
        group_hint: newGroupHint.trim() || null,
        level_labels: [],
      })
      toast.success('Yeni veri grubu eklendi')
      setNewGroupKey('')
      setNewGroupLabel('')
      setNewGroupHint('')
      await loadGroupSettings()
      setGroup(key)
      reset()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Veri grubu eklenemedi')
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="grid gap-4 border-b border-gray-100 p-4 xl:grid-cols-[1fr_320px]">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-light text-brand">
              <Database className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-black text-gray-900">Dinamik Hiyerarşi Yönetimi</h2>
              <p className="text-sm font-semibold text-gray-500">Kategoriye göre bağımlı dropdown verilerini yönet.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <MiniStat label="Kök kayıt" value={rootCount} />
            <MiniStat label="Toplam kayıt" value={rows.length} />
            <MiniStat label="Son seviye" value={leafCount} />
          </div>
        </div>

        <div>
          <label className="label">Veri grubu</label>
          <select
            value={group}
            onChange={(e) => {
              setGroup(e.target.value)
              reset()
            }}
            className="input"
          >
            {groups.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500">{activeGroup?.hint}</p>
        </div>
      </div>

      <div className="border-b border-gray-100 p-4 bg-gray-50">
        <form onSubmit={saveLabels} className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end">
          <div className="lg:col-span-5">
            <h3 className="font-black">Seviye İsimleri (İlan Ver ekranında görünen başlıklar)</h3>
            <p className="mt-1 text-xs font-semibold text-gray-500">
              Örn: “Seviye 1” yerine “Marka / Tür / Model” gibi isimler yazabilirsiniz.
            </p>
          </div>
          <div>
            <label className="label">Veri grubu adı</label>
            <input value={groupLabel} onChange={(e) => setGroupLabel(e.target.value)} className="input bg-white" placeholder="Örn: Ticari Araçlar" />
          </div>
          <div className="lg:col-span-2">
            <label className="label">Kısa açıklama</label>
            <input value={groupHint} onChange={(e) => setGroupHint(e.target.value)} className="input bg-white" placeholder="Örn: Marka > Seri > Model > Paket" />
          </div>
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx}>
              <label className="label">{idx + 1}. seviye</label>
              <input
                value={levelLabels[idx] || ''}
                onChange={(e) =>
                  setLevelLabels((current) => {
                    const next = [...current]
                    next[idx] = e.target.value
                    return next
                  })
                }
                className="input bg-white"
                placeholder={`Seviye ${idx + 1} adı`}
              />
            </div>
          ))}
          <button disabled={savingLabels} className="btn-brand flex items-center gap-2 whitespace-nowrap">
            <Save className="h-4 w-4" />
            {savingLabels ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </form>
      </div>

      <div className="border-b border-gray-100 p-4">
        <form onSubmit={createGroup} className="grid gap-3 lg:grid-cols-[180px_1fr_1fr_auto] lg:items-end">
          <div>
            <label className="label">Yeni grup key</label>
            <input
              value={newGroupKey}
              onChange={(e) => setNewGroupKey(e.target.value)}
              className="input"
              placeholder="orn: ticari-araclar"
            />
          </div>
          <div>
            <label className="label">Yeni grup adı</label>
            <input value={newGroupLabel} onChange={(e) => setNewGroupLabel(e.target.value)} className="input" placeholder="Örn: Ticari Araçlar" />
          </div>
          <div>
            <label className="label">Açıklama</label>
            <input value={newGroupHint} onChange={(e) => setNewGroupHint(e.target.value)} className="input" placeholder="Örn: Marka > Model > Seri > Paket" />
          </div>
          <button type="submit" className="btn-outline whitespace-nowrap">Veri Grubu Ekle</button>
        </form>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <form onSubmit={save} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-black">{editingId ? 'Kaydı Düzenle' : 'Yeni Kayıt Ekle'}</h3>
            {!editingId && <PlusCircle className="h-5 w-5 text-brand" />}
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_110px]">
            <div>
              <label className="label">Üst kayıt</label>
              <select value={form.parent_id} onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value }))} className="input bg-white">
                <option value="">Kök seviye</option>
                {rows
                  .filter((row) => row.id !== editingId)
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {'- '.repeat(row.depth)}{row.label}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="label">Ad</label>
              <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} required className="input bg-white" placeholder="BMW, X5, M Sport..." />
            </div>
            <div>
              <label className="label">Sıra</label>
              <input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))} className="input bg-white" />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button disabled={saving} className="btn-brand flex items-center gap-2">
              <Save className="h-4 w-4" />
              {saving ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Ekle'}
            </button>
            {editingId && (
              <button type="button" onClick={reset} className="btn-outline px-4">
                Vazgeç
              </button>
            )}
          </div>
        </form>

        <form onSubmit={importCsv} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-black">CSV Toplu Yükleme</h3>
              <p className="mt-1 text-xs font-semibold text-gray-500">Her satır bir yol: Marka,Model,Seri,Paket</p>
            </div>
            <label className="btn-outline flex cursor-pointer items-center gap-2 px-3 py-2 text-xs">
              <UploadCloud className="h-4 w-4" />
              CSV Seç
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => readCsvFile(e.target.files?.[0])} />
            </label>
          </div>
          {csvFile && <p className="mb-2 truncate text-xs font-black text-brand">{csvFile.name}</p>}
          <textarea
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value)
              setCsvFile(null)
            }}
            rows={6}
            className="input resize-none bg-white font-mono text-xs"
            placeholder="BMW,X5,xDrive,M Sport"
          />
          <button disabled={importing} className="btn-brand mt-3 flex items-center gap-2">
            <FileUp className="h-4 w-4" />
            {importing ? 'Aktarılıyor...' : 'CSV Aktar'}
          </button>
        </form>
      </div>

      <div className="overflow-x-auto border-t border-gray-100">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="p-3 text-left">Kayıt</th>
              <th className="p-3 text-left">Üst kayıt</th>
              <th className="p-3 text-left">Seviye</th>
              <th className="p-3 text-left">Sıra</th>
              <th className="p-3 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-gray-50">
                <td className="p-3 font-bold">
                  <span className="text-gray-300">{'- '.repeat(row.depth)}</span>{row.label}
                </td>
                <td className="p-3 text-gray-500">{row.parentLabel || 'Kök'}</td>
                <td className="p-3">{row.level ?? row.depth}</td>
                <td className="p-3">{row.sort_order ?? 0}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => edit(row)} className="btn-outline flex items-center gap-1 px-3 py-1.5 text-xs">
                      <Pencil className="h-3.5 w-3.5" />
                      Düzenle
                    </button>
                    <button type="button" onClick={() => remove(row.id)} className="btn-outline flex items-center gap-1 px-3 py-1.5 text-xs text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                      Sil
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !rows.length && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-400">Henüz kayıt yok.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-3">
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-black text-gray-900">{value.toLocaleString('tr-TR')}</p>
    </div>
  )
}
