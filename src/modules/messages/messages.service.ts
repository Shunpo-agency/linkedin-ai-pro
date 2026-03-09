import * as messagesRepository from './messages.repository'
import type { Message, CreateMessage } from './messages.types'
import type { MessageWithProspect } from './messages.repository'

export type MessageThread = {
  prospect_id: string
  prospect: {
    first_name: string | null
    last_name: string | null
    profile_picture_url: string | null
  }
  latestMessage: Message
  messageCount: number
}

export async function getAll(
  userId: string,
  options: { prospect_id?: string; limit?: number } = {},
): Promise<Message[] | MessageWithProspect[]> {
  if (options.prospect_id) {
    return messagesRepository.getByProspect(userId, options.prospect_id)
  }
  return messagesRepository.getAll(userId, options.limit)
}

export async function getConversation(
  userId: string,
  prospectId: string,
): Promise<Message[]> {
  return messagesRepository.getByProspect(userId, prospectId)
}

export async function getAllThreads(userId: string): Promise<MessageThread[]> {
  const messages = await messagesRepository.getAll(userId)
  const threadMap = new Map<string, MessageThread>()
  for (const message of messages) {
    const prospectId = message.prospect_id
    if (!threadMap.has(prospectId)) {
      threadMap.set(prospectId, {
        prospect_id: prospectId,
        prospect: message.prospect,
        latestMessage: message,
        messageCount: 1,
      })
    } else {
      const thread = threadMap.get(prospectId)!
      thread.messageCount++
      if (new Date(message.sent_at) > new Date(thread.latestMessage.sent_at)) {
        thread.latestMessage = message
      }
    }
  }
  return Array.from(threadMap.values()).sort(
    (a, b) =>
      new Date(b.latestMessage.sent_at).getTime() -
      new Date(a.latestMessage.sent_at).getTime(),
  )
}

export async function create(userId: string, data: CreateMessage): Promise<Message> {
  return messagesRepository.create(userId, data)
}

export async function getStats(userId: string): Promise<{
  totalSent: number
  totalReceived: number
  replyRate: number
}> {
  const messages = await messagesRepository.getAll(userId)
  const totalSent = messages.filter((m) => m.direction === 'outbound').length
  const totalReceived = messages.filter((m) => m.direction === 'inbound').length
  const prospectIdsSentTo = new Set(
    messages.filter((m) => m.direction === 'outbound').map((m) => m.prospect_id),
  )
  const prospectIdsReplied = new Set(
    messages.filter((m) => m.direction === 'inbound').map((m) => m.prospect_id),
  )
  const replyRate =
    prospectIdsSentTo.size > 0
      ? prospectIdsReplied.size / prospectIdsSentTo.size
      : 0
  return { totalSent, totalReceived, replyRate }
}
