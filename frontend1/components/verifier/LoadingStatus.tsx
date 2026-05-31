'use client';

import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

interface LoadingStatusProps {
  message?: string;
  description?: string;
}

export function LoadingStatus({
  message = 'Verifying Credentials',
  description = 'Please keep your wallet open while we process your request...',
}: LoadingStatusProps) {
  return (
    <Card className="flex flex-col items-center justify-center gap-6 border-primary/20 bg-card/50 py-16 backdrop-blur-sm">
      <Spinner className="h-12 w-12 text-primary" />
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">{message}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex gap-1">
        <div className="h-2 w-2 rounded-full bg-primary/40 animate-pulse"></div>
        <div className="h-2 w-2 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.4s' }}></div>
      </div>
    </Card>
  );
}
