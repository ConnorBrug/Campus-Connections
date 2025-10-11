
'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      console.error("Caught Firestore Permission Error:", error);
      
      // In a local dev environment, we can throw the error to show Next.js overlay
      if (process.env.NODE_ENV === 'development') {
         throw error;
      }

      // In production, show a friendly toast notification
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "You do not have permission to perform this action.",
      });
    };

    errorEmitter.on('permission-error', handlePermissionError);

    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [toast]);

  return null; // This component does not render anything
}
