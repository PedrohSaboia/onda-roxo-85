import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) view[i] = rawData.charCodeAt(i);
  return view;
}

export type PushStatus = 'idle' | 'requesting' | 'subscribed' | 'denied' | 'unsupported' | 'error';

export function usePushNotifications() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PushStatus>('idle');
  const subscriptionRef = useRef<PushSubscription | null>(null);

  /**
   * Salva ou atualiza a subscription no Supabase.
   * Recebe userId explicitamente para evitar problemas de closure com `user`.
   */
  const saveSubscription = async (sub: PushSubscription, userId: string) => {
    const subJson = sub.toJSON();
    console.log('[Push] Salvando subscription para user:', userId, subJson);

    const { error } = await (supabase as any).from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys?.p256dh ?? null,
        auth: subJson.keys?.auth ?? null,
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      console.error('[Push] Erro ao salvar subscription no Supabase:', error);
    } else {
      console.log('[Push] Subscription salva com sucesso!');
    }
  };

  /** Remove a subscription do Supabase */
  const deleteSubscription = async () => {
    if (!user) return;
    await (supabase as any).from('push_subscriptions').delete().eq('user_id', user.id);
  };

  /** Solicita permissão e inscreve o usuário */
  const subscribe = async (): Promise<boolean> => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[Push] Web Push não suportado neste navegador.');
      setStatus('unsupported');
      return false;
    }
    if (!VAPID_PUBLIC_KEY) {
      console.error('[Push] VITE_VAPID_PUBLIC_KEY não definida.');
      setStatus('error');
      return false;
    }

    // Busca o userId diretamente da sessão para não depender do closure
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id ?? user?.id;
    if (!userId) {
      console.warn('[Push] Usuário não autenticado, não é possível salvar subscription.');
      setStatus('error');
      return false;
    }

    setStatus('requesting');
    try {
      const permission = await Notification.requestPermission();
      console.log('[Push] Permissão:', permission);
      if (permission !== 'granted') {
        setStatus('denied');
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      console.log('[Push] Service Worker pronto:', reg);

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        console.log('[Push] Criando nova PushSubscription...');
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      } else {
        console.log('[Push] PushSubscription já existente, reutilizando.');
      }

      subscriptionRef.current = sub;
      await saveSubscription(sub, userId);
      setStatus('subscribed');
      return true;
    } catch (err) {
      console.error('[Push] Erro ao inscrever:', err);
      setStatus('error');
      return false;
    }
  };

  /** Cancela a inscrição */
  const unsubscribe = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await deleteSubscription();
      subscriptionRef.current = null;
      setStatus('idle');
    } catch (err) {
      console.error('[Push] Erro ao cancelar inscrição:', err);
    }
  };

  /** Ao montar, verifica se já existe uma subscription ativa */
  useEffect(() => {
    if (!user?.id || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          console.log('[Push] Subscription existente encontrada ao montar, re-salvando...');
          subscriptionRef.current = sub;
          await saveSubscription(sub, user.id);
          setStatus('subscribed');
        }
      } catch (err) {
        console.error('[Push] Erro na verificação inicial de subscription:', err);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { status, subscribe, unsubscribe, isSubscribed: status === 'subscribed' };
}
