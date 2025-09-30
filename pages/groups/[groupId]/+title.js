export default (pageContext) => {
  const { group, memberCount } = pageContext.data
  return `${group.name} - ${memberCount} members`
}