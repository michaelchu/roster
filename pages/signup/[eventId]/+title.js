import { formatEventDateTime } from '../../../src/lib/utils.js'

export default (pageContext) => {
  const { event } = pageContext.data
  return `Join: ${event.name} - ${formatEventDateTime(event.datetime)}`
}