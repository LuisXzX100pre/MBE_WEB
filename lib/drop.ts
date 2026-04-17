const DROP_HERO_DAYS_AFTER_RELEASE = 3

export function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function isWithinDropWindow(
  releaseAt?: string | Date | null,
  days = DROP_HERO_DAYS_AFTER_RELEASE
) {
  if (!releaseAt) return false

  const releaseDate = new Date(releaseAt)
  if (Number.isNaN(releaseDate.getTime())) return false

  const now = new Date()
  const endDate = addDays(releaseDate, days)

  return now >= releaseDate && now <= endDate
}

export function getDropWindowEndDate(
  releaseAt?: string | Date | null,
  days = DROP_HERO_DAYS_AFTER_RELEASE
) {
  if (!releaseAt) return null

  const releaseDate = new Date(releaseAt)
  if (Number.isNaN(releaseDate.getTime())) return null

  return addDays(releaseDate, days)
}

export const DROP_FIXED_DAYS = DROP_HERO_DAYS_AFTER_RELEASE