// hooks/usePush.tsx
import { createClient } from '@supabase/supabase-js';

interface PushSubscriptionData {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export const requestPushPermission = async (
  supabase: ReturnType<typeof createClient>,
  staffId: string
): Promise<void> => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push not supported');
    return;
  }

  const registration = await navigator.serviceWorker.ready;

  // Replace with your actual VAPID public key
  const VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY_HERE';

  const convertedKey = urlB64ToUint8Array(VAPID_PUBLIC_KEY);
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedKey,
    });

    const data: PushSubscriptionData = {
      endpoint: subscription.endpoint,
      p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
      auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!))),
    };

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ staff_id: staffId, ...data });

    if (error) console.error('Failed to save subscription', error);
  }
};

function urlB64ToUint8Array(base64Str: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Str.length % 4)) % 4);
  const base64 = (base64Str + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}