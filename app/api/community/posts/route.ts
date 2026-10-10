import { api, member } from '@/lib/community/api'
import { publishedPosts } from '@/lib/community/posts'
export async function GET(request: Request) {
  return api(async () => { await member(); return publishedPosts(new URL(request.url).searchParams.get('cursor') || undefined) })
}
