export function initials(firstName: string | null, lastName: string | null): string {
  const f = firstName?.charAt(0).toUpperCase() ?? ''
  const l = lastName?.charAt(0).toUpperCase() ?? ''
  return f + l || '?'
}

export function fullName(firstName: string | null, lastName: string | null): string {
  return [firstName, lastName].filter(Boolean).join(' ') || 'Unknown'
}

export function temperatureLabel(temperature: string): string {
  const labels: Record<string, string> = {
    cold: 'Cold',
    warm: 'Warm',
    hot: 'Hot',
  }
  return labels[temperature] ?? temperature
}

export function bookingStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    none: 'None',
    link_sent: 'Link Sent',
    booked: 'Booked',
  }
  return labels[status] ?? status
}
