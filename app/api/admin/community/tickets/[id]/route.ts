import { prisma } from '@/lib/prisma'
import { api, member } from '@/lib/community/api'
import { CommunityError } from '@/lib/community/validation'
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  return api(async () => {
    await member(request, true)
    const ticket = await prisma.communityTicket.findUnique({ where: { id: params.id } })
    if (!ticket) throw new CommunityError('Ticket no encontrado', 404)
    if (ticket.usedAt) return ticket
    if (ticket.expiresAt && ticket.expiresAt <= new Date()) throw new CommunityError('El ticket ya expiro', 409)
    // Mark once, preserving the first usage timestamp under concurrent admin requests.
    await prisma.communityTicket.updateMany({ where: { id: ticket.id, usedAt: null }, data: { usedAt: new Date() } })
    return prisma.communityTicket.findUnique({ where: { id: ticket.id } })
  })
}
