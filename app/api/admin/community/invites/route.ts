import { api, member } from '@/lib/community/api'
import { body } from '@/lib/community/validation'
import { createInvite, listInvites } from '@/lib/community/invites'
export const runtime = 'nodejs'
export async function GET(request: Request) {
  return api(async () => { await member(undefined, true); return listInvites(new URL(request.url).searchParams.get('cursor') || undefined) })
}
export async function POST(request: Request) {
  return api(async () => { await member(request, true); return createInvite(await body(request)) })
}
