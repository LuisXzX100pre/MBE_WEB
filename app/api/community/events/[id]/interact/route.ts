import { api, member } from '@/lib/community/api'
import { body } from '@/lib/community/validation'
import { interactWithEvent, eventState } from '@/lib/community/events'
export async function POST(request: Request, { params }: { params: { id: string } }) {
  return api(async () => {
    const user = await member(request)
    await interactWithEvent(user.id, params.id, await body(request))
    return eventState(user.id)
  })
}
