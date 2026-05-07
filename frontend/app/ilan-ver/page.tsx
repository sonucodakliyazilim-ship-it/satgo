'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { categoriesApi, listingsApi, uploadApi } from '@/lib/api'
import { defaultCategories } from '@/lib/defaultCategories'
import { useAuthStore } from '@/lib/store'
import cities from '@/lib/cities.json'
import districts from '@/lib/districts.json'
import { ImagePlus, X } from 'lucide-react'
import toast from 'react-hot-toast'

const CONDITIONS = [
  { value: 'new', label: 'Sıfır' },
  { value: 'like_new', label: 'Yeni Gibi' },
  { value: 'good', label: 'İyi' },
  { value: 'fair', label: 'Orta' },
  { value: 'poor', label: 'Yıpranmış' },
]

const FUEL_TYPES = [
  ['gasoline', 'Benzin'],
  ['diesel', 'Dizel'],
  ['lpg', 'LPG'],
  ['electric', 'Elektrik'],
  ['hybrid', 'Hibrit'],
]

const HEATING_TYPES = [
  ['central', 'Merkezi'],
  ['floor', 'Yerden Isıtma'],
  ['stove', 'Soba'],
  ['electric', 'Elektrikli'],
  ['gas', 'Doğalgaz'],
  ['solar', 'Güneş'],
  ['none', 'Yok'],
]

