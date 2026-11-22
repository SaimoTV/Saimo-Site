import { useEffect, useState } from 'react';
import { EVENTO_MODO_TELA, lerModoTela, type ModoTela } from '../utils/modoTela';

/** O modo atual, atualizado quando muda em qualquer player ou nos Ajustes. */
export function useModoTela(): ModoTela {
  const [modo, setModo] = useState<ModoTela>(lerModoTela);
  useEffect(() => {
    const aoMudar = () => setModo(lerModoTela());
    window.addEventListener(EVENTO_MODO_TELA, aoMudar);
    return () => window.removeEventListener(EVENTO_MODO_TELA, aoMudar);
  }, []);
  return modo;
}
