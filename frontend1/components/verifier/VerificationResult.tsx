'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { VerificationResult as VerificationResultType } from '@/types/verifier';
import { CheckCircle2, XCircle, Clock, RotateCcw } from 'lucide-react';

interface VerificationResultProps {
  result: VerificationResultType;
  onReset?: () => void;
}

export function VerificationResult({ result, onReset }: VerificationResultProps) {
  const reasonCodes = result.reasonCodes || [];
  const checks = result.checks || [];

  // ── SUCCESS ──────────────────────────────────────────────────────────────────
  if (result.status === 'SUCCESS') {
    const c = result.claims;
    // Resolve display values — backend may send holderName or nama, tanggalLahir or tanggal_lahir
    const nama         = c.holderName || c.nama || '—';
    const nik          = c.nik        || '—';
    const tanggalLahir = c.tanggalLahir || c.tanggal_lahir || '—';

    return (
      <div className="space-y-4">
        <Card className="border-green-500/30 bg-green-50/50 dark:bg-green-950/20 p-6">
          <div className="flex items-center gap-4">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400 flex-shrink-0" />
            <div>
              <h2 className="text-lg font-semibold text-green-900 dark:text-green-100">
                Verification Successful
              </h2>
              <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                Credential verified and validated
              </p>
            </div>
          </div>
        </Card>

        <Card className="border-primary/20 bg-card/50 p-6 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-foreground mb-6">Credential Information</h3>

          <div className="grid gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium uppercase text-muted-foreground">
                National ID (NIK)
              </label>
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="font-mono text-sm text-foreground">{String(nik)}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium uppercase text-muted-foreground">
                Full Name
              </label>
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-sm text-foreground">{String(nama)}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium uppercase text-muted-foreground">
                Date of Birth
              </label>
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-sm text-foreground">
                  {String(tanggalLahir)}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {checks.length > 0 && (
          <Card className="border-primary/20 bg-card/50 p-6 backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-foreground mb-4">Verification Checks</h3>
            <div className="space-y-2">
              {checks.map((check) => (
                <div
                  key={check.name}
                  className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2"
                >
                  <span className="text-sm text-foreground">{check.name}</span>
                  <span className={check.passed ? 'text-green-600 text-xs font-medium' : 'text-red-600 text-xs font-medium'}>
                    {check.passed ? 'PASS' : 'FAIL'}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {onReset && (
          <Button onClick={onReset} variant="outline" className="w-full gap-2">
            <RotateCcw className="h-4 w-4" />
            Start New Verification
          </Button>
        )}
      </div>
    );
  }

  // ── EXPIRED ─────────────────────────────────────────────────────────────
  if (result.status === 'EXPIRED' || result === null) {
    return (
      <div className="space-y-4">
        <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-6">
          <div className="flex items-center gap-4">
            <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <div>
              <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
                Session Expired
              </h2>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                The holder did not respond within 2 minutes. Please generate a new QR code.
              </p>
            </div>
          </div>
        </Card>

        {onReset && (
          <Button onClick={onReset} variant="outline" className="w-full gap-2">
            <RotateCcw className="h-4 w-4" />
            Generate New QR
          </Button>
        )}
      </div>
    );
  }

  // ── FAILED ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <Card className="border-red-500/30 bg-red-50/50 dark:bg-red-950/20 p-6">
        <div className="flex items-center gap-4">
          <XCircle className="h-8 w-8 text-red-600 dark:text-red-400 flex-shrink-0" />
          <div>
            <h2 className="text-lg font-semibold text-red-900 dark:text-red-100">
              Verification Failed
            </h2>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">
              {result.status === 'FAILED' ? (result.error || 'Unknown error occurred') : 'Unknown error occurred'}
            </p>
            {reasonCodes.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {reasonCodes.map((code) => (
                  <span
                    key={code}
                    className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300"
                  >
                    {code}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {checks.length > 0 && (
        <Card className="border-red-500/20 bg-card/50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Validation Trace</h3>
          <div className="space-y-2">
            {checks.map((check) => (
              <div key={check.name} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{check.name}</span>
                <span className={check.passed ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                  {check.passed ? 'PASS' : 'FAIL'}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {onReset && (
        <Button onClick={onReset} variant="outline" className="w-full gap-2">
          <RotateCcw className="h-4 w-4" />
          Try Again
        </Button>
      )}
    </div>
  );
}
