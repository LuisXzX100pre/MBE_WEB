import { date, flag, period, text } from './validation'
export function campaignData(input: Record<string, unknown>) {
  const startsAt = date(input.startsAt, true), endsAt = date(input.endsAt, true)
  period(startsAt, endsAt)
  return { name: text(input.name, 'Nombre', 120), active: flag(input.active), startsAt, endsAt }
}
