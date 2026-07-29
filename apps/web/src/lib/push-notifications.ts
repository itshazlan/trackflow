function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function isPushSupported(): Promise<boolean> {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function getPushSubscriptionState(): Promise<{
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
}> {
  if (!(await isPushSupported())) {
    return { supported: false, permission: 'denied', subscribed: false };
  }

  const permission = Notification.permission;
  const registration = await navigator.serviceWorker.getRegistration('/sw.js');
  const subscription = registration
    ? await registration.pushManager.getSubscription()
    : null;

  return {
    supported: true,
    permission,
    subscribed: !!subscription,
  };
}

export async function enablePushNotifications(): Promise<boolean> {
  if (!(await isPushSupported())) {
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return false;
  }

  // Get VAPID public key
  const res = await fetch('/api/push/vapid-public-key');
  if (!res.ok) {
    throw new Error('Gagal mengambil VAPID public key dari server.');
  }
  const { publicKey } = await res.json();
  if (!publicKey) {
    throw new Error('VAPID public key tidak ditemukan.');
  }

  // Clean service worker registration & clear stale subscriptions
  let registration = await navigator.serviceWorker.getRegistration('/sw.js');
  if (registration) {
    try {
      const oldSub = await registration.pushManager.getSubscription();
      if (oldSub) {
        await oldSub.unsubscribe().catch(() => {});
      }
    } catch (e) {
      // ignore cleanup errors
    }
  } else {
    registration = await navigator.serviceWorker.register('/sw.js');
  }

  await navigator.serviceWorker.ready;

  const applicationServerKey = urlBase64ToUint8Array(publicKey);

  let subscription: PushSubscription;
  try {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  } catch (err: any) {
    console.error('[Web Push Subscribe Error]:', err);
    if (err.name === 'NotAllowedError') {
      return false;
    }

    const isBrave =
      typeof (navigator as any).brave !== 'undefined' &&
      typeof (navigator as any).brave.isBrave === 'function';

    if (isBrave) {
      throw new Error(
        'Brave Browser memblokir Push Service secara bawaan. Buka brave://settings/privacy lalu aktifkan "Use Google Services for Push Messaging".'
      );
    }

    throw new Error(
      `Gagal mendaftar push service (${err.message || 'Registration failed'}). Pastikan koneksi ke Google Cloud Messaging / FCM tidak terblokir firewall atau VPN.`
    );
  }

  const subJson = subscription.toJSON();

  const saveRes = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subJson),
  });

  if (!saveRes.ok) {
    throw new Error('Gagal menyimpan subscription ke backend.');
  }

  return true;
}




export async function disablePushNotifications(): Promise<void> {
  if (!(await isPushSupported())) return;

  const registration = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const endpoint = subscription.endpoint;
    await fetch('/api/push/unsubscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    }).catch(() => {});

    await subscription.unsubscribe();
  }
}
