import { Coordinates, CalculationMethod, Madhab, PrayerTimes as AdhanPrayerTimes } from 'adhan'
import type { AdhanLocation, AdhanMadhab, AdhanMethodKey, AdhanTimes, PrayerName } from './types'

const METHOD_FACTORY: Record<AdhanMethodKey, () => ReturnType<typeof CalculationMethod.Other>> = {
  MuslimWorldLeague: CalculationMethod.MuslimWorldLeague,
  Egyptian: CalculationMethod.Egyptian,
  Karachi: CalculationMethod.Karachi,
  UmmAlQura: CalculationMethod.UmmAlQura,
  Dubai: CalculationMethod.Dubai,
  MoonsightingCommittee: CalculationMethod.MoonsightingCommittee,
  NorthAmerica: CalculationMethod.NorthAmerica,
  Kuwait: CalculationMethod.Kuwait,
  Qatar: CalculationMethod.Qatar,
  Singapore: CalculationMethod.Singapore,
  Tehran: CalculationMethod.Tehran,
  Turkey: CalculationMethod.Turkey
}

export const METHOD_LABELS: Record<AdhanMethodKey, string> = {
  MuslimWorldLeague: 'Muslim World League',
  Egyptian: 'Egyptian General Authority',
  Karachi: 'University of Islamic Sciences, Karachi',
  UmmAlQura: 'Umm al-Qura (Makkah)',
  Dubai: 'Dubai',
  MoonsightingCommittee: 'Moonsighting Committee',
  NorthAmerica: 'ISNA (North America)',
  Kuwait: 'Kuwait',
  Qatar: 'Qatar',
  Singapore: 'Singapore',
  Tehran: 'Tehran',
  Turkey: 'Turkey'
}

export const PRAYER_ORDER: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']

export const PRAYER_LABELS: Record<PrayerName, string> = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha'
}

export function computePrayerTimes(
  location: AdhanLocation,
  method: AdhanMethodKey,
  madhab: AdhanMadhab,
  date: Date
): AdhanTimes {
  const coordinates = new Coordinates(location.lat, location.lon)
  const params = METHOD_FACTORY[method]()
  params.madhab = madhab === 'Hanafi' ? Madhab.Hanafi : Madhab.Shafi
  const t = new AdhanPrayerTimes(coordinates, date, params)
  return {
    fajr: t.fajr.getTime(),
    sunrise: t.sunrise.getTime(),
    dhuhr: t.dhuhr.getTime(),
    asr: t.asr.getTime(),
    maghrib: t.maghrib.getTime(),
    isha: t.isha.getTime()
  }
}
