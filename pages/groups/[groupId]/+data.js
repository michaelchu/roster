import { serverGroupService } from '../../../src/services/server-services.js'

export async function data(pageContext) {
  const { groupId } = pageContext.routeParams

  try {
    // Use server-compatible groupService for SSR data fetching
    const group = await serverGroupService.getGroupById(groupId)

    if (!group) {
      throw new Error(`Group with ID ${groupId} not found`)
    }

    // Get enhanced member count using the new group features
    const memberCount = group.participant_count || 0
    const eventCount = group.event_count || 0

    return {
      group,
      memberCount,
      eventCount
    }
  } catch (error) {
    console.error('Error fetching group data for SSR:', error)
    throw error
  }
}