import { formatEventDateTime } from '../../../src/lib/utils.js'

export default {
  title: (pageContext) => {
    const { event } = pageContext.data
    return `Join: ${event.name} - ${formatEventDateTime(event.datetime)}`
  },

  description: (pageContext) => {
    const { event } = pageContext.data
    const location = event.location ? `📍 ${event.location}` : ''
    const cost = event.cost ? `💰 ${event.cost}` : '💰 Free'
    return `${location} ${cost}`.trim()
  },

  Head: './+Head.jsx',
  passToClient: ['data']
}