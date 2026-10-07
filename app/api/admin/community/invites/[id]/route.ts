import { api, member } from '@/lib/community/api'
import { body } from '@/lib/community/validation'
import { updateInvite, deleteInvite, inviteHistory } from '@/lib/community/invites'
export const runtime = 'nodejs'
type Context = { params: { id: string } }
export async function GET(request: Request, { params }: Context) {
  return api(async () => { await member(undefined, true); return inviteHistory(params.id, new URL(request.url).searchParams.get('cursor') || undefined) })
}
export async function PATCH(request: Request, { params }: Context) {
  return api(async () => { await member(request, true); return { invite: await updateInvite(params.id, await body(request)) } })
}
export async function DELETE(request: Request, { params }: Context) {
  return api(async () => { await member(request, true); return deleteInvite(params.id) })
}
