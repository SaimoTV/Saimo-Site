/**
 * Aba Novelinhas do On Demand: minisséries verticais da RedeFlix.
 *
 * A grade mostra as capas em pé; tocar abre o player vertical, feito para o
 * celular em pé: o vídeo ocupa a tela, deslizar para cima passa ao próximo
 * episódio (para baixo volta), tocar pausa, e no fim de cada episódio o
 * seguinte começa sozinho — o próximo já vem carregando enquanto este toca.
 * No computador o vídeo fica centralizado, com as setas do teclado e a roda
 * do mouse no lugar do gesto.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  carregarNovelinhas,
  emAndamento,
  guardarParada,
  paradaDe,
  urlEpisodio,
  type Novelinha,
} from '../services/novelinhas';
import './Novelinhas.css';

type Audio = 'todas' | 'dub' | 'leg';

export function NovelinhasTela({ aoContar }: { aoContar?: (total: number) => void }) {
  const [base, setBase] = useState('');
  const [lista, setLista] = useState<Novelinha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [audio, setAudio] = useState<Audio>('todas');
  const [genero, setGenero] = useState('');
  const [termo, setTermo] = useState('');
  const [aberta, setAberta] = useState<Novelinha | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let vivo = true;
    carregarNovelinhas().then(({ base: b, lista: l }) => {
      if (!vivo) return;
      setBase(b);
      setLista(l);
      setCarregando(false);
      aoContar?.(l.length);
    });
    return () => { vivo = false; };
  }, [aoContar]);

  const generos = useMemo(() => {
    const conta = new Map<string, number>();
    for (const n of lista) for (const g of n.generos) conta.set(g, (conta.get(g) || 0) + 1);
    return [...conta.entries()].filter(([, q]) => q >= 5).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([g]) => g);
  }, [lista]);

  const filtradas = useMemo(() => {
    const t = termo.trim().toLowerCase();
    return lista.filter((n) =>
      (audio === 'todas' || (audio === 'dub') === n.dublada)
      && (!genero || n.generos.includes(genero))
      && (!t || n.titulo.toLowerCase().includes(t)));
  }, [lista, audio, genero, termo]);

  const continuar = useMemo(() => {
    void versao;
    const porId = new Map(lista.map((n) => [n.id, n]));
    return emAndamento().map((a) => porId.get(a.id)).filter((n): n is Novelinha => !!n).slice(0, 20);
  }, [lista, versao]);

  const fechar = useCallback(() => { setAberta(null); setVersao((v) => v + 1); }, []);

  if (carregando) return <div className="novelinhas-aviso">Carregando novelinhas…</div>;
  if (!lista.length) return <div className="novelinhas-aviso">Nenhuma novelinha disponível agora.</div>;

  return (
    <div className="novelinhas">
      {continuar.length > 0 && (
        <section className="novelinhas-secao">
          <h2>Continue assistindo</h2>
          <div className="novelinhas-trilho">
            {continuar.map((n) => (
              <Cartao key={n.id} n={n} aoAbrir={setAberta} />
            ))}
          </div>
        </section>
      )}

      <div className="novelinhas-filtros">
        <input
          type="search"
          className="novelinhas-busca"
          placeholder="Buscar novelinha…"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
        {(['todas', 'dub', 'leg'] as Audio[]).map((a) => (
          <button key={a} className={`novelinhas-chip${audio === a ? ' ativa' : ''}`} onClick={() => setAudio(a)}>
            {a === 'todas' ? 'Todas' : a === 'dub' ? 'Dubladas' : 'Legendadas'}
          </button>
        ))}
        <span className="novelinhas-divisor" />
        <button className={`novelinhas-chip${!genero ? ' ativa' : ''}`} onClick={() => setGenero('')}>Todos os temas</button>
        {generos.map((g) => (
          <button key={g} className={`novelinhas-chip${genero === g ? ' ativa' : ''}`} onClick={() => setGenero(g)}>{g}</button>
        ))}
      </div>

      <p className="novelinhas-total">{filtradas.length.toLocaleString('pt-BR')} novelinhas</p>
      <div className="novelinhas-grade">
        {filtradas.map((n) => <Cartao key={n.id} n={n} aoAbrir={setAberta} />)}
      </div>

      {aberta && base && createPortal(
        <PlayerVertical base={base} novelinha={aberta} aoFechar={fechar} />,
        document.body,
      )}
    </div>
  );
}

function Cartao({ n, aoAbrir }: { n: Novelinha; aoAbrir: (n: Novelinha) => void }) {
  const parada = paradaDe(n.id);
  return (
    <button className="novelinhas-cartao" onClick={() => aoAbrir(n)} title={n.titulo}>
      <div className="novelinhas-capa">
        <img src={n.capa} alt="" loading="lazy" referrerPolicy="no-referrer" />
        <span className={`novelinhas-selo ${n.dublada ? 'dub' : 'leg'}`}>{n.dublada ? 'DUB' : 'LEG'}</span>
        {parada && (
          <div className="novelinhas-progresso"><span style={{ width: `${Math.min(100, (parada.ep / n.episodios) * 100)}%` }} /></div>
        )}
      </div>
      <strong>{n.titulo}</strong>
      <small>{parada ? `Ep. ${parada.ep} de ${n.episodios}` : `${n.episodios} episódios`}</small>
    </button>
  );
}

/* ───────────────────────── Player vertical ───────────────────────── */

