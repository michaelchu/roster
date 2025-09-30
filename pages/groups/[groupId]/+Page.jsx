'use client'

import { GroupDetailPage } from '../../../src/pages/GroupDetailPage'

export default function Page() {
  // Direct reuse of existing GroupDetailPage component
  // This leverages all existing group features including the new
  // role management and batch operations capabilities
  return <GroupDetailPage />
}