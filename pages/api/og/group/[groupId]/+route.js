import { serverGroupService } from '@/services/server-services.js'
import { generateGroupOGImage } from '@/lib/ogImageGenerator.js'

async function GET(pageContext) {
  try {
    const { groupId } = pageContext.routeParams

    // Fetch group data
    const group = await serverGroupService.getGroupById(groupId)
    if (!group) {
      return new Response('Group not found', { status: 404 })
    }

    // Get enhanced group statistics
    const memberCount = group.participant_count || 0
    const eventCount = group.event_count || 0

    // Generate OG image using shared utility
    return generateGroupOGImage(group, memberCount, eventCount)

  } catch (error) {
    console.error('Error generating group OG image:', error)
    return new Response('Error generating image', { status: 500 })
  }
}

export const route = GET