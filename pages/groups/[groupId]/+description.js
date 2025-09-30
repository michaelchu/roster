export default (pageContext) => {
  if (!pageContext.data || !pageContext.data.group) {
    return 'Join our group!'
  }
  const { group, memberCount, eventCount } = pageContext.data
  const safeCount = memberCount ?? 0
  const safeEventCount = eventCount ?? 0
  const memberText = `Members: ${safeCount} member${safeCount !== 1 ? 's' : ''}`
  const eventText = safeEventCount > 0 ? ` • ${safeEventCount} event${safeEventCount !== 1 ? 's' : ''}` : ''
  const description = group.description?.trim() ? ` • ${group.description.trim()}` : ''

  return `Join our group! ${memberText}${eventText}${description}`
}