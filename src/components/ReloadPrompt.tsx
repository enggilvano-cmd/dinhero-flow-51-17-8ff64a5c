import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useEffect } from 'react';

export function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error: Error) {
      console.log('SW registration error', error);
    },
  });

  useEffect(() => {
    if (offlineReady) {
      toast({
        title: "App pronto para uso offline",
        description: "O aplicativo está pronto para funcionar offline.",
      });
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady]);

  useEffect(() => {
    if (needRefresh) {
      toast({
        title: "Nova versão disponível",
        description: "Uma nova versão do aplicativo está disponível.",
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateServiceWorker(true)}
          >
            Atualizar
          </Button>
        ),
        duration: Infinity,
      });
    }
  }, [needRefresh, updateServiceWorker]);

  return null;
}
