import VerifyClient from './VerifyClient';
import { Suspense } from 'react';

export default function VerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Suspense fallback={<div>Loading...</div>}>
        <VerifyClient />
      </Suspense>
      </div>
  );
}
