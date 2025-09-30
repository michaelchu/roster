export default (pageContext) => {
  const { event } = pageContext.data
  const location = event.location ? `📍 ${event.location}` : ''
  const cost = event.cost ? `💰 ${event.cost}` : '💰 Free'
  return `${location} ${cost}`.trim()
}