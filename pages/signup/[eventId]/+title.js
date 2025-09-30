import { formatEventDateTime } from '../../../src/lib/utils.js'

export default (pageContext) => {
  if (!pageContext?.data?.event) {
    return 'Join Event'
  }
  const { event } = pageContext.data
  if (!event.name || !event.datetime) {
    return 'Join Event'
  }
  return `Join: ${event.name} - ${formatEventDateTime(event.datetime)}`
}