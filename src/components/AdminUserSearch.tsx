import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/UserAvatar';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ShieldAlert, Search, Loader2 } from 'lucide-react';

interface SearchResult {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
}

export function AdminUserSearch() {
  const { impersonate } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setError(null);
      const { data, error: rpcError } = await supabase.rpc('search_users', {
        query,
        result_limit: 10,
      });

      if (rpcError) {
        setError(rpcError.message);
        setResults([]);
      } else {
        setResults(data ?? []);
      }
      setSearching(false);
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleImpersonate = async (userId: string) => {
    setImpersonating(true);
    setError(null);
    try {
      await impersonate(userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impersonation failed');
      setImpersonating(false);
    }
  };

  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      <div className="p-3 border-b bg-destructive/10">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          <h3 className="text-sm font-medium text-destructive">Admin</h3>
        </div>
      </div>

      <div className="p-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users by name or email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {searching && (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {!searching && results.length > 0 && (
          <div className="divide-y rounded-md border max-h-60 overflow-y-auto">
            {results.map((user) => (
              <div key={user.id} className="flex items-center gap-3 p-2">
                <UserAvatar
                  name={user.full_name || user.email}
                  avatarUrl={user.avatar_url}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  {user.full_name && (
                    <div className="text-sm font-medium truncate">{user.full_name}</div>
                  )}
                  <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs shrink-0"
                  onClick={() => handleImpersonate(user.id)}
                  disabled={impersonating}
                >
                  {impersonating ? <Loader2 className="h-3 w-3 animate-spin" /> : 'View as'}
                </Button>
              </div>
            ))}
          </div>
        )}

        {!searching && query.length >= 2 && results.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">No users found</p>
        )}
      </div>
    </div>
  );
}
