import { api, member } from '@/lib/community/api'
import { body } from '@/lib/community/validation'
import { saveCampaign } from '@/lib/community/campaigns'
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  return api(async () => { await member(request, true); return saveCampaign(await body(request), params.id) })
}
