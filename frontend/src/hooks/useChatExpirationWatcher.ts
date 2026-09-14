import { useEffect } from "react";
import { useChatStore } from "@/store/useChatStore";

/** Intervalo de checagem enquanto a aba está aberta. */
const CHECK_INTERVAL_MS = 60 * 1000; // 1 minuto

/**
 * Garante que o chat expire mesmo se a aba ficar aberta parada por mais de
 * 30 minutos (não só quando a página é recarregada):
 * - checa periodicamente via setInterval;
 * - checa também quando a aba volta a ficar visível (o usuário trocou de
 *   aba/app e voltou depois de um tempo).
 */
export function useChatExpirationWatcher() {
  const hydrate = useChatStore((state) => state.hydrate);
  const checkExpiration = useChatStore((state) => state.checkExpiration);

  useEffect(() => {
    hydrate();

    const interval = window.setInterval(checkExpiration, CHECK_INTERVAL_MS);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        checkExpiration();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
