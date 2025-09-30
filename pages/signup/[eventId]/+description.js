export default (pageContext) => {
  if (!pageContext?.data?.event) {
    return 'Join our event'
  }
  const { event } = pageContext.data
  const location = event.location ? `Location: ${event.location}` : ''
  const cost = event.cost ? `Cost: ${event.cost}` : 'Cost: Free'
  return `${location} ${cost}`.trim()
}