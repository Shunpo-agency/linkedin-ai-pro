// ─────────────────────────────────────────────────────────────────────────────
// Cal.com API v2 client — booking link generation and availability checks.
// Requires CALCOM_API_KEY environment variable.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = 'https://api.cal.com/v2'

function getHeaders(): HeadersInit {
  const apiKey = process.env.CALCOM_API_KEY
  if (!apiKey) {
    throw new Error('CALCOM_API_KEY environment variable is not set')
  }
  return {
    'Content-Type': 'application/json',
    'cal-api-version': '2024-06-11',
    Authorization: `Bearer ${apiKey}`,
  }
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface TimeSlot {
  startTime: string
  endTime: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function handleResponse<T>(response: Response, context: string): Promise<T> {
  if (!response.ok) {
    let detail = response.statusText
    try {
      const body = (await response.json()) as { message?: string; error?: string }
      detail = body.message ?? body.error ?? detail
    } catch {
      // ignore — keep statusText
    }
    throw new Error(`Cal.com ${context} failed (${response.status}): ${detail}`)
  }
  return response.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Retrieve the public booking URL for a given event type and user.
 * Calls GET /event-types/{id} to resolve the slug and the owner's username.
 */
export async function getBookingLink(
  eventTypeId: string,
  userId: string,
): Promise<string> {
  const url = `${BASE_URL}/event-types/${eventTypeId}`

  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  })

  interface EventTypeResponse {
    status: string
    data?: {
      slug?: string
      owner?: {
        username?: string
      }
    }
  }

  const data = await handleResponse<EventTypeResponse>(response, 'getBookingLink')

  const slug = data.data?.slug
  const username = data.data?.owner?.username ?? userId

  if (!slug) {
    throw new Error(
      `Cal.com getBookingLink: event type ${eventTypeId} has no slug in response`,
    )
  }

  return `https://cal.com/${username}/${slug}`
}

/**
 * Return available time slots for a given event type on a specific date.
 * Calls GET /event-types/{id}/busy-times to determine free slots.
 */
export async function checkAvailability(
  eventTypeId: string,
  date: string,
): Promise<TimeSlot[]> {
  const params = new URLSearchParams({ date })
  const url = `${BASE_URL}/event-types/${eventTypeId}/busy-times?${params.toString()}`

  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  })

  interface AvailabilityResponse {
    status: string
    data?: {
      slots?: Array<{
        startTime: string
        endTime: string
      }>
    }
  }

  const data = await handleResponse<AvailabilityResponse>(response, 'checkAvailability')

  return (data.data?.slots ?? []).map((slot) => ({
    startTime: slot.startTime,
    endTime: slot.endTime,
  }))
}
