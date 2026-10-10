import { api, member } from '@/lib/community/api'
import { spinWheel, wheelState } from '@/lib/community/wheel'
export async function GET() {
  return api(async () => { const user = await member(); return wheelState(user.id) })
}
export async function POST(request: Request) {
  return api(async () => { const user = await member(request); return spinWheel(user.id) })
}
