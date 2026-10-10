import { api, member } from '@/lib/community/api'
import { eventParticipation } from '@/lib/community/events'
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  return api(async () => { await member(undefined, true); return eventParticipation(params.id) })
}
