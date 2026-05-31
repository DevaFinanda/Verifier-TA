'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login, AuthApiError } from '@/services/authApi';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kalau sudah login, langsung ke dashboard; kalau belum, tahan navigasi back/forward di halaman login
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('token');
    if (token) {
      router.replace('/dashboard');
      return;
    }

    const handlePopState = () => {
      router.replace('/login');
    };

    window.history.replaceState(null, '', '/login');
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const data = await login(email.trim(), password);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      const isHttps = window.location.protocol === 'https:';
      const secureFlag = isHttps ? '; Secure' : '';
      document.cookie = `verifier_token=${encodeURIComponent(data.token)}; Path=/; SameSite=Lax${secureFlag}`;
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError('Terjadi kesalahan jaringan. Coba lagi.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Branding */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Shield className="h-10 w-10 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Verifier System</h1>
          <p className="text-sm text-muted-foreground">
            Sistem Verifikasi Identitas Digital BPJS
          </p>
        </div>

        {/* Login card */}
        <Card className="border-border/50 shadow-lg">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Masuk ke Akun Anda</CardTitle>
            <CardDescription>
              Gunakan email dan password yang terdaftar
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error alert */}
              {error && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="dokter@fasikel.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Memverifikasi...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Masuk
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

      </div>
    </main>
  );
}
