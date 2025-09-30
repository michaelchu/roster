import { serverEventService } from '@/services/server-services.js'
import { formatEventDateTime } from '@/lib/utils.js'
import { generateEventOGImage } from '@/lib/ogImageGenerator.js'

async function GET(pageContext) {
  try {
    const { eventId } = pageContext.routeParams

    // Fetch event data
    const event = await serverEventService.getEventById(eventId)
    if (!event) {
      return new Response('Event not found', { status: 404 })
    }

    // Generate OG image using shared utility
    return generateEventOGImage(event, formatEventDateTime)

  } catch (error) {
    console.error('Error generating event OG image:', error)
    return new Response('Error generating image', { status: 500 })
  }
}

export const route = GET