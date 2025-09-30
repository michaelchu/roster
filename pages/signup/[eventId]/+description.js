export default (pageContext) => {
  const { event } = pageContext.data
  if (!event) {
    return 'Join our event'
  }
  const location = event.location ? `Location: ${event.location}` : ''
  const cost = event.cost ? `Cost: ${event.cost}` : 'Cost: Free'
  return `${location} ${cost}`.trim()
}