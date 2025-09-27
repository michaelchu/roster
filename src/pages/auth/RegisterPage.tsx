import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';

export function RegisterPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signUp(email, password, name);
      navigate('/');
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b">
        <div className="flex items-center justify-center px-4 py-2">
          <h1 className="text-lg font-semibold">Sign Up</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-3 space-y-3">
        <div className="bg-card rounded-lg p-3 border space-y-3">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm">
              Name
            </Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              required
              className="h-10 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              className="h-10 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              required
              className="h-10 text-sm"
            />
          </div>

          {error && (
            <div className="text-xs text-destructive-foreground bg-destructive/10 p-2 rounded">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" size="sm" disabled={loading}>
            {loading ? 'Creating account...' : 'Sign Up'}
          </Button>

          <div className="text-center text-xs text-muted-foreground">
            Already have an account?{' '}
            <Link to="/auth/login" className="text-primary hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
