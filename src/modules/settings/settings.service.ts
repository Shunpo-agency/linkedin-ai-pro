import * as settingsRepository from './settings.repository'
import type { BusinessSettings, UpdateSettings } from './settings.types'

export async function getSettings(
  userId: string,
): Promise<BusinessSettings | null> {
  return settingsRepository.getByUser(userId)
}

export async function updateSettings(
  userId: string,
  data: UpdateSettings,
): Promise<BusinessSettings> {
  return settingsRepository.upsert(userId, data)
}

export async function ensureSettings(userId: string): Promise<BusinessSettings> {
  const existing = await settingsRepository.getByUser(userId)

  if (existing !== null) {
    return existing
  }

  return settingsRepository.upsert(userId, {
    business_name: null,
    business_description: null,
    offers: [],
    main_features: [],
    business_model: null,
    target_persona: null,
    ai_behavior: undefined,
  })
}
