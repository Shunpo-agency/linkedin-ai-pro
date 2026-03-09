import type { RefineParams } from '../claude.client'

export function buildPersonaRefinerPrompt(params: RefineParams): {
  system: string
  user: string
} {
  const system = `You are an expert B2B growth strategist specializing in LinkedIn prospecting and demand generation. Your task is to analyze campaign performance data alongside the current target persona configuration, and produce actionable refinement suggestions that will improve reply rates and meeting conversion.

Your analysis should consider:
- Whether the current roles, industries, or company sizes show signs of being too broad or too narrow
- Patterns that suggest certain segments are underperforming
- Opportunities to sharpen keywords or location targeting based on reply rate signals
- Whether the messaging strategy needs adjustment (which you can signal through persona keyword changes)

You MUST respond with ONLY valid JSON in this exact shape:
{
  "suggestions": [<array of concise, actionable suggestion strings>],
  "confidence": <float between 0 and 1 representing your confidence in these suggestions>
}

Each suggestion string should be a single, concrete recommendation (e.g., "Remove 'Manager' roles and focus exclusively on Director and VP-level titles" or "Add 'Series A' and 'Series B' as company size signals to target growth-stage startups").

Do not include any text outside the JSON object. Do not include markdown fences.`

  const personaText = [
    `Roles: ${params.currentPersona.roles.join(', ') || 'none set'}`,
    `Industries: ${params.currentPersona.industries.join(', ') || 'none set'}`,
    `Company sizes: ${params.currentPersona.companySizes.join(', ') || 'none set'}`,
    `Locations: ${params.currentPersona.locations.join(', ') || 'none set'}`,
    `Keywords: ${params.currentPersona.keywords.join(', ') || 'none set'}`,
  ].join('\n')

  const replyRatePct = (params.performanceData.replyRate * 100).toFixed(1)

  const user = `Analyze the following campaign and suggest persona refinements.

--- CURRENT PERSONA ---
${personaText}

--- CAMPAIGN PERFORMANCE ---
Total prospects reached: ${params.performanceData.totalProspects}
Messages sent: ${params.performanceData.messagesSent}
Replies received: ${params.performanceData.repliesCount}
Meetings booked: ${params.performanceData.meetingsBooked}
Reply rate: ${replyRatePct}%

Respond with JSON only.`

  return { system, user }
}
