// hooks/useSync.ts
export const triggerSync = async (): Promise<void> => {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      // TypeScript does not recognize 'sync' on ServiceWorkerRegistration, so cast to 'any'
      await (registration as any).sync.register('sync-attendance');
    } catch (e) {
      console.error('Background Sync registration failed: ', e);
    }
  }
};