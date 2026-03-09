// ─────────────────────────────────────────────────────────────────────────────
// Unipile HTTP client — wraps all LinkedIn-related Unipile API calls.
// Requires UNIPILE_API_KEY and UNIPILE_DSN environment variables.
// ─────────────────────────────────────────────────────────────────────────────

const API_KEY = process.env.UNIPILE_API_KEY
const DSN = process.env.UNIPILE_DSN // e.g. "api1.unipile.com:13301"

function getBaseUrl(): string {
  if (!DSN) {
    throw new Error('UNIPILE_DSN environment variable is not set')
  }
  // Support DSN with or without the protocol prefix
  if (DSN.startsWith('http://') || DSN.startsWith('https://')) {
    return DSN.replace(/\/$/, '')
  }
  return `https://${DSN}`
}

function getHeaders(): HeadersInit {
  if (!API_KEY) {
    throw new Error('UNIPILE_API_KEY environment variable is not set')
  }
  return {
    'Content-Type': 'application/json',
    'X-API-KEY': API_KEY,
  }
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface UnipileProfile {
  id: string
  firstName: string | null
  lastName: string | null
  headline: string | null
  location: string | null
  profileUrl: string
  pictureUrl: string | null
  company: string | null
  industry: string | null
  connectionDegree: number | null
}

export interface UnipileMessage {
  id: string
  threadId: string
  accountId: string
  senderId: string
  senderName: string | null
  content: string
  sentAt: string
  isInbound: boolean
}

export interface SearchFilters {
  keywords?: string[]
  roles?: string[]
  industries?: string[]
  locations?: string[]
  companySizes?: string[]
  limit?: number
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
      // ignore JSON parse errors — use statusText
    }
    throw new Error(`Unipile ${context} failed (${response.status}): ${detail}`)
  }
  return response.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Search LinkedIn profiles via Unipile's people-search endpoint.
 * Returns an array of matched profiles up to the requested limit.
 */
export async function searchLinkedInProfiles(
  filters: SearchFilters,
): Promise<UnipileProfile[]> {
  const params = new URLSearchParams()
  if (filters.keywords?.length) params.set('keywords', filters.keywords.join(' '))
  if (filters.locations?.length) params.set('geo_urn', filters.locations.join(','))
  if (filters.industries?.length) params.set('industry', filters.industries.join(','))
  if (filters.limit) params.set('count', String(filters.limit))

  const url = `${getBaseUrl()}/api/v1/linkedin/search/people?${params.toString()}`

  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  })

  const data = await handleResponse<{ items?: UnipileProfile[] }>(
    response,
    'searchLinkedInProfiles',
  )

  return data.items ?? []
}

export interface LinkedInProfile {
  providerId: string
  firstName: string | null
  lastName: string | null
  headline: string | null
  company: string | null
  profilePictureUrl: string | null
}

/**
 * Fetch a LinkedIn profile by public identifier (slug) and return full profile info.
 * e.g. "john-doe" from linkedin.com/in/john-doe
 */
export async function getLinkedInProfile(
  accountId: string,
  identifier: string,
): Promise<LinkedInProfile> {
  const url = `${getBaseUrl()}/api/v1/users/${encodeURIComponent(identifier)}?account_id=${encodeURIComponent(accountId)}`

  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  })

  interface RawProfile {
    provider_id?: string
    id?: string
    first_name?: string
    last_name?: string
    headline?: string
    current_company?: string
    company?: string
    profile_picture_url?: string
    picture_url?: string
  }

  const data = await handleResponse<RawProfile>(response, 'getLinkedInProfile')
  const providerId = data.provider_id ?? data.id
  if (!providerId) throw new Error('getLinkedInProfile: no provider_id in response')

  return {
    providerId,
    firstName: data.first_name ?? null,
    lastName: data.last_name ?? null,
    headline: data.headline ?? null,
    company: data.current_company ?? data.company ?? null,
    profilePictureUrl: data.profile_picture_url ?? data.picture_url ?? null,
  }
}

/**
 * Resolve a LinkedIn public identifier (slug) to a Unipile provider_id (URN).
 * e.g. "john-doe" → "ACoAAA..."
 */
export async function resolveProviderId(
  accountId: string,
  identifier: string,
): Promise<string> {
  const profile = await getLinkedInProfile(accountId, identifier)
  return profile.providerId
}

