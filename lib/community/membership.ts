import 'server-only'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function communityAccess() {
  const user = await getCurrentUser()
  const membership = user ? await prisma.communityMembership.findUnique({ where: { userId: user.id } }) : null
  return { user, membership }
}

/** Visiting only updates an existing member; it never grants access. */
export async function enterCommunity() {
  const access = await communityAccess()
  if (access.membership) {
    const updated = await prisma.communityMembership.updateMany({
      where: { userId: access.user!.id }, data: { lastSeenAt: new Date() },
    })
    if (!updated.count) access.membership = null
  }
  return access
}
