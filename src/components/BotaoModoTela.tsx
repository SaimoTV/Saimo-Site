/**
 * Botão "Tela" dos players (filme e ao vivo): cada aperto passa para o próximo
 * modo (Ajustar → Zoom → Esticar → 16:9 → 4:3) e mostra o nome por um instante.
 * Funciona com o controle das TVs (é um botão comum do D-pad).
 */
import { useEffect, useState } from 'react';
import { NOME_DO_MODO, gravarModoTela, proximoModoTela } from '../utils/modoTela';
import { useModoTela } from '../hooks/useModoTela';

export function BotaoModoTela({ aoUsar }: { aoUsar?: () => void }) {
  const modo = useModoTela();
  const [aviso, setAviso] = useState<string | null>(null);
  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 1600);
    return () => window.clearTimeout(t);
  }, [aviso]);
  const trocar = () => {
    const novo = proximoModoTela(modo);
    gravarModoTela(novo);
    setAviso(NOME_DO_MODO[novo]);
    aoUsar?.();
  };
  return (
    <>
      <button
        className="control-btn"
        onClick={(e) => { e.stopPropagation(); trocar(); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trocar(); } }}
        title={`Tela: ${NOME_DO_MODO[modo]}`}
        aria-label={`Tela: ${NOME_DO_MODO[modo]}`}
        data-focusable="true"
        data-nav-group="player-controls"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M7 9H5v2M17 9h2v2M7 15H5v-2M17 15h2v-2" />
        </svg>
      </button>
      {aviso && (
        <div
          role="status"
          style={{
            position: 'fixed', top: '12%', left: '50%', transform: 'translateX(-50%)', zIndex: 50,
            background: 'rgba(10,12,20,0.85)', color: '#fff', padding: '10px 18px', borderRadius: 12,
            fontSize: 18, fontWeight: 600, pointerEvents: 'none', border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          Tela: {aviso}
        </div>
      )}
    </>
  );
}
