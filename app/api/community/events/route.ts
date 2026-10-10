import { api, member } from '@/lib/community/api'
import { eventState } from '@/lib/community/events'
export async function GET() {
  return api(async () => { const user = await member(); return eventState(user.id) })
}
