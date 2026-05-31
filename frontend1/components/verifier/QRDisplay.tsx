'use client';

import QRCode from 'qrcode.react';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

interface QRDisplayProps {
  qrUrl: string;
  requestId: string;
  isWaiting?: boolean;
}

export function QRDisplay({ qrUrl, requestId, isWaiting = false }: QRDisplayProps) {
  return (
    <Card className="flex flex-col items-center justify-center gap-8 border-primary/20 bg-card/50 p-8 backdrop-blur-sm">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">Scan QR Code</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Use your digital wallet to scan this QR code
        </p>
      </div>

      <div className="relative flex items-center justify-center rounded-xl border-2 border-border bg-white p-6">
        <QRCode
          value={qrUrl}
          size={256}
          level="M"
          includeMargin={true}
          quietZone={8}
        />
      </div>

      {isWaiting && (
        <div className="flex flex-col items-center gap-3">
          <Spinner />
          <p className="text-sm text-muted-foreground">Waiting for presentation...</p>
        </div>
      )}

      <div className="w-full rounded-lg bg-secondary/50 p-4 text-center">
        <p className="text-xs text-muted-foreground">Request ID</p>
        <p className="mt-1 font-mono text-sm text-foreground">{requestId}</p>
      </div>
    </Card>
  );
}
