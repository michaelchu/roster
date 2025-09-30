export default (pageContext) => {
  if (!pageContext?.data?.group) {
    return 'Group Details'
  }
  const { group, memberCount = 0 } = pageContext.data
  if (!group.name) {
    return 'Group Details'
  }
  return `${group.name} - ${memberCount} member${memberCount !== 1 ? 's' : ''}`
}