import { Link, useLocation } from 'react-router-dom'
import { Home, Calendar, Users, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

const navItems = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: Calendar, label: 'Events', path: '/events' },
  { icon: Users, label: 'People', path: '/participants' },
  { icon: Settings, label: 'Settings', path: '/settings' },
]

export function BottomNav() {
  const location = useLocation()
  const { user } = useAuth()

  // Hide navigation for non-authenticated users
  if (!user) {
    return null
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex justify-around items-center h-14">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full py-1 text-xs",
                isActive ? "text-primary" : "text-gray-500"
              )}
            >
              <Icon className="h-5 w-5 mb-1" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}