import { formatEventDateTime } from '../../../src/lib/utils.js'

export default (pageContext) => {
  const { event } = pageContext.data
  if (!event?.name || !event?.datetime) {
    return 'Event Details'
  }
  return `Join: ${event.name} - ${formatEventDateTime(event.datetime)}`
}