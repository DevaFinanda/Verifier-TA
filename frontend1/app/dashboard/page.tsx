'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, LogOut, User, Building2, QrCode, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VerificationDashboard } from '@/components/verifier/VerificationDashboard';
import { VerificationHistory } from '@/components/verifier/VerificationHistory';
import { logout } from '@/services/authApi';

type Tab = 'verifikasi' | 'riwayat';

interface UserInfo {
  id: string;
  name: string;
  email: string;
  fasikesName?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('verifikasi');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('token');
    if (!token) { router.replace('/login'); return; }
    try {
      const stored = localStorage.getItem('user');
      if (stored) setUser(JSON.parse(stored));
    } catch { /* lanjut */ }
  }, [router]);

  async function handleLogout() {
    setIsLoggingOut(true);
    try { await logout(); } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      document.cookie = 'verifier_token=; Path=/; Max-Age=0; SameSite=Lax';
      router.replace('/login');
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2.5">
              <div className="rounded-md bg-primary/10 p-1.5">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-foreground leading-none">Verifier System</h1>
                {user?.fasikesName && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Building2 className="h-3 w-3" />{user.fasikesName}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {user && (
                <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
                  <User className="h-4 w-4" /><span>{user.name}</span>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={handleLogout} disabled={isLoggingOut}>
                {isLoggingOut
                  ? <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  : <LogOut className="h-3.5 w-3.5" />}
                <span className="ml-1.5">Keluar</span>
              </Button>
            </div>
          </div>

          <div className="flex gap-0 border-t border-border/30" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === 'verifikasi'}
              onClick={() => setActiveTab('verifikasi')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'verifikasi'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <QrCode className="h-4 w-4" />Verifikasi Pasien
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'riwayat'}
              onClick={() => setActiveTab('riwayat')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'riwayat'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <ClipboardList className="h-4 w-4" />Riwayat Verifikasi
            </button>
          </div>
        </div>
      </header>

      <main>
        {activeTab === 'verifikasi' ? <VerificationDashboard /> : <VerificationHistory />}
      </main>
    </div>
  );
}
