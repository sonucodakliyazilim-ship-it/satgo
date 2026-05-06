export type CityLocation = {
  city: string
  lat: number
  lon: number
  districts: string[]
}

export const LOCATIONS: CityLocation[] = [
  { city: 'İstanbul', lat: 41.0082, lon: 28.9784, districts: ['Kadıköy', 'Beşiktaş', 'Şişli', 'Üsküdar', 'Beyoğlu', 'Bakırköy', 'Ataşehir', 'Maltepe', 'Sarıyer', 'Fatih'] },
  { city: 'Ankara', lat: 39.9334, lon: 32.8597, districts: ['Çankaya', 'Keçiören', 'Yenimahalle', 'Mamak', 'Etimesgut', 'Sincan', 'Altındağ', 'Gölbaşı'] },
  { city: 'İzmir', lat: 38.4237, lon: 27.1428, districts: ['Konak', 'Karşıyaka', 'Bornova', 'Buca', 'Balçova', 'Çiğli', 'Gaziemir', 'Narlıdere'] },
  { city: 'Bursa', lat: 40.1885, lon: 29.061, districts: ['Osmangazi', 'Nilüfer', 'Yıldırım', 'Mudanya', 'Gemlik', 'İnegöl'] },
  { city: 'Antalya', lat: 36.8969, lon: 30.7133, districts: ['Muratpaşa', 'Kepez', 'Konyaaltı', 'Aksu', 'Alanya', 'Manavgat'] },
  { city: 'Adana', lat: 37.0, lon: 35.3213, districts: ['Seyhan', 'Çukurova', 'Yüreğir', 'Sarıçam', 'Ceyhan'] },
  { city: 'Konya', lat: 37.8746, lon: 32.4932, districts: ['Selçuklu', 'Meram', 'Karatay', 'Ereğli', 'Akşehir'] },
  { city: 'Gaziantep', lat: 37.0662, lon: 37.3833, districts: ['Şahinbey', 'Şehitkamil', 'Nizip', 'İslahiye'] },
  { city: 'Mersin', lat: 36.8121, lon: 34.6415, districts: ['Yenişehir', 'Mezitli', 'Toroslar', 'Akdeniz', 'Tarsus'] },
  { city: 'Diyarbakır', lat: 37.9144, lon: 40.2306, districts: ['Kayapınar', 'Yenişehir', 'Bağlar', 'Sur', 'Ergani'] },
]

export const getDistricts = (city: string) =>
  LOCATIONS.find((item) => item.city === city)?.districts || []

export const findNearestCity = (lat: number, lon: number) => {
  let best = LOCATIONS[0]
  let bestScore = Number.POSITIVE_INFINITY

  for (const location of LOCATIONS) {
    const score = Math.pow(location.lat - lat, 2) + Math.pow(location.lon - lon, 2)
    if (score < bestScore) {
      best = location
      bestScore = score
    }
  }

  return best.city
}
