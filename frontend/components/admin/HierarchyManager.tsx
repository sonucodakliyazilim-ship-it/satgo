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
  { value: 'elektronik', label: 'Elektronik', hint: 'Tür > Marka > Model > Seri' },
  { value: 'emlak', label: 'Emlak', hint: 'Tip > İlan Tipi > Alt Tür' },
  { value: 'ev-esyasi', label: 'Ev Eşyası', hint: 'Grup > Ürün > Detay' },
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

export default function HierarchyManager() {
  const [group, setGroup] = useState('vehicle')
  const [groups, setGroups] = useState<GroupOption[]>(defaultGroups)
  const [nodes, setNodes] = useState<Node[]>([])
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
      toast.error(err?.response?.data?.message || 'Hiyerarşi alınamadı')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    categoriesApi
      .getAll()
      .then(({ data }) => {
        const categoryGroups = (data.data || []).map((category: any) => ({
          value: groupFromCategory(category),
          label: category.name,
          hint: category.slug === 'arac' || category.slug === 'motor' ? 'Marka > Model > Seri > Paket' : 'Seviye 1 > Seviye 2 > Seviye 3',
        }))
        const merged = [...defaultGroups, ...categoryGroups].filter(
          (item, index, list) => list.findIndex((candidate) => candidate.value === item.value) === index,
        )
        setGroups(merged)
      })
      .catch(() => setGroups(defaultGroups))
  }, [])

  useEffect(() => {
    load()
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
