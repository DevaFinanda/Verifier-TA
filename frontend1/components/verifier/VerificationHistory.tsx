'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  User,
  CalendarDays,
  Key,
  Trash2,
} from 'lucide-react';
import { deleteSession, getSessions, VerificationSession } from '@/services/verifierApi';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClaimsDisplayProps {
  claims: Record<string, unknown> | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function extractName(claims: Record<string, unknown> | null): string {
  if (!claims) return '—';
  return (
    (claims.holderName as string) ||
    (claims.nama as string) ||
    (claims.name as string) ||
    (claims.fullName as string) ||
    '—'
  );
}

function extractNik(claims: Record<string, unknown> | null): string {
  if (!claims) return '—';
  return (claims.nik as string) || (claims.nationalId as string) || '—';
}

function StatusBadge({ status }: { status: VerificationSession['status'] }) {
  switch (status) {
    case 'SUCCESS':
      return (
        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-200 gap-1">
          <CheckCircle2 className="h-3 w-3" /> Berhasil
        </Badge>
      );
    case 'FAILED':
      return (
        <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
          <XCircle className="h-3 w-3" /> Gagal
        </Badge>
      );
    case 'EXPIRED':
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 gap-1">
          <AlertCircle className="h-3 w-3" /> Kadaluarsa
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" /> Menunggu
        </Badge>
      );
  }
}

function ClaimsInline({ claims }: ClaimsDisplayProps) {
  if (!claims || Object.keys(claims).length === 0) {
    return <span className="text-muted-foreground text-xs">Tidak ada data</span>;
  }

  const skip = new Set(['id', 'sub', 'iss', 'iat', 'exp', 'nbf', 'jti', 'vct', 'cnf', '_sd', '_sd_alg']);
  const entries = Object.entries(claims).filter(([k]) => !skip.has(k));

  return (
    <ul className="space-y-0.5">
      {entries.map(([key, val]) => (
        <li key={key} className="flex gap-1.5 text-xs">
          <span className="text-muted-foreground min-w-[80px] shrink-0 capitalize">
            {key.replace(/([A-Z])/g, ' $1').trim()}:
          </span>
          <span className="text-foreground font-medium truncate max-w-[180px]">
            {String(val ?? '—')}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function VerificationHistory() {
  const [sessions, setSessions] = useState<VerificationSession[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const LIMIT = 10;

  const load = useCallback(async (p: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getSessions(p, LIMIT);
      setSessions(result.sessions);
      setTotal(result.total);
      setPage(result.page);
      setTotalPages(result.totalPages);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat riwayat verifikasi');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(1);
  }, [load]);

  async function handleDelete(sessionId: string) {
    const confirmed = window.confirm('Hapus sesi riwayat verifikasi ini? Aksi ini tidak bisa dibatalkan.');
    if (!confirmed) return;

    setDeletingId(sessionId);
    try {
      await deleteSession(sessionId);

      setExpandedId((current) => (current === sessionId ? null : current));

      const result = await load(page);
      if (result && result.sessions.length === 0 && page > 1) {
        await load(page - 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus sesi verifikasi');
    } finally {
      setDeletingId(null);
    }
  }

  const successCount = sessions.filter((s) => s.status === 'SUCCESS').length;
  const failedCount = sessions.filter((s) => s.status === 'FAILED').length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Riwayat Verifikasi</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Total {total} sesi tercatat di database
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => load(page)}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Sesi</p>
          <p className="text-2xl font-bold text-foreground mt-1">{total}</p>
        </Card>
        <Card className="p-4 border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/10">
          <p className="text-xs text-emerald-600">Berhasil (halaman ini)</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{successCount}</p>
        </Card>
        <Card className="p-4 border-destructive/20 bg-destructive/5">
          <p className="text-xs text-destructive">Gagal/Kadaluarsa (halaman ini)</p>
          <p className="text-2xl font-bold text-destructive mt-1">{failedCount + sessions.filter(s => s.status === 'EXPIRED').length}</p>
        </Card>
      </div>

      {/* Error */}
      {error && (
        <Card className="border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">⚠ {error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => load(page)}>
            Coba Lagi
          </Button>
        </Card>
      )}

      {/* Loading skeleton */}
      {isLoading && sessions.length === 0 && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="h-16 animate-pulse bg-muted/40" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && sessions.length === 0 && !error && (
        <Card className="p-12 text-center">
          <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Belum ada riwayat verifikasi</p>
        </Card>
      )}

      {/* Session list */}
      {sessions.length > 0 && (
        <div className="space-y-2">
          {sessions.map((session) => {
            const isExpanded = expandedId === session.id;
            const nama = extractName(session.disclosedClaims);
            const nik = extractNik(session.disclosedClaims);

            return (
              <Card
                key={session.id}
                className={`transition-all cursor-pointer hover:shadow-sm ${
                  isExpanded ? 'border-primary/30 bg-primary/5' : ''
                }`}
                onClick={() => setExpandedId(isExpanded ? null : session.id)}
              >
                <CardContent className="p-4">
                  {/* Row summary */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <StatusBadge status={session.status} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          {nama !== '—' ? nama : (
                            <span className="text-muted-foreground italic">Nama tidak tersedia</span>
                          )}
                        </p>
                        {nik !== '—' && (
                          <p className="text-xs text-muted-foreground mt-0.5">NIK: {nik}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                        <CalendarDays className="h-3 w-3" />
                        {fmtDate(session.requestedAt)}
                      </p>
                      {session.completedAt && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Selesai: {fmtDate(session.completedAt)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                      <div className="flex justify-end">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDelete(session.id);
                          }}
                          disabled={deletingId === session.id || isLoading}
                        >
                          <Trash2 className="h-4 w-4 mr-1.5" />
                          {deletingId === session.id ? 'Menghapus...' : 'Hapus sesi'}
                        </Button>
                      </div>

                      {/* Session ID */}
                      <div className="flex items-start gap-2 text-xs">
                        <Key className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <span className="text-muted-foreground">Session ID: </span>
                          <span className="font-mono text-foreground break-all">{session.id}</span>
                        </div>
                      </div>

                      {/* Holder DID */}
                      {session.holderDid && (
                        <div className="flex items-start gap-2 text-xs">
                          <Key className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <span className="text-muted-foreground">Holder DID: </span>
                            <span className="font-mono text-foreground break-all">{session.holderDid}</span>
                          </div>
                        </div>
                      )}

                      {/* Error */}
                      {session.error && (
                        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
                          <strong>Error:</strong> {session.error}
                        </div>
                      )}

                      {/* Claims */}
                      {session.disclosedClaims && (
                        <div>
                          <p className="text-xs font-semibold text-foreground mb-1.5">Klaim Terungkap:</p>
                          <div className="rounded-md bg-muted/40 border border-border/50 p-3">
                            <ClaimsInline claims={session.disclosedClaims} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Halaman {page} dari {totalPages} &nbsp;·&nbsp; {total} total sesi
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => load(page - 1)}
              disabled={page <= 1 || isLoading}
            >
              <ChevronLeft className="h-4 w-4" />
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => load(page + 1)}
              disabled={page >= totalPages || isLoading}
            >
              Berikutnya
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
