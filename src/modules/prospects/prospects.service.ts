import * as prospectsRepository from './prospects.repository'
import type { Prospect, CreateProspect, UpdateProspect, ProspectFilters } from './prospects.types'

export async function getAll(
  userId: string,
  filters?: ProspectFilters,
): Promise<Prospect[]> {
  return prospectsRepository.getAll(userId, filters)
}

export async function getById(userId: string, id: string): Promise<Prospect> {
  const prospect = await prospectsRepository.getById(userId, id)

  if (prospect === null) {
    throw new Error(`Prospect not found: ${id}`)
  }

  return prospect
}

export async function create(
  userId: string,
  data: CreateProspect,
): Promise<Prospect> {
  return prospectsRepository.create(userId, data)
}

export async function update(
  userId: string,
  id: string,
  data: UpdateProspect,
): Promise<Prospect> {
  const existing = await prospectsRepository.getById(userId, id)

  if (existing === null) {
    throw new Error(`Prospect not found: ${id}`)
  }

  return prospectsRepository.update(userId, id, data)
}

export async function getStats(userId: string): Promise<{
  total: number
  byTemperature: { cold: number; warm: number; hot: number }
}> {
  const [total, byTemperature] = await Promise.all([
    prospectsRepository.getCount(userId),
    prospectsRepository.getCountByTemperature(userId),
  ])

  return { total, byTemperature }
}
