import 'server-only'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** Records only the authenticated session owner, never a browser-supplied ID. */
export async function enterCommunity() {
  const user = await getCurrentUser()
  if (!user) return null

  const now = new Date()
  await prisma.communityMembership.upsert({
    where: { userId: user.id },
    update: { lastSeenAt: now },
    create: { userId: user.id, lastSeenAt: now },
  })
  return user
}