function PlayerVertical({ base, novelinha: n, aoFechar }: { base: string; novelinha: Novelinha; aoFechar: () => void }) {
  const inicio = paradaDe(n.id);
  const [ep, setEp] = useState(() => Math.min(Math.max(1, inicio?.ep ?? 1), n.episodios));
  const [pausado, setPausado] = useState(false);
  const [fracao, setFracao] = useState(0);
  const [lista, setLista] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState<'' | 'play' | 'pause'>('');
  const video = useRef<HTMLVideoElement>(null);
  const toque = useRef<{ y: number; t: number } | null>(null);
  const retomar = useRef<number>(inicio && inicio.ep === ep ? inicio.t : 0);
  const ultimaRoda = useRef(0);

  const ir = useCallback((novo: number) => {
    if (novo < 1 || novo > n.episodios) return;
    retomar.current = 0;
    setErro('');
    setFracao(0);
    setEp(novo);
  }, [n.episodios]);

  const alternar = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); setAviso('play'); } else { v.pause(); setAviso('pause'); }
    window.setTimeout(() => setAviso(''), 600);
  };

  // Troca de episódio: novo endereço, toca e guarda onde parou.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.src = urlEpisodio(base, n, ep);
    v.currentTime = retomar.current || 0;
    v.play().then(() => setPausado(false)).catch(() => setPausado(true));
    guardarParada(n.id, ep, retomar.current || 0);
  }, [base, n, ep]);

  // Tela cheia e trava em pé no celular, só ao abrir e ao fechar.
  useEffect(() => {
    const raiz = document.documentElement;
    const telaPequena = window.matchMedia('(max-width: 820px)').matches;
    if (telaPequena && raiz.requestFullscreen) {
      raiz.requestFullscreen().then(() => {
        const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
        o?.lock?.('portrait').catch(() => {});
      }).catch(() => {});
    }
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  // Esc fecha, setas trocam de episódio, espaço pausa.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar();
      else if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); ir(ep + 1); }
      else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); ir(ep - 1); }
      else if (e.key === ' ') { e.preventDefault(); alternar(); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ep]);

  const proximo = ep < n.episodios ? urlEpisodio(base, n, ep + 1) : '';

  return (
    <div
      className="novelinha-player"
      role="dialog"
      aria-label={`${n.titulo}, episódio ${ep}`}
      onTouchStart={(e) => { toque.current = { y: e.touches[0].clientY, t: Date.now() }; }}
      onTouchEnd={(e) => {
        const ini = toque.current;
        toque.current = null;
        if (!ini || lista) return;
        const dy = e.changedTouches[0].clientY - ini.y;
        if (Math.abs(dy) > 70 && Date.now() - ini.t < 700) ir(dy < 0 ? ep + 1 : ep - 1);
      }}
      onWheel={(e) => {
        if (lista || Math.abs(e.deltaY) < 30) return;
        const agora = Date.now();
        if (agora - ultimaRoda.current < 700) return;
        ultimaRoda.current = agora;
        ir(e.deltaY > 0 ? ep + 1 : ep - 1);
      }}
    >
      <div className="novelinha-palco">
        <video
          ref={video}
          className="novelinha-video"
          playsInline
          preload="auto"
          onClick={alternar}
          onPause={() => setPausado(true)}
          onPlay={() => setPausado(false)}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            setFracao(v.duration ? v.currentTime / v.duration : 0);
            if (Math.floor(v.currentTime) % 5 === 0) guardarParada(n.id, ep, v.currentTime);
          }}
          onEnded={() => { if (ep < n.episodios) ir(ep + 1); else guardarParada(n.id, ep, 0); }}
          onError={() => setErro('Não consegui tocar este episódio. Deslize para o próximo.')}
        />
        {/* O próximo episódio vai carregando enquanto este toca. */}
        {proximo && <link rel="preload" as="video" href={proximo} />}

        {aviso && <div className="novelinha-aviso-toque">{aviso === 'play' ? <IconePlay /> : <IconePause />}</div>}
        {pausado && !aviso && !erro && (
          <button className="novelinha-centro" onClick={alternar} aria-label="Continuar"><IconePlay /></button>
        )}
        {erro && <div className="novelinha-erro">{erro}</div>}

        <div className="novelinha-topo">
          <button className="novelinha-botao" onClick={aoFechar} aria-label="Fechar">
            <svg viewBox="0 0 24 24"><path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z" /></svg>
          </button>
          <div className="novelinha-titulo">
            <strong>{n.titulo}</strong>
            <span>Episódio {ep} de {n.episodios} · {n.dublada ? 'Dublado' : 'Legendado'}</span>
          </div>
        </div>

        <div className="novelinha-lado">
          <button className="novelinha-botao" onClick={() => ir(ep - 1)} disabled={ep <= 1} aria-label="Episódio anterior">
            <svg viewBox="0 0 24 24"><path d="M7.4 15.4 12 10.8l4.6 4.6L18 14l-6-6-6 6z" /></svg>
          </button>
          <button className="novelinha-botao" onClick={() => setLista(true)} aria-label="Episódios">
            <svg viewBox="0 0 24 24"><path d="M3 5h18v2H3zm0 6h18v2H3zm0 6h12v2H3z" /></svg>
            <small>{ep}/{n.episodios}</small>
          </button>
          <button className="novelinha-botao" onClick={() => ir(ep + 1)} disabled={ep >= n.episodios} aria-label="Próximo episódio">
            <svg viewBox="0 0 24 24"><path d="M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z" /></svg>
          </button>
        </div>

        <div
          className="novelinha-barra"
          onClick={(e) => {
            const v = video.current;
            if (!v || !v.duration) return;
            const r = e.currentTarget.getBoundingClientRect();
            v.currentTime = ((e.clientX - r.left) / r.width) * v.duration;
          }}
        >
          <span style={{ width: `${fracao * 100}%` }} />
        </div>

        {ep === 1 && fracao < 0.15 && n.sinopse && <p className="novelinha-sinopse">{n.sinopse}</p>}
      </div>

      {lista && (
        <div className="novelinha-episodios" onClick={() => setLista(false)}>
          <div className="novelinha-episodios-caixa" onClick={(e) => e.stopPropagation()}>
            <header>
              <strong>{n.titulo}</strong>
              <button className="novelinha-botao" onClick={() => setLista(false)} aria-label="Fechar lista">
                <svg viewBox="0 0 24 24"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4l5.6 5.6 1.4-1.4-5.6-5.6z" /></svg>
              </button>
            </header>
            <div className="novelinha-episodios-grade">
              {Array.from({ length: n.episodios }, (_, i) => i + 1).map((i) => (
                <button key={i} className={i === ep ? 'atual' : ''} onClick={() => { ir(i); setLista(false); }}>{i}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IconePlay() {
  return <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>;
}
function IconePause() {
  return <svg viewBox="0 0 24 24"><path d="M6 19h4V5H6zm8-14v14h4V5z" /></svg>;
}
