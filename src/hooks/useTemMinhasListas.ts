import { useEffect, useState } from 'react';
import { aoMudar, listas } from '../services/minhasListas';

/** Há alguma lista da própria pessoa (M3U ou usuário e senha) ativa neste navegador? */
export function useTemMinhasListas(): boolean {
  const [tem, setTem] = useState(() => listas().some((l) => l.ativa));
  useEffect(() => aoMudar(() => setTem(listas().some((l) => l.ativa))), []);
  return tem;
}
