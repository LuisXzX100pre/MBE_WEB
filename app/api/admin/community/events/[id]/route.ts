import { api, member } from '@/lib/community/api'
import { body } from '@/lib/community/validation'
import { updateEvent } from '@/lib/community/events'
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  return api(async () => { await member(request, true); return updateEvent(params.id, await body(request)) })
}
