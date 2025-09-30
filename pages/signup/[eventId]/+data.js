import { serverEventService } from '../../../src/services/server-services.js'

export async function data(pageContext) {
  const { eventId } = pageContext.routeParams

  try {
    // Use server-compatible eventService for SSR data fetching
    const event = await serverEventService.getEventById(eventId)

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