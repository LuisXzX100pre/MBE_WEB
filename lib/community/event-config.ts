export const eventTypes = ['ANNOUNCEMENT', 'MISSION', 'DECISION', 'CHOICE'] as const
export type EventType = typeof eventTypes[number]
export type EventOption = { key: string; label: string }
export const eventLabels: Record<EventType, string> = { ANNOUNCEMENT: 'EVENTO', MISSION: 'MISIÓN MBE', DECISION: 'DECISIÓN MBE', CHOICE: 'THE CHOICE' }
export type EventResults = { total: number; options: (EventOption & { count: number; percent: number })[] }
export type MyEventInteraction = { id: string; optionKey: string | null; response: string | null; createdAt: string }
export type MemberEvent = {
  id: string; type: EventType; title: string; description: string; interactionPrompt: string | null
  startsAt: string; endsAt: string; options: EventOption[]; myInteraction: MyEventInteraction | null; results: EventResults | null
}
export type EventParticipation = {
  event: { id: string; type: EventType; title: string }
  total: number; results: EventResults | null
  participants: { id: string; optionKey: string | null; response: string | null; createdAt: string; user: { username: string } }[]
}