const VEHICLE_BRANDS: Record<string, string[]> = {
  'Alfa Romeo': ['Giulietta', 'Giulia', 'Stelvio', 'Tonale', 'MiTo', '156', '159'],
  Audi: ['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'e-tron', 'TT'],
  BMW: ['116i', '118i', '120i', '216d', '320i', '320d', '418i', '520i', '520d', '530i', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'i3', 'i4'],
  Chery: ['Tiggo 4 Pro', 'Tiggo 7 Pro', 'Tiggo 8 Pro', 'Omoda 5', 'Arrizo 8'],
  Chevrolet: ['Aveo', 'Cruze', 'Captiva', 'Spark', 'Lacetti', 'Epica', 'Kalos'],
  Citroen: ['C-Elysee', 'C3', 'C3 Aircross', 'C4', 'C4 X', 'C5 Aircross', 'Berlingo', 'Jumpy'],
  Dacia: ['Sandero', 'Sandero Stepway', 'Logan', 'Duster', 'Jogger', 'Lodgy', 'Dokker'],
  DS: ['DS 3', 'DS 4', 'DS 7', 'DS 9'],
  Fiat: ['Egea', 'Linea', 'Doblo', 'Fiorino', 'Punto', '500', '500X', 'Tipo', 'Panda', 'Ducato'],
  Ford: ['Fiesta', 'Focus', 'Mondeo', 'Kuga', 'Puma', 'EcoSport', 'Courier', 'Connect', 'Custom', 'Transit', 'Ranger'],
  Honda: ['Civic', 'City', 'Jazz', 'Accord', 'CR-V', 'HR-V', 'ZR-V', 'e:Ny1'],
  Hyundai: ['i10', 'i20', 'i30', 'Accent', 'Elantra', 'Tucson', 'Bayon', 'Kona', 'Santa Fe', 'Staria'],
  Isuzu: ['D-Max', 'NPR', 'NQR', 'Turkuaz'],
  Jeep: ['Renegade', 'Compass', 'Cherokee', 'Grand Cherokee', 'Wrangler', 'Avenger'],
  Kia: ['Picanto', 'Rio', 'Ceed', 'XCeed', 'Cerato', 'Sportage', 'Stonic', 'Sorento', 'Niro', 'EV6'],
  'Land Rover': ['Defender', 'Discovery', 'Discovery Sport', 'Range Rover Evoque', 'Range Rover Sport', 'Range Rover Velar'],
  Mazda: ['2', '3', '6', 'CX-3', 'CX-30', 'CX-5', 'MX-5'],
  'Mercedes-Benz': ['A180', 'A200', 'B180', 'C180', 'C200', 'E200', 'E220', 'CLA 200', 'GLA 200', 'GLB 200', 'GLC 300', 'GLE 300', 'Vito', 'Sprinter'],
  Mini: ['Cooper', 'Cooper S', 'Clubman', 'Countryman', 'Paceman'],
  Mitsubishi: ['Colt', 'Lancer', 'ASX', 'Eclipse Cross', 'Outlander', 'L200', 'Pajero'],
  Nissan: ['Micra', 'Juke', 'Qashqai', 'X-Trail', 'Navara', 'Note', 'Townstar'],
  Opel: ['Corsa', 'Astra', 'Insignia', 'Mokka', 'Crossland', 'Grandland', 'Combo', 'Vivaro'],
  Peugeot: ['206', '207', '208', '301', '307', '308', '408', '508', '2008', '3008', '5008', 'Partner', 'Rifter'],
  Porsche: ['911', 'Boxster', 'Cayman', 'Panamera', 'Macan', 'Cayenne', 'Taycan'],
  Renault: ['Clio', 'Megane', 'Taliant', 'Fluence', 'Symbol', 'Captur', 'Kadjar', 'Austral', 'Kangoo', 'Trafic', 'Master'],
  Seat: ['Ibiza', 'Leon', 'Arona', 'Ateca', 'Toledo', 'Alhambra'],
  Skoda: ['Fabia', 'Scala', 'Octavia', 'Superb', 'Kamiq', 'Karoq', 'Kodiaq', 'Rapid'],
  Subaru: ['Impreza', 'Legacy', 'XV', 'Forester', 'Outback', 'BRZ'],
  Suzuki: ['Swift', 'Vitara', 'S-Cross', 'Jimny', 'Baleno', 'SX4'],
  Tesla: ['Model 3', 'Model Y', 'Model S', 'Model X', 'Cybertruck'],
  Togg: ['T10X', 'T10F'],
  Toyota: ['Corolla', 'Yaris', 'C-HR', 'Auris', 'RAV4', 'Camry', 'Hilux', 'Proace', 'Land Cruiser'],
  Volkswagen: ['Polo', 'Golf', 'Passat', 'Jetta', 'Tiguan', 'T-Roc', 'Taigo', 'Arteon', 'Caddy', 'Transporter', 'Caravelle', 'Crafter'],
  Volvo: ['S40', 'S60', 'S90', 'V40', 'V60', 'XC40', 'XC60', 'XC90', 'EX30'],
}

const MOTOR_BRANDS: Record<string, string[]> = {
  Aprilia: ['SR GT 200', 'RS 125', 'RS 660', 'Tuono 660', 'Tuareg 660'],
  Bajaj: ['Pulsar NS 125', 'Pulsar NS 200', 'Dominar 250', 'Dominar 400'],
  Benelli: ['TNT 125', 'TNT 249S', 'TRK 251', 'TRK 502', 'Leoncino 500'],
  'BMW Motorrad': ['G 310 R', 'G 310 GS', 'F 750 GS', 'F 850 GS', 'R 1250 GS', 'R 1300 GS', 'S 1000 RR'],
  'CF Moto': ['250 NK', '250 SR', '450 SR', '650 MT', '800 MT', 'XO Papio'],
  Ducati: ['Monster', 'Scrambler', 'Multistrada', 'Panigale', 'Diavel', 'Streetfighter'],
  'Harley-Davidson': ['Sportster', 'Iron 883', 'Street Bob', 'Fat Boy', 'Nightster', 'Pan America'],
  Honda: ['PCX 125', 'Dio', 'Forza 250', 'CBR 125R', 'CB 250R', 'CB 500F', 'NC750X', 'X-ADV', 'Africa Twin'],
  Husqvarna: ['Svartpilen 250', 'Svartpilen 401', 'Vitpilen 401', 'Norden 901'],
  Kawasaki: ['Ninja 250', 'Ninja 400', 'Ninja 650', 'Z400', 'Z650', 'Z900', 'Versys 650', 'Vulcan S'],
  KTM: ['Duke 125', 'Duke 250', 'Duke 390', 'Adventure 250', 'Adventure 390', 'RC 390', '790 Adventure'],
  Kuba: ['Bluebird', 'CR1', 'TK03', 'Superlight', 'Chia'],
  Kymco: ['Agility 125', 'People S', 'Downtown 250', 'Xciting 400', 'AK 550'],
  Mondial: ['Revival 50', 'SFC 100', 'Drift L', 'RX3i Evo', 'ZNU 125'],
  Piaggio: ['Beverly 300', 'Medley 150', 'Liberty 125', 'MP3 300'],
  RKS: ['Newlight 125 Pro', 'Blazer 50', 'Grace 202', 'Freccia 150', 'RN 180'],
  'Royal Enfield': ['Classic 350', 'Meteor 350', 'Hunter 350', 'Himalayan', 'Interceptor 650'],
  Suzuki: ['Burgman 200', 'Burgman 400', 'V-Strom 250', 'V-Strom 650', 'GSX-R 125', 'GSX-S 750', 'Hayabusa'],
  SYM: ['Jet 14', 'Joyride 200', 'Maxsym 400', 'Cruisym 250'],
  Triumph: ['Trident 660', 'Street Triple', 'Tiger 900', 'Bonneville T100', 'Speed Twin'],
  TVS: ['Jupiter', 'Raider 125', 'Apache RTR 200', 'Apache RR 310'],
  Vespa: ['Primavera', 'Sprint', 'GTS 300', 'VXL 150'],
  Yamaha: ['NMAX 125', 'XMAX 250', 'Tracer 700', 'MT-07', 'MT-09', 'R25', 'R7', 'Tenere 700'],
}

export default function CreateListingPage() {
  const router = useRouter()
  const { user, authReady, setUser } = useAuthStore()
  const [categories, setCategories] = useState<any[]>(defaultCategories)
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    category_id: '',
    sub_category_id: '',
    title: '',
    description: '',
    price: '',
    condition: 'good',
    city: 'İSTANBUL',
    district: '',
    vehicle_brand: '',
    vehicle_model: '',
    vehicle_year: '',
    vehicle_mileage: '',
    fuel_type: 'gasoline',
    transmission: 'automatic',
    body_type: 'sedan',
    color: '',
    moto_brand: '',
    moto_model: '',
    moto_year: '',
    moto_mileage: '',
    engine_cc: '',
    listing_type: 'sale',
    size_m2: '',
    room_count: '2+1',
    building_age: '',
    floor: '',
    heating: 'gas',
    is_furnished: 'false',
    monthly_dues: '',
  })

  useEffect(() => {
    categoriesApi
      .getAll()
      .then(({ data }) => setCategories(data.data?.length ? data.data : defaultCategories))
      .catch(() => setCategories(defaultCategories))
  }, [])

  const selectedCategory = categories.find((c) => String(c.id) === form.category_id)
  const selectedCity = (cities as any[]).find((c) => c.cityName === form.city)
  const vehicleModels = VEHICLE_BRANDS[form.vehicle_brand] || []
  const motoModels = MOTOR_BRANDS[form.moto_brand] || []
  const cityDistricts = useMemo(
    () => (districts as any[]).filter((d) => d.cityCode === selectedCity?.cityCode),
    [selectedCity?.cityCode],
  )

  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files])
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = e.target.value
    setForm((f) => ({
      ...f,
      [key]: value,
      ...(key === 'category_id' ? { sub_category_id: '', vehicle_brand: '', vehicle_model: '', moto_brand: '', moto_model: '' } : {}),
      ...(key === 'city' ? { district: '' } : {}),
      ...(key === 'vehicle_brand' ? { vehicle_model: '' } : {}),
      ...(key === 'moto_brand' ? { moto_model: '' } : {}),
    }))
  }

  const chooseFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []).slice(0, 10 - files.length)
    setFiles((current) => [...current, ...selected].slice(0, 10))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return router.push('/giris')
    setSaving(true)
    try {
      const payload: any = {
        category_id: Number(form.category_id),
        sub_category_id: form.sub_category_id ? Number(form.sub_category_id) : undefined,
        title: form.title,
        description: form.description,
        price: form.price ? Number(form.price) : undefined,
        condition: form.condition,
        city: form.city,
        district: form.district,
      }

      if (selectedCategory?.slug === 'arac') {
        payload.vehicle_details = {
          brand: form.vehicle_brand,
          model: form.vehicle_model,
          year: Number(form.vehicle_year) || undefined,
          mileage: Number(form.vehicle_mileage) || undefined,
          fuel_type: form.fuel_type,
          transmission: form.transmission,
          body_type: form.body_type,
          color: form.color,
        }
      }

      if (selectedCategory?.slug === 'motor') {
        payload.motorcycle_details = {
          brand: form.moto_brand,
          model: form.moto_model,
          year: Number(form.moto_year) || undefined,
          mileage: Number(form.moto_mileage) || undefined,
          engine_cc: Number(form.engine_cc) || undefined,
          color: form.color,
        }
      }

      if (selectedCategory?.slug === 'emlak') {
        payload.real_estate_details = {
          listing_type: form.listing_type,
          size_m2: Number(form.size_m2) || undefined,
          room_count: form.room_count,
          building_age: Number(form.building_age) || undefined,
          floor: Number(form.floor) || undefined,
          heating: form.heating,
          is_furnished: form.is_furnished === 'true',
          monthly_dues: Number(form.monthly_dues) || undefined,
        }
      }

      const { data } = await listingsApi.create(payload)
      if (files.length) {
        const fd = new FormData()
        files.forEach((file) => fd.append('images', file))
        await uploadApi.uploadImages(data.data.id, fd)
      }
      toast.success('İlan oluşturuldu')
      router.push(`/ilan/${data.data.id}`)
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setUser(null)
        toast.error('Oturum süresi doldu. Lütfen tekrar giriş yap.')
        router.push('/giris')
        return
      }

      toast.error(err?.response?.data?.errors?.[0]?.message || err?.response?.data?.message || 'İlan oluşturulamadı')
    } finally {
      setSaving(false)
    }
  }

  if (!authReady) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="card p-8 text-center text-gray-500">Oturum kontrol ediliyor...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="card p-8 text-center">
          <h1 className="text-xl font-black text-gray-800">İlan vermek için giriş yap</h1>
          <button onClick={() => router.push('/giris')} className="btn-brand mt-5">Giriş Yap</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <form onSubmit={submit} className="card p-5 space-y-4">
        <h1 className="text-xl font-black text-gray-800">Yeni İlan Ver</h1>

        <div>
          <label className="label">Başlık *</label>
          <input value={form.title} onChange={set('title')} required minLength={5} maxLength={200} className="input" placeholder="İlan başlığı" />
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="label">Kategori *</label>
            <select value={form.category_id} onChange={set('category_id')} required className="input">
              <option value="">Kategori seç</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Fiyat (₺)</label>
            <input type="number" min="0" value={form.price} onChange={set('price')} className="input" />
          </div>
        </div>

        {!!selectedCategory?.sub_categories?.length && (
          <div>
            <label className="label">Alt Kategori</label>
            <select value={form.sub_category_id} onChange={set('sub_category_id')} className="input">
              <option value="">Alt kategori seç</option>
              {selectedCategory.sub_categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="label">Durum</label>
            <select value={form.condition} onChange={set('condition')} className="input">
              {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">İl</label>
            <select value={form.city} onChange={set('city')} className="input">
              {(cities as any[]).map((c) => <option key={c.cityCode} value={c.cityName}>{c.cityName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">İlçe</label>
            <select value={form.district} onChange={set('district')} className="input">
              <option value="">İlçe seç</option>
              {cityDistricts.map((d) => <option key={d.districtCode} value={d.districtName}>{d.districtName}</option>)}
            </select>
          </div>
        </div>

        {selectedCategory?.slug === 'emlak' && (
          <div className="bg-gray-50 rounded-xl p-4 grid md:grid-cols-2 gap-3">
            <h2 className="font-bold md:col-span-2">Emlak Bilgileri</h2>
            <Select label="İlan Tipi" value={form.listing_type} onChange={set('listing_type')} options={[['sale', 'Satılık'], ['rent', 'Kiralık']]} />
            <Field label="m²" value={form.size_m2} onChange={set('size_m2')} type="number" />
            <Select label="Oda Sayısı" value={form.room_count} onChange={set('room_count')} options={['1+0', '1+1', '2+1', '3+1', '4+1', '5+1'].map((x) => [x, x])} />
            <Field label="Bina Yaşı" value={form.building_age} onChange={set('building_age')} type="number" />
            <Field label="Kat" value={form.floor} onChange={set('floor')} type="number" />
            <Select label="Isıtma" value={form.heating} onChange={set('heating')} options={HEATING_TYPES} />
            <Select label="Eşyalı" value={form.is_furnished} onChange={set('is_furnished')} options={[['true', 'Evet'], ['false', 'Hayır']]} />
            <Field label="Aidat (₺)" value={form.monthly_dues} onChange={set('monthly_dues')} type="number" />
          </div>
        )}

        {selectedCategory?.slug === 'arac' && (
          <div className="bg-gray-50 rounded-xl p-4 grid md:grid-cols-2 gap-3">
            <h2 className="font-bold md:col-span-2">Araç Bilgileri</h2>
            <Select
              label="Marka"
              value={form.vehicle_brand}
              onChange={set('vehicle_brand')}
              options={[['', 'Marka seç'], ...Object.keys(VEHICLE_BRANDS).map((brand) => [brand, brand])]}
            />
            <Select
              label="Model"
              value={form.vehicle_model}
              onChange={set('vehicle_model')}
              disabled={!form.vehicle_brand}
              options={[['', form.vehicle_brand ? 'Model seç' : 'Önce marka seç'], ...vehicleModels.map((model) => [model, model])]}
            />
            <Field label="Yıl" value={form.vehicle_year} onChange={set('vehicle_year')} type="number" />
            <Field label="KM" value={form.vehicle_mileage} onChange={set('vehicle_mileage')} type="number" />
            <Select label="Yakıt" value={form.fuel_type} onChange={set('fuel_type')} options={FUEL_TYPES} />
            <Select label="Vites" value={form.transmission} onChange={set('transmission')} options={[['automatic', 'Otomatik'], ['manual', 'Manuel'], ['semi_automatic', 'Yarı Otomatik']]} />
            <Select label="Kasa" value={form.body_type} onChange={set('body_type')} options={['sedan', 'hatchback', 'suv', 'coupe', 'wagon', 'van', 'pickup'].map((x) => [x, x])} />
            <Field label="Renk" value={form.color} onChange={set('color')} />
          </div>
        )}

        {selectedCategory?.slug === 'motor' && (
          <div className="bg-gray-50 rounded-xl p-4 grid md:grid-cols-2 gap-3">
            <h2 className="font-bold md:col-span-2">Motor Bilgileri</h2>
            <Select
              label="Marka"
              value={form.moto_brand}
              onChange={set('moto_brand')}
              options={[['', 'Marka seç'], ...Object.keys(MOTOR_BRANDS).map((brand) => [brand, brand])]}
            />
            <Select
              label="Model"
              value={form.moto_model}
              onChange={set('moto_model')}
              disabled={!form.moto_brand}
              options={[['', form.moto_brand ? 'Model seç' : 'Önce marka seç'], ...motoModels.map((model) => [model, model])]}
            />
            <Field label="Yıl" value={form.moto_year} onChange={set('moto_year')} type="number" />
            <Field label="KM" value={form.moto_mileage} onChange={set('moto_mileage')} type="number" />
            <Field label="Motor Hacmi" value={form.engine_cc} onChange={set('engine_cc')} type="number" />
            <Field label="Renk" value={form.color} onChange={set('color')} />
          </div>
        )}

        <div>
          <label className="label">Fotoğraflar</label>
          <label className="border-2 border-dashed border-gray-200 rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-brand transition-colors">
            <ImagePlus className="w-7 h-7 text-brand" />
            <span className="text-sm font-semibold">Fotoğraf seç veya sürükle</span>
            <span className="text-xs text-gray-400">En fazla 10 adet JPG, PNG veya WEBP</span>
            <input type="file" multiple accept="image/*" onChange={chooseFiles} className="hidden" />
          </label>
          {!!previews.length && (
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mt-3">
              {previews.map(({ file, url }) => (
                <div key={file.name} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setFiles((all) => all.filter((f) => f !== file))} className="absolute top-1 right-1 bg-white rounded-full p-1 shadow">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="label">Açıklama</label>
          <textarea value={form.description} onChange={set('description')} rows={5} className="input resize-none" />
        </div>

        <button type="submit" disabled={saving} className="btn-brand w-full">
          {saving ? 'Kaydediliyor...' : 'İlanı Yayına Hazırla'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, ...props }: any) {
  return (
    <div>
      <label className="label">{label}</label>
      <input {...props} className="input" />
    </div>
  )
}

function Select({ label, options, ...props }: any) {
  return (
    <div>
      <label className="label">{label}</label>
      <select {...props} className="input">
        {options.map(([value, labelText]: any[]) => <option key={value} value={value}>{labelText}</option>)}
      </select>
    </div>
  )
}
