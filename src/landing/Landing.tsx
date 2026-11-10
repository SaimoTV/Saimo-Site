import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PAGINAS_LEGAIS, SITE } from './config';
import { Cabecalho, Rodape } from './Moldura';
import './landing.css';

/* ───────────────────────────── utilidades ───────────────────────────── */

/** Marca como "in" tudo que tem a classe .rv quando entra na tela (uma vez só). */
function useReveal(raiz: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const alvos = Array.from(el.querySelectorAll<HTMLElement>('.rv'));
    if (typeof IntersectionObserver === 'undefined') {
      alvos.forEach((a) => a.classList.add('in'));
      return;
    }
    const obs = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add('in');
            obs.unobserve(e.target);
          }
        }
      },
      { threshold: 0.14, rootMargin: '0px 0px -6% 0px' },
    );
    alvos.forEach((a) => obs.observe(a));
    return () => obs.disconnect();
  }, [raiz]);
}

/** Inclina o cartão na direção do cursor. */
function useTilt<T extends HTMLElement>(forca = 10) {
  const ref = useRef<T | null>(null);
  const aoMover = useCallback((e: React.PointerEvent<T>) => {
    const el = ref.current;
    if (!el || e.pointerType === 'touch') return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--rx', `${(-y * forca).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${(x * forca).toFixed(2)}deg`);
    el.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(1)}%`);
  }, [forca]);
  const aoSair = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }, []);
  return { ref, onPointerMove: aoMover, onPointerLeave: aoSair };
}

/** Número que sobe até o valor quando aparece. */
function Contador({ ate, sufixo = '', duracao = 1400 }: { ate: number; sufixo?: string; duracao?: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [valor, setValor] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const reduzido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      if (reduzido) { setValor(ate); return; }
      const t0 = performance.now();
      const passo = (t: number) => {
        const p = Math.min(1, (t - t0) / duracao);
        setValor(Math.round(ate * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(passo);
      };
      raf = requestAnimationFrame(passo);
    }, { threshold: 0.6 });
    obs.observe(el);
    return () => { obs.disconnect(); cancelAnimationFrame(raf); };
  }, [ate, duracao]);
  return <span ref={ref}>{valor}{sufixo}</span>;
}

/* ───────────────────────────── ícones ───────────────────────────── */

type IconeProps = { nome: string; tamanho?: number };
const TRACOS: Record<string, string> = {
  tv: 'M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 14.5v-8ZM8 21h8M12 17v4',
  film: 'M4 5h16v14H4zM8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4',
  series: 'M3 7h18M7 3l3 4M14 3l3 4M5 7h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z',
  anime: 'M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4L12 3ZM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9L18 15Z',
  radio: 'M4 9h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1ZM8 9l9-5M7 14h5M16.5 14.5a1.5 1.5 0 1 0 0 .01',
  bola: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5 3.2 2.3-1.2 3.7h-4l-1.2-3.7L12 8ZM12 3v5M5.5 7.5 8.8 10.3M18.5 7.5l-3.3 2.8M7.5 18l1.5-4M16.5 18 15 14',
  guia: 'M4 5h16M4 10h10M4 15h16M4 20h8M17 9l3 2-3 2V9Z',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  wifi: 'M2.5 9.5a14 14 0 0 1 19 0M5.5 12.8a9.6 9.6 0 0 1 13 0M8.6 16a5.2 5.2 0 0 1 6.8 0M12 19.5h.01',
  phone: 'M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm3 15h2',
  laptop: 'M5 6h14v9H5zM3 19h18',
  box: 'M4 9h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Zm0 0 2-4h12l2 4M8 14h.01M11 14h5',
  shield: 'M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6l7-3Zm-3 9 2.2 2.2L15.5 9.5',
  coracao: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  play: 'M8 5v14l11-7L8 5Z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  baixar: 'M12 3v12m0 0 4-4m-4 4-4-4M5 19h14',
  mais: 'M12 5v14M5 12h14',
  seta: 'M5 12h14m0 0-5-5m5 5-5 5',
  globo: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  usuario: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  controle: 'M7 8h10a4 4 0 0 1 4 4v1a3 3 0 0 1-5.2 2L14 13h-4l-1.8 2A3 3 0 0 1 3 13v-1a4 4 0 0 1 4-4Zm1 3v3m-1.5-1.5h3M16 11.5h.01M18 13h.01',
};
function Icone({ nome, tamanho = 24 }: IconeProps) {
  return (
    <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={TRACOS[nome] ?? TRACOS.tv} />
    </svg>
  );
}

/* ───────────────────────────── herói ───────────────────────────── */

/** Pôsteres só de cor e forma: nenhuma marca nem imagem de terceiros. */
const CORES_POSTER = [
  ['#7c5cff', '#2a1a78'], ['#4fe3d0', '#0a5b66'], ['#ffb454', '#8a3d12'], ['#5b8cff', '#1a2f7a'],
  ['#38d996', '#0b5c3e'], ['#c779ff', '#4a1a78'], ['#ff8a5b', '#7a2a12'], ['#4fc3ff', '#0d4a73'],
] as const;

function Poster({ i, icone }: { i: number; icone: string }) {
  const [a, b] = CORES_POSTER[i % CORES_POSTER.length];
  return (
    <span className="poster" style={{ background: `linear-gradient(155deg, ${a}, ${b})` }}>
      <Icone nome={icone} tamanho={22} />
    </span>
  );
}

const ICONES_FAIXA = ['tv', 'film', 'series', 'anime', 'bola', 'radio', 'guia', 'tv', 'film', 'anime', 'series', 'bola'];

function FaixaDeTela({ sentido = 1, atraso = 0 }: { sentido?: 1 | -1; atraso?: number }) {
  const itens = [...ICONES_FAIXA, ...ICONES_FAIXA];
  return (
    <div className="faixa" style={{ animationDirection: sentido === 1 ? 'normal' : 'reverse', animationDelay: `${atraso}s` }}>
      {itens.map((ic, i) => <Poster key={i} i={i + atraso} icone={ic} />)}
    </div>
  );
}

function Dispositivos() {
  return (
    <div className="devs" aria-hidden="true">
      <div className="dev-aura" />
      <div className="dev dev-tv">
        <div className="tv-tela">
          <div className="tv-topo"><i /><i /><i /><b>AO VIVO</b></div>
          <FaixaDeTela />
          <FaixaDeTela sentido={-1} atraso={2} />
          <FaixaDeTela atraso={4} />
          <div className="tv-progresso"><span /></div>
        </div>
        <div className="tv-pe" />
      </div>
      <div className="dev dev-lap">
        <div className="lap-tela">
          <div className="lap-barra"><i /><i /><i /></div>
          <div className="lap-grade">
            {Array.from({ length: 8 }, (_, i) => <Poster key={i} i={i + 3} icone={ICONES_FAIXA[(i * 3) % ICONES_FAIXA.length]} />)}
          </div>
        </div>
        <div className="lap-base" />
      </div>
      <div className="dev dev-cel">
        <div className="cel-tela">
          <div className="cel-entalhe" />
          <FaixaDeTela atraso={1} />
          <FaixaDeTela sentido={-1} atraso={3} />
          <div className="cel-play"><Icone nome="play" tamanho={16} /></div>
        </div>
      </div>
      <span className="chip-flut f1"><Icone nome="tv" tamanho={14} /> Ao vivo</span>
      <span className="chip-flut f2"><Icone nome="film" tamanho={14} /> Filmes</span>
      <span className="chip-flut f3"><Icone nome="series" tamanho={14} /> Séries</span>
      <span className="chip-flut f4"><Icone nome="anime" tamanho={14} /> Animes</span>
      <span className="chip-flut f5"><Icone nome="radio" tamanho={14} /> Rádios</span>
      <span className="chip-flut f6"><Icone nome="bola" tamanho={14} /> Jogos</span>
    </div>
  );
}

function Heroi() {
  const raiz = useRef<HTMLElement | null>(null);
  const aoMover = (e: React.PointerEvent<HTMLElement>) => {
    const el = raiz.current;
    if (!el || e.pointerType === 'touch') return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    el.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    el.style.setProperty('--cx', `${e.clientX - r.left}px`);
    el.style.setProperty('--cy', `${e.clientY - r.top}px`);
  };
  return (
    <section className="lp-heroi" id="topo" ref={raiz} onPointerMove={aoMover}>
      <div className="heroi-luz" aria-hidden="true" />
      <div className="heroi-grade" aria-hidden="true" />
      <div className="heroi-conteudo">
        <div className="heroi-texto">
          <span className="eyebrow rv"><i /> Ecossistema de streaming pessoal</span>
          <h1 className="rv d1">
            Sua lista.<br />
            <span className="grad">Suas telas.</span><br />
            Um só lugar.
          </h1>
          <p className="rv d2">
            O Saimo é um <strong>player</strong>, não um catálogo. Você traz a sua lista de IPTV
            (M3U, usuário e senha) e a gente cuida do resto: ao vivo, filmes, séries, animes, rádios, jogos e guia,
            na TV, no celular e no computador.
          </p>
          <div className="heroi-botoes rv d3">
            <a className="botao botao-principal" href="#baixar"><Icone nome="baixar" tamanho={18} /> Baixar grátis</a>
            <a className="botao botao-vidro" href="#como"><Icone nome="play" tamanho={16} /> Ver como funciona</a>
          </div>
          <ul className="selos rv d4">
            <li><Icone nome="check" tamanho={15} /> Sem anúncios</li>
            <li><Icone nome="check" tamanho={15} /> Sem cadastro</li>
            <li><Icone nome="check" tamanho={15} /> Dados só no seu aparelho</li>
            <li><Icone nome="check" tamanho={15} /> Não hospeda conteúdo</li>
          </ul>
        </div>
        <div className="heroi-visual rv d2">
          <Dispositivos />
        </div>
      </div>
      <a className="rolar" href="#sobre" aria-label="Rolar para saber mais"><span /></a>
    </section>
  );
}

/* ───────────────────────────── faixa de palavras ───────────────────────────── */

const PALAVRAS = ['Ao vivo', 'Filmes', 'Séries', 'Animes', 'Doramas', 'Rádios', 'Jogos do dia', 'Guia de programação', 'Favoritos', 'Continue assistindo', 'Controle parental', 'Saimo Connect'];

function Faixa() {
  const itens = [...PALAVRAS, ...PALAVRAS];
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-trilho">
        {itens.map((p, i) => <span key={i}>{p}<i /></span>)}
      </div>
    </div>
  );
}

/* ───────────────────────────── manifesto ───────────────────────────── */

function Pilar({ icone, titulo, texto, n }: { icone: string; titulo: string; texto: string; n: number }) {
  const tilt = useTilt<HTMLDivElement>(8);
  return (
    <div className={`pilar tilt rv d${n}`} ref={tilt.ref} onPointerMove={tilt.onPointerMove} onPointerLeave={tilt.onPointerLeave}>
      <div className="pilar-icone"><Icone nome={icone} tamanho={28} /></div>
      <h3>{titulo}</h3>
      <p>{texto}</p>
    </div>
  );
}

function Manifesto() {
  return (
    <section className="secao manifesto" id="sobre">
      <div className="miolo">
        <span className="eyebrow rv"><i /> O que é o Saimo</span>
        <h2 className="titulo-grande rv d1">
          Um <span className="grad">ecossistema</span> para você assistir
          o que é seu, do seu jeito.
        </h2>
        <p className="lead rv d2">
          Muita gente já tem acesso a canais, filmes e séries por assinaturas, provedores ou listas próprias, e acaba
          espalhada em um monte de aplicativos diferentes, cada um com um jeito de usar. O Saimo reúne tudo numa
          experiência só, bonita e igual em todas as telas. <strong>Nós não vendemos, não hospedamos e não distribuímos
          nenhum conteúdo.</strong> O aplicativo vem vazio: quem coloca a lista é você.
        </p>
        <div className="pilares">
          <Pilar n={1} icone="link" titulo="Você traz a sua lista" texto="Cole o link de uma lista M3U ou entre com servidor, usuário e senha, se o seu provedor pedir. Só isso." />
          <Pilar n={2} icone="shield" titulo="A gente não hospeda nada" texto="O Saimo é só o player. Nenhum canal, filme ou série vem com o aplicativo, e nada passa pelos nossos servidores." />
          <Pilar n={3} icone="lock" titulo="Seus dados são seus" texto="Sem conta, sem anúncios, sem rastreio. Favoritos, progresso e listas ficam guardados no seu aparelho." />
          <Pilar n={4} icone="usuario" titulo="Responsabilidade é de quem usa" texto="Use o Saimo com conteúdo que você tem direito de assistir. Respeitamos os direitos autorais e esperamos o mesmo de você." />
        </div>
        <div className="numeros rv">
          <div><strong><Contador ate={7} /></strong><span>plataformas</span></div>
          <div><strong><Contador ate={0} /></strong><span>anúncios</span></div>
          <div><strong><Contador ate={0} /></strong><span>contas obrigatórias</span></div>
          <div><strong><Contador ate={100} sufixo="%" /></strong><span>dados no seu aparelho</span></div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── demonstração interativa ───────────────────────────── */

const LINK_DEMO = 'https://minha-lista.exemplo/lista.m3u';
const CANAIS_DEMO = [
  ['Notícias 24h', 'guia'], ['Cinema Clássico', 'film'], ['Séries do Dia', 'series'], ['Anime Mix', 'anime'],
  ['Esportes Ao Vivo', 'bola'], ['Rádio Jazz', 'radio'], ['Documentários', 'globo'], ['Infantil', 'heart'],
] as const;

function Demo() {
  const [passo, setPasso] = useState(0); // 0 vazio, 1 digitando, 2 baixando, 3 pronto, 4 assistindo
  const [digitado, setDigitado] = useState('');
  const [escolhido, setEscolhido] = useState(0);
  const [automatico, setAutomatico] = useState(true);
  const raiz = useRef<HTMLDivElement | null>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setVisivel(e.isIntersecting), { threshold: 0.35 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Digita o link letra por letra.
  useEffect(() => {
    if (passo !== 1) return;
    let i = 0;
    const t = window.setInterval(() => {
      i += 1;
      setDigitado(LINK_DEMO.slice(0, i));
      if (i >= LINK_DEMO.length) { window.clearInterval(t); window.setTimeout(() => setPasso(2), 450); }
    }, 38);
    return () => window.clearInterval(t);
  }, [passo]);

  useEffect(() => {
    if (passo !== 2) return;
    const t = window.setTimeout(() => setPasso(3), 1500);
    return () => window.clearTimeout(t);
  }, [passo]);

  // Sozinha, a demonstração anda: adiciona, mostra os canais e "assiste".
  useEffect(() => {
    if (!automatico || !visivel) return;
    const espera = passo === 0 ? 1400 : passo === 3 ? 2600 : passo === 4 ? 4200 : 0;
    if (!espera) return;
    const t = window.setTimeout(() => {
      if (passo === 0) { setDigitado(''); setPasso(1); }
      else if (passo === 3) { setEscolhido(Math.floor(Math.random() * CANAIS_DEMO.length)); setPasso(4); }
      else if (passo === 4) { setPasso(0); setDigitado(''); }
    }, espera);
    return () => window.clearTimeout(t);
  }, [passo, automatico, visivel]);

  const comecar = () => { setAutomatico(false); setDigitado(''); setPasso(1); };
  const assistir = (i: number) => { setAutomatico(false); setEscolhido(i); setPasso(4); };

  const etapas = ['Adicione sua lista', 'O Saimo organiza tudo', 'Escolha e assista'];
  const etapaAtiva = passo <= 1 ? 0 : passo <= 3 ? 1 : 2;

  return (
    <section className="secao demo" id="como">
      <div className="miolo">
        <span className="eyebrow rv"><i /> Como funciona</span>
        <h2 className="titulo-grande rv d1">Três passos. <span className="grad">Nenhum cadastro.</span></h2>
        <div className="demo-grade">
          <ol className="demo-passos rv d2">
            {etapas.map((e, i) => (
              <li key={e} className={i === etapaAtiva ? 'ativo' : i < etapaAtiva ? 'feito' : ''}>
                <span className="n">{i < etapaAtiva ? <Icone nome="check" tamanho={16} /> : i + 1}</span>
                <div>
                  <strong>{e}</strong>
                  <p>{[
                    'Cole o link da sua lista M3U. Se o seu provedor usa usuário e senha, é só preencher também.',
                    'Canais, filmes, séries e rádios aparecem separados em seções, com capa, busca e favoritos.',
                    'Toque ou aperte OK. O vídeo abre na hora, com guia, legenda e áudio à sua escolha.',
                  ][i]}</p>
                </div>
              </li>
            ))}
            <li className="demo-dica"><Icone nome="play" tamanho={14} /> Clique na tela ao lado: a demonstração é interativa.</li>
          </ol>

          <div className="janela rv d3" ref={raiz}>
            <div className="janela-barra"><i /><i /><i /><span>Saimo</span></div>
            <div className="janela-corpo">
              {passo === 0 && (
                <div className="demo-vazio">
                  <div className="demo-vazio-ic"><Icone nome="tv" tamanho={34} /></div>
                  <h4>Bem-vindo ao Saimo!</h4>
                  <p>Para começar, adicione uma lista M3U (só o link já basta) ou uma lista com usuário e senha.</p>
                  <button type="button" className="botao botao-principal" onClick={comecar}><Icone nome="mais" tamanho={16} /> Adicionar lista</button>
                </div>
              )}
              {(passo === 1 || passo === 2) && (
                <div className="demo-form">
                  <label>Link da lista (M3U) ou servidor</label>
                  <div className="campo"><span>{digitado}</span><i className="cursor" /></div>
                  <div className="demo-campos-opc">
                    <div><label>Usuário <em>opcional</em></label><div className="campo campo-vazio" /></div>
                    <div><label>Senha <em>opcional</em></label><div className="campo campo-vazio" /></div>
                  </div>
                  <p className="demo-nota">Só o link já basta. Usuário e senha são opcionais, para listas que pedem login.</p>
                  <div className={`demo-carga ${passo === 2 ? 'ligada' : ''}`}><span /></div>
                  <div className="demo-estado">{passo === 2 ? 'Lendo a lista…' : 'Digitando…'}</div>
                </div>
              )}
              {passo === 3 && (
                <div className="demo-canais">
                  <div className="demo-cab"><b>Minhas listas</b><span>{CANAIS_DEMO.length} canais</span></div>
                  <div className="demo-tiles">
                    {CANAIS_DEMO.map(([nome, ic], i) => (
                      <button type="button" key={nome} className="tile" style={{ animationDelay: `${i * 70}ms` }} onClick={() => assistir(i)}>
                        <Poster i={i} icone={ic} />
                        <span>{nome}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {passo === 4 && (
                <div className="demo-player" onClick={() => { setAutomatico(false); setPasso(3); }} role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setAutomatico(false); setPasso(3); } }}>
                  <div className="player-fundo" style={{ background: `linear-gradient(140deg, ${CORES_POSTER[escolhido % 8][0]}, ${CORES_POSTER[escolhido % 8][1]})` }} />
                  <div className="player-ondas"><i /><i /><i /><i /><i /><i /><i /></div>
                  <div className="player-info">
                    <span className="ao-vivo"><i /> AO VIVO</span>
                    <strong>{CANAIS_DEMO[escolhido][0]}</strong>
                    <small>Agora · Programa de demonstração</small>
                  </div>
                  <div className="player-barra"><span /></div>
                  <span className="player-voltar">Toque para voltar à lista</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── recursos ───────────────────────────── */

type Cena = 'tv' | 'film' | 'series' | 'anime' | 'radio' | 'bola' | 'guia' | 'controle';
interface Recurso { id: Cena; icone: string; titulo: string; chamada: string; texto: string; itens: string[] }

const RECURSOS: Recurso[] = [
  { id: 'tv', icone: 'tv', titulo: 'Ao vivo', chamada: 'A TV que abre num toque.', texto: 'Troque de canal sem espera, com troca automática de fonte se uma cair, número de canal, busca e favoritos.', itens: ['Troca rápida de canal', 'Fonte reserva automática', 'Canais favoritos e recentes'] },
  { id: 'film', icone: 'film', titulo: 'Filmes', chamada: 'Sua videoteca, organizada.', texto: 'Capas, sinopse, elenco e nota, com filtros por gênero, ano, classificação e ordem. Continue de onde parou, em qualquer aparelho.', itens: ['Filtros como nos grandes', 'Continue assistindo', 'Legendas e áudio'] },
  { id: 'series', icone: 'series', titulo: 'Séries', chamada: 'Temporada por temporada.', texto: 'Episódios em lista, próximo episódio automático e pular abertura. A série lembra onde você parou.', itens: ['Próximo episódio automático', 'Pular abertura', 'Marca os já vistos'] },
  { id: 'anime', icone: 'anime', titulo: 'Animes e doramas', chamada: 'Do shonen ao dorama.', texto: 'Seções próprias para animes e doramas, com busca e coleções, dublado ou legendado.', itens: ['Dublado ou legendado', 'Coleções', 'Busca instantânea'] },
  { id: 'radio', icone: 'radio', titulo: 'Rádios', chamada: 'Música com a tela apagada.', texto: 'Ouça rádios com o app em segundo plano, com timer de sono e controles na tela de bloqueio.', itens: ['Segundo plano', 'Timer de sono', 'Controles na notificação'] },
  { id: 'bola', icone: 'bola', titulo: 'Jogos do dia', chamada: 'Placar e canal, juntos.', texto: 'A agenda esportiva mostra o que está rolando agora e em que canal da sua lista passa. Um toque e você está lá.', itens: ['Placar ao vivo', 'Liga o jogo ao seu canal', 'Agenda de hoje e amanhã'] },
  { id: 'guia', icone: 'guia', titulo: 'Guia de programação', chamada: 'O que passa agora e depois.', texto: 'Grade de programação por canal, com barra de progresso do que está no ar e o que vem a seguir.', itens: ['Agora e a seguir', 'Barra de progresso', 'Lembretes'] },
  { id: 'controle', icone: 'lock', titulo: 'Controle parental', chamada: 'Casa em paz.', texto: 'Seções restritas ficam atrás de um código só seu. Crianças usam sem esbarrar no que não devem.', itens: ['Código de acesso', 'Seção protegida', 'Tudo local'] },
];

function Cenario({ id }: { id: Cena }) {
  const base = (
    <>
      <div className="cena-halo" />
    </>
  );
  switch (id) {
    case 'tv':
      return <div className="cena cena-tv">{base}<div className="zap">{[0, 1, 2, 3, 4].map((i) => <Poster key={i} i={i} icone={ICONES_FAIXA[i * 2]} />)}</div><div className="ao-vivo grande"><i /> AO VIVO</div></div>;
    case 'film':
      return <div className="cena cena-film">{base}<div className="rolo"><i /><i /><i /><i /><i /><i /></div><div className="claquete"><span /><b>CENA 1</b></div></div>;
    case 'series':
      return <div className="cena cena-series">{base}{[1, 2, 3, 4].map((n) => <div className="ep" key={n} style={{ animationDelay: `${n * 0.18}s` }}><Poster i={n + 2} icone="series" /><div><strong>Episódio {n}</strong><span /></div><em>{n === 1 ? 'Visto' : n === 2 ? '62%' : ''}</em></div>)}</div>;
    case 'anime':
      return <div className="cena cena-anime">{base}{Array.from({ length: 14 }, (_, i) => <span key={i} className="estrela" style={{ left: `${(i * 37) % 92}%`, top: `${(i * 53) % 84}%`, animationDelay: `${(i % 7) * 0.3}s` }} />)}<div className="selo-grande"><Icone nome="anime" tamanho={56} /></div></div>;
    case 'radio':
      return <div className="cena cena-radio">{base}<div className="ondas">{Array.from({ length: 22 }, (_, i) => <i key={i} style={{ animationDelay: `${(i % 11) * 0.09}s` }} />)}</div><div className="disco"><Icone nome="radio" tamanho={34} /></div></div>;
    case 'bola':
      return <div className="cena cena-bola">{base}<div className="placar"><span>TIME A</span><b>2</b><i>x</i><b>1</b><span>TIME B</span></div><div className="relogio">67'</div><div className="bola-rola"><Icone nome="bola" tamanho={40} /></div></div>;
    case 'guia':
      return <div className="cena cena-guia">{base}{[0, 1, 2, 3].map((r) => <div className="linha-guia" key={r}><b>{101 + r}</b><div>{[0, 1, 2].map((c) => <span key={c} style={{ width: `${30 + ((r * 3 + c) * 17) % 40}%`, animationDelay: `${(r + c) * 0.12}s` }} className={r === 1 && c === 0 ? 'agora' : ''} />)}</div></div>)}</div>;
    default:
      return <div className="cena cena-lock">{base}<div className="cadeado"><Icone nome="lock" tamanho={54} /></div><div className="pin">{[0, 1, 2, 3].map((i) => <i key={i} style={{ animationDelay: `${i * 0.35}s` }} />)}</div></div>;
  }
}

function Recursos() {
  const [ativo, setAtivo] = useState<Cena>('tv');
  const atual = RECURSOS.find((r) => r.id === ativo)!;
  return (
    <section className="secao recursos" id="recursos">
      <div className="miolo">
        <span className="eyebrow rv"><i /> Recursos</span>
        <h2 className="titulo-grande rv d1">Tudo o que você <span className="grad">espera</span>,<br />e um pouco mais.</h2>
        <div className="recursos-grade rv d2">
          <div className="recursos-abas" role="tablist" aria-label="Recursos do Saimo">
            {RECURSOS.map((r) => (
              <button key={r.id} role="tab" aria-selected={ativo === r.id} className={ativo === r.id ? 'ativa' : ''}
                onClick={() => setAtivo(r.id)} onPointerEnter={(e) => { if (e.pointerType === 'mouse') setAtivo(r.id); }}>
                <Icone nome={r.icone} tamanho={20} /><span>{r.titulo}</span>
              </button>
            ))}
          </div>
          <div className="recursos-painel" role="tabpanel" key={ativo}>
            <div className="recursos-texto">
              <h3>{atual.chamada}</h3>
              <p>{atual.texto}</p>
              <ul>{atual.itens.map((i) => <li key={i}><Icone nome="check" tamanho={16} /> {i}</li>)}</ul>
            </div>
            <Cenario id={atual.id} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── aparelhos ───────────────────────────── */

interface Aparelho { id: string; nome: string; icone: string; detalhe: string; estado: 'disponivel' | 'embreve'; para: string }
const APARELHOS: Aparelho[] = [
  { id: 'tvbox', nome: 'TV Box e Android TV', icone: 'box', detalhe: 'Android TV, Fire TV Stick, Mi Box, Chromecast com Google TV e TV Box Android. Feito para o controle remoto.', estado: 'disponivel', para: '/app' },
  { id: 'samsung', nome: 'Samsung e LG', icone: 'tv', detalhe: 'Smart TVs Samsung (Tizen) e LG (webOS), com navegação pelo controle e a mesma tela inicial.', estado: 'disponivel', para: '/app' },
  { id: 'roku', nome: 'Roku', icone: 'tv', detalhe: 'Canal nativo para TVs e aparelhos Roku, leve e com suporte total ao controle.', estado: 'disponivel', para: '/app' },
  { id: 'cell', nome: 'Android (celular e tablet)', icone: 'phone', detalhe: 'No bolso: ao vivo, filmes, séries, downloads para assistir offline e controle remoto da TV.', estado: 'disponivel', para: '/app' },
  { id: 'mac', nome: 'Mac', icone: 'laptop', detalhe: 'App nativo para Mac com chip Apple, com tela cheia, picture-in-picture e atalhos de teclado.', estado: 'disponivel', para: '/app' },
  { id: 'win', nome: 'Windows', icone: 'laptop', detalhe: 'App de verdade para Windows 10 e 11, não é o site numa janela: o vídeo roda no próprio PC.', estado: 'disponivel', para: '/app' },
  { id: 'ios', nome: 'iPhone e iPad', icone: 'phone', detalhe: 'O aplicativo para iPhone e iPad está a caminho da App Store.', estado: 'embreve', para: '/app' },
  { id: 'web', nome: 'Navegador', icone: 'globo', detalhe: 'Sem instalar nada: abra o Saimo no navegador do computador, do celular ou da TV.', estado: 'disponivel', para: '/' },
];

function Aparelhos() {
  const [i, setI] = useState(0);
  const a = APARELHOS[i];
  const navegar = useNavigate();
  const abrirWeb = () => { try { localStorage.setItem('saimo-entrou', '1'); } catch { /* sem armazenamento */ } navegar('/'); };
  return (
    <section className="secao aparelhos" id="aparelhos">
      <div className="miolo">
        <span className="eyebrow rv"><i /> Em todas as telas</span>
        <h2 className="titulo-grande rv d1">Comece na TV.<br /><span className="grad">Continue no celular.</span></h2>
        <div className="aparelhos-grade rv d2">
          <div className="aparelhos-lista">
            {APARELHOS.map((x, n) => (
              <button key={x.id} type="button" className={n === i ? 'ativo' : ''} onClick={() => setI(n)} onPointerEnter={(e) => { if (e.pointerType === 'mouse') setI(n); }}>
                <Icone nome={x.icone} tamanho={22} />
                <span>{x.nome}</span>
                {x.estado === 'embreve' && <em>em breve</em>}
              </button>
            ))}
          </div>
          <div className="aparelhos-cartao" key={a.id}>
            <div className={`aparelho-arte arte-${a.id}`}>
              <div className="arte-tela"><FaixaDeTela atraso={n(i)} /><FaixaDeTela sentido={-1} atraso={n(i) + 2} /></div>
              {a.estado === 'embreve' && <span className="arte-embreve"><i /> Em breve</span>}
            </div>
            <h3>{a.nome}</h3>
            <p>{a.detalhe}</p>
            {a.id === 'web'
              ? <button type="button" className="botao botao-principal" onClick={abrirWeb}>Abrir no navegador <Icone nome="seta" tamanho={16} /></button>
              : a.estado === 'embreve'
                ? <Link className="botao botao-vidro" to="/app">Saiba mais</Link>
                : <Link className="botao botao-principal" to="/app">Baixar <Icone nome="seta" tamanho={16} /></Link>}
          </div>
        </div>
      </div>
    </section>
  );
}
const n = (i: number) => i % 4;

/* ───────────────────────────── Saimo Connect ───────────────────────────── */

const TILES_CONNECT = [
  ['Ao vivo', 'tv'], ['Filmes', 'film'], ['Séries', 'series'], ['Animes', 'anime'], ['Rádios', 'radio'], ['Jogos', 'bola'],
] as const;

function Connect() {
  const [foco, setFoco] = useState(0);
  const [tocando, setTocando] = useState<number | null>(null);
  const [texto, setTexto] = useState('');
  const [pareado, setPareado] = useState(false);
  const mover = (dx: number, dy: number) => {
    setTocando(null);
    setFoco((f) => {
      const col = f % 3, lin = Math.floor(f / 3);
      const c = Math.min(2, Math.max(0, col + dx)), l = Math.min(1, Math.max(0, lin + dy));
      return l * 3 + c;
    });
  };
  // Pareia sozinho quando a seção aparece.
  const raiz = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { window.setTimeout(() => setPareado(true), 900); obs.disconnect(); }
    }, { threshold: 0.35 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className={`secao connect ${pareado ? 'pareado' : ''}`} id="connect" ref={raiz}>
      <div className="miolo">
        <span className="eyebrow rv"><i /> Saimo Connect</span>
        <h2 className="titulo-grande rv d1">Seu celular vira o <span className="grad">controle remoto.</span></h2>
        <p className="lead rv d2">
          O Saimo Connect liga os seus aparelhos pela própria rede da sua casa. Sem conta, sem nuvem e sem servidor nosso no meio.
          Use o celular para navegar na TV, digitar links sem sofrer com o controle e levar o que você assistia de um aparelho para outro.
        </p>
        <div className="connect-cena rv d3">
          <div className="connect-tv">
            <div className="ctv-tela">
              <div className="ctv-topo"><b>Saimo</b><div className="ctv-busca"><Icone nome="globo" tamanho={13} /> <span>{texto || 'Buscar…'}</span></div></div>
              {tocando === null ? (
                <div className="ctv-grade">
                  {TILES_CONNECT.map(([nome, ic], i) => (
                    <div key={nome} className={`ctv-tile ${foco === i ? 'foco' : ''}`}>
                      <Poster i={i} icone={ic} /><span>{nome}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="ctv-play">
                  <div className="player-fundo" style={{ background: `linear-gradient(140deg, ${CORES_POSTER[tocando % 8][0]}, ${CORES_POSTER[tocando % 8][1]})` }} />
                  <div className="player-ondas"><i /><i /><i /><i /><i /><i /><i /></div>
                  <span className="ao-vivo"><i /> {TILES_CONNECT[tocando][0]}</span>
                </div>
              )}
            </div>
            <div className="ctv-pe" />
          </div>

          <div className="connect-ondas" aria-hidden="true">
            <span /><span /><span />
            <div className="selo-pareado"><Icone nome="wifi" tamanho={18} /> {pareado ? 'Conectado' : 'Procurando…'}</div>
          </div>

          <div className="connect-cel">
            <div className="ccel-tela">
              <div className="ccel-entalhe" />
              <div className="ccel-status"><i /> {pareado ? 'TV da sala' : 'Procurando TV…'}</div>
              <div className="dpad" aria-label="Controle remoto de demonstração">
                <button type="button" className="d-cima" onClick={() => mover(0, -1)} aria-label="Cima">▲</button>
                <button type="button" className="d-esq" onClick={() => mover(-1, 0)} aria-label="Esquerda">◀</button>
                <button type="button" className="d-ok" onClick={() => setTocando(foco)} aria-label="OK">OK</button>
                <button type="button" className="d-dir" onClick={() => mover(1, 0)} aria-label="Direita">▶</button>
                <button type="button" className="d-baixo" onClick={() => mover(0, 1)} aria-label="Baixo">▼</button>
              </div>
              <input className="ccel-campo" value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 22))} placeholder="Digite aqui e veja na TV" aria-label="Digite aqui e veja na TV" />
            </div>
          </div>
        </div>
        <ul className="connect-lista rv">
          <li><Icone nome="controle" tamanho={20} /><div><strong>Controle remoto</strong><span>Setas, OK, voltar e volume, direto do celular.</span></div></li>
          <li><Icone nome="link" tamanho={20} /><div><strong>Digite no celular</strong><span>Mande links de lista e buscas sem teclado de TV.</span></div></li>
          <li><Icone nome="heart" tamanho={20} /><div><strong>Tudo sincronizado</strong><span>Favoritos, progresso e listas entre os seus aparelhos.</span></div></li>
          <li><Icone nome="wifi" tamanho={20} /><div><strong>Só na sua rede</strong><span>Funciona dentro de casa. Nada sai para a internet.</span></div></li>
        </ul>
      </div>
    </section>
  );
}

/* ───────────────────────────── privacidade ───────────────────────────── */

function Privacidade() {
  return (
    <section className="secao privacidade" id="privacidade">
      <div className="miolo estreito">
        <div className="cadeado-flutua rv"><Icone nome="shield" tamanho={44} /></div>
        <h2 className="titulo-grande rv d1">Seus dados ficam <span className="grad">com você.</span></h2>
        <p className="lead rv d2">
          O Saimo não pede conta, não mostra anúncios e não usa ferramentas de rastreio. Seus favoritos, o ponto em que você parou,
          o código parental e as listas que você adicionou ficam guardados no seu aparelho, e só nele.
        </p>
        <div className="cartoes-priv">
          <div className="rv d1"><b>0</b><span>contas e cadastros</span></div>
          <div className="rv d2"><b>0</b><span>anúncios e rastreadores</span></div>
          <div className="rv d3"><b>100%</b><span>dos dados no seu aparelho</span></div>
        </div>
        <div className="rv">
          <Link className="botao botao-vidro" to="/privacidade">Ler a Política de Privacidade <Icone nome="seta" tamanho={16} /></Link>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── baixar ───────────────────────────── */

function Baixar() {
  const itens = useMemo(() => [
    { nome: 'TV Box', ic: 'box' }, { nome: 'Samsung', ic: 'tv' }, { nome: 'LG', ic: 'tv' }, { nome: 'Roku', ic: 'tv' },
    { nome: 'Android', ic: 'phone' }, { nome: 'Mac', ic: 'laptop' }, { nome: 'Windows', ic: 'laptop' },
  ], []);
  return (
    <section className="secao baixar" id="baixar">
      <div className="miolo">
        <span className="eyebrow rv"><i /> Baixar</span>
        <h2 className="titulo-grande rv d1">Escolha a sua tela.<br /><span className="grad">É grátis.</span></h2>
        <div className="baixar-grade">
          {itens.map((x, k) => (
            <Link to="/app" key={x.nome} className={`baixar-cartao rv d${(k % 4) + 1}`}>
              <Icone nome={x.ic} tamanho={30} />
              <strong>{x.nome}</strong>
              <span>Baixar <Icone nome="seta" tamanho={14} /></span>
            </Link>
          ))}
          <div className="baixar-cartao embreve rv d4" aria-label="iPhone e iPad, em breve">
            <Icone nome="phone" tamanho={30} />
            <strong>iPhone e iPad</strong>
            <span className="embreve-selo"><i /> Em breve</span>
          </div>
        </div>
        <p className="baixar-nota rv">
          O Saimo é grátis e vem sem nenhum conteúdo. Para assistir, você adiciona a sua própria lista.
          Quer ajudar a manter o projeto no ar? Veja a página de <Link to="/app">apoio e downloads</Link>.
        </p>
      </div>
    </section>
  );
}

/* ───────────────────────────── perguntas ───────────────────────────── */

const PERGUNTAS: [string, string][] = [
  ['O Saimo tem canais, filmes ou séries?', 'Não. O Saimo é um reprodutor: ele não traz, não hospeda e não distribui nenhum conteúdo. Você adiciona a sua própria lista (M3U ou usuário e senha) e o app a organiza e reproduz.'],
  ['Isso é pirataria?', 'Não. O Saimo é uma ferramenta, como um reprodutor de mídia. O que você assiste depende da lista que você mesmo coloca, e usar conteúdo sem ter direito a ele é de responsabilidade de quem usa, e contra os nossos Termos de Uso.'],
  ['Preciso criar conta?', 'Não. Não existe cadastro, login nem e-mail. Abrir e usar.'],
  ['O que é uma lista M3U ou "usuário e senha"?', 'M3U é um arquivo (ou link) com a relação de canais ou vídeos que você tem direito a assistir. Alguns provedores entregam servidor, usuário e senha (formato Xtream) em vez de um link. O Saimo aceita os dois, e só pede usuário e senha se a sua lista exigir.'],
  ['Meus dados vão para algum servidor?', 'Seus favoritos, progresso e listas ficam no seu aparelho. Para tocar um vídeo, o app se conecta ao servidor da sua própria lista. Detalhes completos na Política de Privacidade.'],
  ['O que é o Saimo Connect?', 'É a ponte entre os seus aparelhos dentro da sua rede doméstica: o celular vira controle remoto da TV, digita links por você e sincroniza favoritos e progresso. Não usa nuvem.'],
  ['Tem app para iPhone?', 'Está a caminho da App Store. Enquanto isso, o Saimo funciona no navegador do iPhone: no Safari, toque em Compartilhar › Adicionar à Tela de Início.'],
  ['É grátis?', 'Sim, sem anúncios. O projeto é mantido por apoio voluntário de quem quer ajudar, e isso nunca é obrigatório.'],
];

function Perguntas() {
  const [aberta, setAberta] = useState<number | null>(0);
  return (
    <section className="secao perguntas" id="perguntas">
      <div className="miolo estreito">
        <span className="eyebrow rv"><i /> Perguntas frequentes</span>
        <h2 className="titulo-grande rv d1">Ficou com <span className="grad">dúvida?</span></h2>
        <div className="faq">
          {PERGUNTAS.map(([q, r], i) => (
            // O .rv fica num invólucro fixo: se a classe dele mudasse com o clique, o React
            // apagaria o "in" posto pelo observador e o item sumiria.
            <div key={q} className="rv">
              <div className={`faq-item ${aberta === i ? 'aberta' : ''}`}>
                <button type="button" aria-expanded={aberta === i} onClick={() => setAberta(aberta === i ? null : i)}>
                  <span>{q}</span><i aria-hidden="true" />
                </button>
                <div className="faq-resp"><p>{r}</p></div>
              </div>
            </div>
          ))}
        </div>
        <p className="baixar-nota rv">Mais respostas em <Link to="/suporte">Suporte</Link>.</p>
      </div>
    </section>
  );
}

/* ───────────────────────────── página ───────────────────────────── */

export function Landing() {
  const raiz = useRef<HTMLDivElement | null>(null);
  useReveal(raiz);
  useEffect(() => {
    document.title = `${SITE.nomeCompleto} — seu IPTV, suas telas, um só lugar`;
    const meta = document.querySelector('meta[name="description"]');
    const anterior = meta?.getAttribute('content') ?? null;
    meta?.setAttribute('content', 'O Saimo TV é um player e ecossistema para a sua lista de IPTV (M3U ou usuário e senha): ao vivo, filmes, séries, animes, rádios, jogos e guia em TV, celular e computador. Sem anúncios, sem cadastro e sem conteúdo embutido.');
    return () => { if (anterior !== null) meta?.setAttribute('content', anterior); };
  }, []);
  return (
    <div className="landing" ref={raiz}>
      <Cabecalho ancoras />
      <main>
        <Heroi />
        <Faixa />
        <Manifesto />
        <Demo />
        <Recursos />
        <Aparelhos />
        <Connect />
        <Privacidade />
        <Baixar />
        <Perguntas />
      </main>
      <Rodape />
      <span hidden>{PAGINAS_LEGAIS.length}</span>
    </div>
  );
}

export default Landing;
