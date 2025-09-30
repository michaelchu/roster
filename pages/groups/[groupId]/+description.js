export default (pageContext) => {
  const { group, memberCount = 0, eventCount = 0 } = pageContext.data
  if (!group) {
    return 'Join our community'
  }
  const memberText = `${memberCount} member${memberCount !== 1 ? 's' : ''}`
  const eventText = eventCount > 0 ? ` • ${eventCount} event${eventCount !== 1 ? 's' : ''}` : ''
  const description = group.description ? ` • ${group.description}` : ''

  return `Join our group! ${memberText}${eventText}${description}`
}