import { eventService } from '../../../src/services/index.js'

export async function data(pageContext) {
  const { eventId } = pageContext.routeParams

  try {
    // Use existing eventService to fetch event data
    const event = await eventService.getEventById(eventId)

    if (!event) {
      throw new Error(`Event with ID ${eventId} not found`)
    }

    return {
      event
    }
  } catch (error) {
    console.error('Error fetching event data for SSR:', error)
    throw error
  }
}