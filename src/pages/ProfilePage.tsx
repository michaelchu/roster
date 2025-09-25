import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, User, Save } from 'lucide-react'

export function ProfilePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    fullName: user?.user_metadata?.full_name || '',
    email: user?.email || ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        email: formData.email,
        data: {
          full_name: formData.fullName
        }
      })

      if (error) throw error

      // Navigate back to settings
      // Note: User data will be automatically updated through auth state listener
      navigate('/settings')
    } catch (error) {
      console.error('Error updating profile:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 pb-14 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold mb-2">Sign In Required</h1>
          <p className="text-sm text-gray-500 mb-4">
            Please sign in to access your profile
          </p>
          <Button
            size="sm"
            onClick={() => navigate('/auth/login')}
          >
            Sign In
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="flex items-center justify-center px-4 py-2 relative">
          <button
            onClick={() => navigate('/settings')}
            className="absolute left-4"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-center">Profile</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-3 space-y-3">
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="p-3 border-b bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-primary rounded-full flex items-center justify-center">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Edit Profile</div>
                <div className="text-xs text-gray-400">Update your personal information</div>
              </div>
            </div>
          </div>

          <div className="p-3 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                placeholder="Enter your full name"
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Enter your email address"
                className="h-10 text-sm"
              />
              <p className="text-xs text-gray-500">
                Changing your email will require verification
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-3">
          <div className="text-xs text-gray-500">
            <div className="mb-2">
              <strong>Account Information</strong>
            </div>
            <div className="space-y-1">
              <div>User ID: {user.id.slice(0, 8)}...</div>
              <div>Account created: {new Date(user.created_at!).toLocaleDateString()}</div>
              <div>Last sign in: {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'N/A'}</div>
            </div>
          </div>
        </div>
      </form>

      {/* Save Button above navbar */}
      <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2">
        <Button
          onClick={handleSubmit}
          className="w-full text-white shadow-lg"
          size="sm"
          disabled={loading}
        >
          <Save className="h-5 w-5 mr-2" />
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}