import * as campaignsRepository from './campaigns.repository'
import type { Campaign, CreateCampaign, UpdateCampaign, AgentRun } from './campaigns.types'

export async function getAll(userId: string): Promise<Campaign[]> {
  return campaignsRepository.getAll(userId)
}

export async function getById(userId: string, id: string): Promise<Campaign | null> {
  return campaignsRepository.getById(userId, id)
}

export async function create(userId: string, data: CreateCampaign): Promise<Campaign> {
  return campaignsRepository.create(userId, data)
}

export async function update(userId: string, id: string, data: UpdateCampaign): Promise<Campaign> {
  return campaignsRepository.update(userId, id, data)
}

export async function remove(userId: string, id: string): Promise<void> {
  return campaignsRepository.remove(userId, id)
}

export async function updateStatus(
  userId: string,
  id: string,
  status: 'active' | 'paused' | 'completed',
): Promise<Campaign> {
  return campaignsRepository.updateStatus(userId, id, status)
}

export async function getActivity(
  userId: string,
  campaignId: string,
): Promise<AgentRun[]> {
  return campaignsRepository.getActivity(userId, campaignId)
}

export async function incrementStats(
  id: string,
  field: 'messages_sent' | 'replies_count' | 'meetings_booked' | 'prospects_count',
): Promise<void> {
  return campaignsRepository.incrementStats(id, field)
}