/**
 * Send a LinkedIn connection request with an optional personalised note.
 * Correct endpoint: POST /api/v1/users/invite
 */
export async function sendConnectionRequest(
  accountId: string,
  profileId: string,
  note: string,
): Promise<void> {
  const url = `${getBaseUrl()}/api/v1/users/invite`

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      account_id: accountId,
      provider_id: profileId,
      message: note,
    }),
  })

  await handleResponse<unknown>(response, 'sendConnectionRequest')
}

/**
 * Start a new direct message conversation (requires existing connection).
 * Uses multipart/form-data as required by Unipile.
 */
export async function sendNewDirectMessage(
  accountId: string,
  attendeeProviderId: string,
  text: string,
): Promise<void> {
  const url = `${getBaseUrl()}/api/v1/chats`

  const form = new FormData()
  form.append('account_id', accountId)
  form.append('text', text)
  form.append('attendees_ids', attendeeProviderId)
  form.append('linkedin[api]', 'classic')

  // Don't use getHeaders() here — let fetch set the multipart boundary automatically
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { 'Content-Type': _ct, ...headersWithoutContentType } = getHeaders() as Record<string, string>

  const response = await fetch(url, {
    method: 'POST',
    headers: headersWithoutContentType,
    body: form,
  })

  await handleResponse<unknown>(response, 'sendNewDirectMessage')
}

/**
 * Send a message to an existing LinkedIn thread.
 */
export async function sendLinkedInMessage(
  accountId: string,
  threadId: string,
  content: string,
): Promise<void> {
  const url = `${getBaseUrl()}/api/v1/chats/${threadId}/messages`

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      account_id: accountId,
      text: content,
    }),
  })

  await handleResponse<unknown>(response, 'sendLinkedInMessage')
}

/**
 * Fetch messages for a Unipile account, optionally filtered by a start date.
 */
export async function getAccountMessages(
  accountId: string,
  since?: Date,
): Promise<UnipileMessage[]> {
  const params = new URLSearchParams({ account_id: accountId })
  if (since) {
    params.set('before', since.toISOString())
  }

  const url = `${getBaseUrl()}/api/v1/chats?${params.toString()}`

  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  })

  interface RawThread {
    id: string
    account_id: string
    messages?: RawMessage[]
  }

  interface RawMessage {
    id: string
    sender_id: string
    sender_name: string | null
    text: string
    created_at: string
    is_sender: boolean
  }

  const data = await handleResponse<{ items?: RawThread[] }>(
    response,
    'getAccountMessages',
  )

  const messages: UnipileMessage[] = []

  for (const thread of data.items ?? []) {
    for (const msg of thread.messages ?? []) {
      messages.push({
        id: msg.id,
        threadId: thread.id,
        accountId: thread.account_id,
        senderId: msg.sender_id,
        senderName: msg.sender_name,
        content: msg.text,
        sentAt: msg.created_at,
        isInbound: !msg.is_sender,
      })
    }
  }

  return messages
}

/**
 * Generate a hosted-auth URL for connecting a new LinkedIn account via Unipile.
 */
export async function getHostedAuthUrl(redirectUrl: string): Promise<string> {
  const url = `${getBaseUrl()}/api/v1/hosted/accounts/link`

  // expiresOn: 1 hour from now
  const expiresOn = new Date(Date.now() + 60 * 60 * 1000).toISOString()

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      type: 'create',
      providers: ['LINKEDIN'],
      api_url: getBaseUrl(),
      expiresOn,
      success_redirect_url: redirectUrl,
      failure_redirect_url: redirectUrl,
    }),
  })

  const data = await handleResponse<{ url?: string }>(response, 'getHostedAuthUrl')

  if (!data.url) {
    throw new Error('Unipile getHostedAuthUrl: response did not contain a URL')
  }

  return data.url
}

/**
 * Retrieve basic profile info for a connected Unipile account.
 */
export async function getAccountInfo(
  accountId: string,
): Promise<{ name: string; profileUrl: string; pictureUrl: string }> {
  const url = `${getBaseUrl()}/api/v1/accounts/${accountId}`

  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  })

  interface RawAccount {
    name?: string
    profile_url?: string
    picture_url?: string
  }

  const data = await handleResponse<RawAccount>(response, 'getAccountInfo')

  return {
    name: data.name ?? '',
    profileUrl: data.profile_url ?? '',
    pictureUrl: data.picture_url ?? '',
  }
}
