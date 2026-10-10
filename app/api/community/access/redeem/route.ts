import { api, authenticated } from '@/lib/community/api'
import { body } from '@/lib/community/validation'
import { redeemAccess } from '@/lib/community/invites'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  return api(async () => { const user = await authenticated(request); const input = await body(request); return redeemAccess(user.id, input.code) })
}
