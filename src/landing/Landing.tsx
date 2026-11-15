import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PAGINAS_LEGAIS, SITE } from './config';
import { Cabecalho, Rodape } from './Moldura';
import './landing.css';
import { CelularDoApp, TelaDoApp } from './TelaDoApp';

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
  fone: 'M4 14v-2a8 8 0 0 1 16 0v2M4 14a2 2 0 0 1 2-2h1v7H6a2 2 0 0 1-2-2v-3Zm16 0a2 2 0 0 0-2-2h-1v7h1a2 2 0 0 0 2-2v-3Z',
  multi: 'M3 5.5A1.5 1.5 0 0 1 4.5 4h15A1.5 1.5 0 0 1 21 5.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-11ZM12 4v14M9 21h6',
  legenda: 'M3 5h18v14H3zM7 13h4M13 13h4M7 16h7',
  pular: 'M5 6l7 6-7 6V6ZM13 6l7 6-7 6V6Z',
  pip: 'M3 5h18v14H3zM12 11h7v6h-7z',
  voz: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v3',
  oculos: 'M3 9h18v6a2 2 0 0 1-2 2h-4l-3-3-3 3H5a2 2 0 0 1-2-2V9ZM7.5 12.5h.01M16.5 12.5h.01',
  cast: 'M3 8V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-6M3 12a7 7 0 0 1 7 7M3 15.5a3.5 3.5 0 0 1 3.5 3.5M3 19h.01',
  peca: 'M10 4a2 2 0 1 1 4 0v2h4v4h-2a2 2 0 1 0 0 4h2v4h-4v-2a2 2 0 1 0-4 0v2H6v-4h2a2 2 0 1 0 0-4H6V6h4V4Z',
  raio: 'M13 3 5 13h6l-1 8 8-10h-6l1-8Z',
  eq: 'M6 20V10M12 20V4M18 20v-7',
  relogio: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2',
  busca: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4',
  sync: 'M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4',
  volume: 'M4 10v4h4l5 4V6L8 10H4Zm12-1a4 4 0 0 1 0 6m2.5-8.5a7.5 7.5 0 0 1 0 11',
  mudo: 'M4 10v4h4l5 4V6L8 10H4Zm12 0 5 5m0-5-5 5',
  lista: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  brilho: 'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
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
    <div className="devs">
      <div className="dev-aura" aria-hidden="true" />
      <div className="dev dev-tv"><TelaDoApp /></div>
      <div className="dev dev-cel" aria-hidden="true"><CelularDoApp /></div>
      <span className="dev-nota">Lista de demonstração · o Saimo vem vazio</span>
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
            (M3U, usuário e senha) e ele vira uma TV completa: ao vivo com guia, <strong>dois canais na mesma tela</strong>,
            o <strong>som da TV no fone do celular</strong>, filmes e séries com pular abertura e legendas, rádios e os
            jogos do dia, em 10 tipos de tela.
          </p>
          <div className="heroi-botoes rv d3">
            <a className="botao botao-principal" href="#baixar"><Icone nome="baixar" tamanho={18} /> Baixar grátis</a>
            <a className="botao botao-vidro" href="#tudo"><Icone nome="play" tamanho={16} /> Ver tudo o que ele faz</a>
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

const PALAVRAS = ['TV Box e Android TV', 'Samsung', 'LG', 'Roku', 'Celular e tablet', 'Mac', 'Windows', 'Linux', 'Navegador', 'Óculos VR', 'Multi tela', 'Som no celular', 'iPhone em breve'];

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
          <div><strong><Contador ate={10} /></strong><span>tipos de tela</span></div>
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

/* ───────────────────────────── multi tela e som no celular ───────────────────────────── */

const TELAS_DEMO = [
  { canal: 'Esportes Ao Vivo', numero: 12, icone: 'bola', programa: 'Final do campeonato · 2º tempo', cor: 4 },
  { canal: 'Cinema Clássico', numero: 31, icone: 'film', programa: 'Sessão da tarde · 48 min', cor: 5 },
] as const;

type Ouvir = 'nenhuma' | 0 | 1 | 'as-duas';

/**
 * Dois canais lado a lado, como na TV Box: a metade com contorno é a que tem
 * som. O celular, pelo Saimo Connect, toca o som de uma tela ou das duas,
 * acertado com a imagem — é por isso que dá para ver o jogo na sala e ouvir o
 * filme no fone.
 */
function MultiTelaSom() {
  const [ativa, setAtiva] = useState<0 | 1>(0);
  const [ouvir, setOuvir] = useState<Ouvir>(1);
  const [atraso, setAtraso] = useState(120);
  const [placar, setPlacar] = useState([2, 1]);
  const [minuto, setMinuto] = useState(67);
  const raiz = useRef<HTMLElement | null>(null);
  const [mexeu, setMexeu] = useState(false);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setVisivel(e.isIntersecting), { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // O relógio do jogo anda, e às vezes sai gol.
  useEffect(() => {
    if (!visivel) return;
    const t = window.setInterval(() => {
      setMinuto((m) => (m >= 90 ? 46 : m + 1));
      if (Math.random() < 0.12) setPlacar(([a, b]) => (Math.random() < 0.5 ? [a + 1, b] : [a, b + 1]));
    }, 1600);
    return () => window.clearInterval(t);
  }, [visivel]);

  // Sem ninguém mexendo, a demonstração troca sozinha a metade com som e o que o celular ouve.
  useEffect(() => {
    if (mexeu || !visivel) return;
    const passos: [0 | 1, Ouvir][] = [[0, 1], [1, 0], [0, 'as-duas'], [0, 1]];
    let i = 0;
    const t = window.setInterval(() => {
      i = (i + 1) % passos.length;
      setAtiva(passos[i][0]);
      setOuvir(passos[i][1]);
    }, 3800);
    return () => window.clearInterval(t);
  }, [mexeu, visivel]);

  const escolherTela = (i: 0 | 1) => { setMexeu(true); setAtiva(i); };
  const escolherOuvir = (o: Ouvir) => { setMexeu(true); setOuvir(o); };
  const celularOuve = (i: 0 | 1) => ouvir === i || ouvir === 'as-duas';
  const rotuloOuvir = ouvir === 'nenhuma' ? 'Som só na TV' : ouvir === 'as-duas' ? 'Ouvindo as duas telas' : `Ouvindo a tela ${ouvir + 1}`;

  return (
    <section className="secao multitela" id="multitela" ref={raiz}>
      <div className="miolo">
        <span className="eyebrow rv"><i /> Multi tela e som no celular</span>
        <h2 className="titulo-grande rv d1">Dois canais na mesma tela.<br /><span className="grad">Cada som onde você quiser.</span></h2>
        <p className="lead rv d2">
          O jogo na tela 1 para a sala, o filme na tela 2 no seu fone. Com a <strong>multi tela</strong> você assiste dois canais
          lado a lado e escolhe qual tem som. Com o <strong>som no celular</strong>, o Saimo Connect manda o áudio de uma tela,
          ou das duas, para o seu celular, acertado com a imagem da TV, até com a tela do celular apagada.
        </p>

        <div className="mt-palco rv d3">
          <div className="mt-tv">
            <div className="mt-tela">
              {TELAS_DEMO.map((c, i) => {
                const [a, b] = CORES_POSTER[c.cor];
                const idx = i as 0 | 1;
                return (
                  <button key={c.canal} type="button" className={`mt-metade ${ativa === idx ? 'ativa' : ''}`} onClick={() => escolherTela(idx)}
                    aria-pressed={ativa === idx} aria-label={`Tela ${i + 1}: ${c.canal}. ${ativa === idx ? 'Com som' : 'Sem som'}`}>
                    <span className="mt-fundo" style={{ background: `linear-gradient(150deg, ${a}, ${b})` }} />
                    {i === 0 ? (
                      <span className="mt-jogo">
                        <span className="mt-placar"><b>{placar[0]}</b><i>x</i><b>{placar[1]}</b></span>
                        <span className="mt-minuto">{minuto}'</span>
                        <span className="mt-bola"><Icone nome="bola" tamanho={26} /></span>
                      </span>
                    ) : (
                      <span className="mt-filme">
                        <span className="mt-lua" /><span className="mt-serra" /><span className="mt-serra mt-serra2" />
                        <span className="mt-legenda">— A gente ainda chega antes do amanhecer.</span>
                      </span>
                    )}
                    <span className="mt-canal">
                      <span className="mt-logo"><Icone nome={c.icone} tamanho={15} /></span>
                      <span className="mt-num">{c.numero}</span>
                      <span className="mt-nome">{c.canal}</span>
                    </span>
                    <span className="mt-som"><Icone nome={ativa === idx ? 'volume' : 'mudo'} tamanho={16} /> <span className="mt-txt">{ativa === idx ? 'Som na TV' : 'Mudo'}</span></span>
                    {celularOuve(idx) && <span className="mt-fone"><Icone nome="fone" tamanho={14} /> <span className="mt-txt">no celular</span></span>}
                    <span className="mt-prog">{c.programa}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-pe" />
            <p className="mt-dica"><Icone nome="play" tamanho={13} /> Clique numa metade para dar o som da TV a ela.</p>
          </div>

          <div className={`mt-fluxo ${ouvir === 'nenhuma' ? '' : 'ligado'}`} aria-hidden="true"><span /><span /><span /><span /></div>

          <div className="mt-cel">
            <div className="mt-cel-tela">
              <div className="ccel-entalhe" />
              <div className="mt-cel-cab"><Icone nome="wifi" tamanho={13} /> TV da sala · Saimo Connect</div>
              <div className={`mt-cel-fone ${ouvir === 'nenhuma' ? '' : 'tocando'}`}>
                <span className="mt-anel" /><span className="mt-anel" />
                <Icone nome="fone" tamanho={42} />
              </div>
              <strong className="mt-cel-rotulo">{rotuloOuvir}</strong>
              <div className="mt-eq">{Array.from({ length: 16 }, (_, i) => <i key={i} className={ouvir === 'nenhuma' ? 'parado' : ''} style={{ animationDelay: `${(i % 8) * 0.08}s` }} />)}</div>
              <div className="mt-opcoes" role="group" aria-label="O que tocar no celular">
                {([['Tela 1', 0], ['Tela 2', 1], ['As duas', 'as-duas'], ['Desligar', 'nenhuma']] as [string, Ouvir][]).map(([r, v]) => (
                  <button key={r} type="button" className={ouvir === v ? 'on' : ''} aria-pressed={ouvir === v} onClick={() => escolherOuvir(v)}>{r}</button>
                ))}
              </div>
              <label className="mt-atraso">
                <span>Ajuste do fone Bluetooth <b>{atraso} ms</b></span>
                <input type="range" min={0} max={400} step={10} value={atraso} onChange={(e) => { setMexeu(true); setAtraso(Number(e.target.value)); }} />
              </label>
              <span className="mt-sinc"><i /> Sincronizado com a TV</span>
            </div>
          </div>
        </div>

        <ul className="mt-lista rv">
          <li><Icone nome="multi" tamanho={22} /><div><strong>Dois canais lado a lado</strong><span>Cada metade com logo, número e programa. As setas, os números e a lista trocam o canal da metade em foco.</span></div></li>
          <li><Icone nome="volume" tamanho={22} /><div><strong>Você escolhe quem tem som</strong><span>Só a metade com contorno toca na TV. Um clique, ou seta para o lado, e o som passa para a outra.</span></div></li>
          <li><Icone nome="fone" tamanho={22} /><div><strong>O som da TV no seu fone</strong><span>Ouça a tela 1, a tela 2 ou as duas no celular, colado na imagem, com a tela apagada e o app em segundo plano.</span></div></li>
          <li><Icone nome="sync" tamanho={22} /><div><strong>Afinado no milissegundo</strong><span>O celular acompanha a TV o tempo todo, e um ajuste fino compensa o atraso do fone Bluetooth.</span></div></li>
          <li><Icone nome="raio" tamanho={22} /><div><strong>Fonte reserva nas duas</strong><span>Se o sinal de uma metade cai, ela troca de fonte sozinha, sem mexer na outra.</span></div></li>
          <li><Icone nome="controle" tamanho={22} /><div><strong>Comanda do celular</strong><span>Ligue e desligue a multi tela, escolha a metade e troque o canal de cada uma pelo Saimo Connect.</span></div></li>
        </ul>
        <p className="mt-onde rv">Multi tela na TV Box e Android TV, Samsung, LG, Mac, Windows, Linux e navegador. Som no celular com a TV Box, o Mac, o Windows e o Linux.</p>
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

/* ───────────────────────────── tudo o que ele faz ───────────────────────────── */

type Grupo = 'aovivo' | 'acervo' | 'imagem' | 'conectado' | 'casa';
const GRUPOS: { id: Grupo | 'todos'; nome: string }[] = [
  { id: 'todos', nome: 'Tudo' }, { id: 'aovivo', nome: 'Ao vivo' }, { id: 'acervo', nome: 'Filmes e séries' },
  { id: 'imagem', nome: 'Som e imagem' }, { id: 'conectado', nome: 'Entre aparelhos' }, { id: 'casa', nome: 'Sua lista e sua casa' },
];

const TUDO: { g: Grupo; ic: string; t: string; d: string }[] = [
  { g: 'aovivo', ic: 'tv', t: 'Troca de canal na hora', d: 'Segure a seta para pular 3 ou 10 canais, digite o número ou volte ao anterior.' },
  { g: 'aovivo', ic: 'raio', t: 'Fonte reserva automática', d: 'Se o sinal cai, outra fonte entra sozinha. Ou escolha a Fonte 1, 2, 3 com a qualidade de cada uma.' },
  { g: 'aovivo', ic: 'multi', t: 'Multi tela', d: 'Dois canais lado a lado, e você escolhe qual metade tem som.' },
  { g: 'aovivo', ic: 'guia', t: 'Guia de programação', d: 'O que passa agora e depois, com sinopse e a barra do que já foi.' },
  { g: 'aovivo', ic: 'relogio', t: 'Lembretes e timer de sono', d: 'Avisa quando o programa vai começar e desliga sozinho na hora marcada.' },
  { g: 'aovivo', ic: 'bola', t: 'Jogos do dia', d: 'Agenda com escudos e placar ao vivo, ligada ao canal da sua lista que passa o jogo.' },
  { g: 'aovivo', ic: 'radio', t: 'Rádios', d: 'Por estilo, com logo e equalizador, tocando com a tela apagada.' },
  { g: 'aovivo', ic: 'lista', t: 'Seções e favoritos', d: 'TV Aberta, Esportes, Notícias, Infantil e os seus favoritos, com número fixo por canal.' },
  { g: 'acervo', ic: 'film', t: 'Ficha completa', d: 'Sinopse, elenco, nota, classificação, temporadas e "Mais como este".' },
  { g: 'acervo', ic: 'busca', t: 'Filtros dos grandes serviços', d: 'Gênero, ano, idade, nota mínima e ordem: mais novos, mais populares, de A a Z.' },
  { g: 'acervo', ic: 'play', t: 'Continue de onde parou', d: 'Em qualquer aparelho seu, e com um × para tirar da fileira o que não quer mais.' },
  { g: 'acervo', ic: 'pular', t: 'Pular abertura e resumo', d: 'Um toque pula a abertura e o "anteriormente", com os tempos certos de cada episódio.' },
  { g: 'acervo', ic: 'series', t: 'Próximo episódio sozinho', d: 'O cartão aparece nos créditos, e a série segue na mesma fonte e no mesmo áudio.' },
  { g: 'acervo', ic: 'legenda', t: 'Legendas automáticas', d: 'Português, inglês e espanhol para filmes e séries, com tamanho, fundo e ajuste de sincronia.' },
  { g: 'acervo', ic: 'anime', t: 'Animes e doramas', d: 'Seções próprias, dublados ou legendados, com coleções.' },
  { g: 'acervo', ic: 'voz', t: 'Busca por voz', d: 'Canais, filmes, séries e atores numa busca só, que entende erro de digitação.' },
  { g: 'acervo', ic: 'baixar', t: 'Baixar para ver sem internet', d: 'No celular, filmes e episódios ficam guardados para a viagem.' },
  { g: 'acervo', ic: 'peca', t: 'Addons', d: 'Conecte os addons e as contas que você já usa. O Saimo vem sem nenhum.' },
  { g: 'imagem', ic: 'eq', t: 'Áudio Inteligente', d: 'Iguala o volume entre canais: nada de comercial estourando nem canal baixinho.' },
  { g: 'imagem', ic: 'brilho', t: 'Super Resolução', d: 'Deixa mais nítido o vídeo de resolução baixa na tela grande.' },
  { g: 'imagem', ic: 'raio', t: 'Zero Delay', d: 'O ao vivo mais perto do tempo real, para não ouvir o gol do vizinho antes.' },
  { g: 'imagem', ic: 'pip', t: 'Janelinha', d: 'O vídeo flutuando por cima de tudo no celular e no computador.' },
  { g: 'imagem', ic: 'fone', t: 'Som no celular', d: 'O áudio da TV no seu fone, sincronizado, para não acordar ninguém.' },
  { g: 'imagem', ic: 'legenda', t: 'Áudio e legenda à sua escolha', d: 'Dublado ou original, faixa de áudio, legenda e qualidade no mesmo painel.' },
  { g: 'conectado', ic: 'controle', t: 'Celular vira controle', d: 'Setas, OK, voltar e volume da TV direto do celular, pelo Saimo Connect.' },
  { g: 'conectado', ic: 'link', t: 'Digite no celular', d: 'Links de lista e buscas sem sofrer com o teclado da TV.' },
  { g: 'conectado', ic: 'sync', t: 'Tudo sincronizado', d: 'Favoritos, onde você parou e suas listas passam de um aparelho para o outro.' },
  { g: 'conectado', ic: 'cast', t: 'Chromecast e AirPlay', d: 'Mande o vídeo do celular, do Mac ou do navegador para a TV.' },
  { g: 'conectado', ic: 'box', t: 'Google TV integrado', d: 'Continuar assistindo e busca do próprio sistema, e links que abrem direto no canal.' },
  { g: 'conectado', ic: 'oculos', t: 'Óculos de realidade virtual', d: 'O app da TV roda em óculos Android, como o Meta Quest, com olhar e pinça.' },
  { g: 'conectado', ic: 'baixar', t: 'Avisa quando há versão nova', d: 'O app mostra a novidade e abre o download, sem loja nenhuma no meio.' },
  { g: 'casa', ic: 'link', t: 'M3U ou usuário e senha', d: 'Cole o link da lista ou o servidor do provedor. Usuário e senha só se a lista pedir.' },
  { g: 'casa', ic: 'lista', t: 'Até 10 listas', d: 'Por link ou arquivo, cada uma liga e desliga, e as de link se atualizam sozinhas.' },
  { g: 'casa', ic: 'lock', t: 'Controle parental', d: 'O que é só para adultos fica atrás de um código. As crianças usam sem esbarrar.' },
  { g: 'casa', ic: 'shield', t: 'Endereços escondidos', d: 'A tela mostra Fonte 1, Fonte 2 e a qualidade. O endereço da sua lista não aparece.' },
  { g: 'casa', ic: 'usuario', t: 'Sem conta e sem anúncio', d: 'Nada de cadastro, e-mail ou rastreio. Abriu, usou.' },
  { g: 'casa', ic: 'box', t: 'Leve até em aparelho simples', d: 'Pensado para TV Box de 1 GB de memória e para controle remoto sem botão de menu.' },
];

function TudoQueFaz() {
  const [grupo, setGrupo] = useState<Grupo | 'todos'>('todos');
  const lista = grupo === 'todos' ? TUDO : TUDO.filter((x) => x.g === grupo);
  const aoMover = (e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--gx', `${e.clientX - r.left}px`);
    el.style.setProperty('--gy', `${e.clientY - r.top}px`);
  };
  return (
    <section className="secao tudo" id="tudo">
      <div className="miolo">
        <span className="eyebrow rv"><i /> Tudo o que ele faz</span>
        <h2 className="titulo-grande rv d1"><span className="grad"><Contador ate={TUDO.length} /> recursos</span><br />numa TV que é sua.</h2>
        <p className="lead rv d2">Do canal que abre na hora ao som no fone, tudo o que você acharia em vários aplicativos está num só, igual em todas as telas.</p>
        <div className="tudo-filtros rv d3" role="tablist" aria-label="Filtrar recursos">
          {GRUPOS.map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={grupo === x.id} className={grupo === x.id ? 'on' : ''} onClick={() => setGrupo(x.id)}>
              {x.nome}<em>{x.id === 'todos' ? TUDO.length : TUDO.filter((y) => y.g === x.id).length}</em>
            </button>
          ))}
        </div>
        <div className="tudo-grade" onPointerMove={aoMover}>
          {lista.map((x, i) => (
            <article key={x.t} className="tudo-item" style={{ animationDelay: `${Math.min(i, 18) * 28}ms` }}>
              <span className="tudo-ic"><Icone nome={x.ic} tamanho={22} /></span>
              <h3>{x.t}</h3>
              <p>{x.d}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── aparelhos ───────────────────────────── */

interface Aparelho { id: string; nome: string; icone: string; detalhe: string; estado: 'disponivel' | 'embreve'; para: string }
const APARELHOS: Aparelho[] = [
  { id: 'tvbox', nome: 'TV Box e Android TV', icone: 'box', detalhe: 'Android TV, Fire TV Stick, Mi Box, Chromecast com Google TV e TV Box Android. Feito para o controle remoto, com multi tela, busca por voz e leve até em aparelho de 1 GB.', estado: 'disponivel', para: '/app' },
  { id: 'samsung', nome: 'Samsung e LG', icone: 'tv', detalhe: 'Smart TVs Samsung (Tizen) e LG (webOS), com navegação pelo controle, multi tela e a mesma tela inicial.', estado: 'disponivel', para: '/app' },
  { id: 'roku', nome: 'Roku', icone: 'tv', detalhe: 'Canal nativo para TVs e aparelhos Roku, leve e com suporte total ao controle.', estado: 'disponivel', para: '/app' },
  { id: 'cell', nome: 'Android (celular e tablet)', icone: 'phone', detalhe: 'No bolso: ao vivo, filmes, séries, downloads para ver sem internet, janelinha, Chromecast, e o controle remoto e o fone da sua TV.', estado: 'disponivel', para: '/app' },
  { id: 'mac', nome: 'Mac', icone: 'laptop', detalhe: 'App nativo para Mac com chip Apple: multi tela, picture-in-picture, AirPlay, Chromecast, atalhos de teclado e o som no celular.', estado: 'disponivel', para: '/app' },
  { id: 'win', nome: 'Windows', icone: 'laptop', detalhe: 'App de verdade para Windows 10 e 11, não é o site numa janela: o vídeo roda no próprio PC, com multi tela, janelinha e o som no celular.', estado: 'disponivel', para: '/app' },
  { id: 'linux', nome: 'Linux', icone: 'laptop', detalhe: 'O mesmo app do Windows, com a mesma tela: AppImage para qualquer distribuição recente ou .deb para Ubuntu, Debian e Mint, no PC comum e no ARM.', estado: 'disponivel', para: '/app' },
  { id: 'vr', nome: 'Óculos VR', icone: 'oculos', detalhe: 'O app da TV Box reconhece óculos Android, como Meta Quest, Pico e Android XR, e funciona com o olhar e a pinça: uma tela de cinema onde você estiver.', estado: 'disponivel', para: '/app' },
  { id: 'ios', nome: 'iPhone e iPad', icone: 'phone', detalhe: 'O aplicativo para iPhone e iPad está a caminho da App Store.', estado: 'embreve', para: '/app' },
  { id: 'web', nome: 'Navegador', icone: 'globo', detalhe: 'Sem instalar nada: abra o Saimo no navegador do computador, do celular ou da TV.', estado: 'disponivel', para: '/' },
];

function Aparelhos() {
  const [i, setI] = useState(0);
  const a = APARELHOS[i];
  const navegar = useNavigate();
  const abrirWeb = () => { try { localStorage.setItem('saimo-entrou', '1'); } catch { /* sem armazenamento */ } navegar('/home'); };
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
          Use o celular para navegar na TV, digitar links sem sofrer com o controle, ouvir o som da TV no seu fone e levar o que você assistia
          de um aparelho para outro. Funciona com a TV Box, o Mac, o Windows e o Linux.
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
          <li><Icone nome="fone" tamanho={20} /><div><strong>Som da TV no fone</strong><span>Ouça a TV no celular, sincronizado, sem incomodar ninguém.</span></div></li>
          <li><Icone nome="multi" tamanho={20} /><div><strong>Comanda a multi tela</strong><span>Liga, escolhe a metade e troca o canal de cada uma.</span></div></li>
          <li><Icone nome="controle" tamanho={20} /><div><strong>Controle remoto</strong><span>Setas, OK, voltar e volume, direto do celular.</span></div></li>
          <li><Icone nome="link" tamanho={20} /><div><strong>Digite no celular</strong><span>Mande links de lista e buscas sem teclado de TV.</span></div></li>
          <li><Icone nome="heart" tamanho={20} /><div><strong>Tudo sincronizado</strong><span>Favoritos, progresso e listas entre os seus aparelhos.</span></div></li>
          <li><Icone nome="film" tamanho={20} /><div><strong>Abre filmes na TV</strong><span>Escolha no celular e o filme ou episódio começa na tela grande.</span></div></li>
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
    { nome: 'Android', ic: 'phone' }, { nome: 'Mac', ic: 'laptop' }, { nome: 'Windows', ic: 'laptop' }, { nome: 'Linux', ic: 'laptop' },
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
  ['Dá para ver dois canais ao mesmo tempo?', 'Sim, com a multi tela: dois canais lado a lado na TV Box, nas TVs Samsung e LG, no computador e no navegador. Você escolhe qual metade tem som, e cada uma troca de fonte sozinha se o sinal cair.'],
  ['Posso ouvir o som da TV no celular?', 'Pode. Com o Saimo Connect, o celular toca o som da TV acertado com a imagem, no fone ou no alto-falante, até com a tela apagada. Na multi tela, você escolhe ouvir a tela 1, a tela 2 ou as duas, e um ajuste compensa o atraso do fone Bluetooth.'],
  ['Funciona no Linux e em óculos VR?', 'Sim. No Linux há o AppImage, que roda em qualquer distribuição recente, e o .deb para Ubuntu, Debian e Mint. O app da TV Box também roda em óculos Android, como o Meta Quest.'],
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
    const tituloAnterior = document.title;
    document.title = `${SITE.nomeCompleto} — seu IPTV, suas telas, um só lugar`;
    const meta = document.querySelector('meta[name="description"]');
    const anterior = meta?.getAttribute('content') ?? null;
    meta?.setAttribute('content', 'O Saimo TV é um player e ecossistema para a sua lista de IPTV (M3U ou usuário e senha): ao vivo com guia, multi tela, som da TV no celular, filmes e séries com pular abertura e legendas, rádios e jogos do dia, em TV Box, Samsung, LG, Roku, celular, Mac, Windows, Linux e navegador. Sem anúncios, sem cadastro e sem conteúdo embutido.');
    return () => {
      document.title = tituloAnterior.includes('um só lugar') ? SITE.nomeCompleto : tituloAnterior;
      if (anterior !== null) meta?.setAttribute('content', anterior);
    };
  }, []);
  return (
    <div className="landing" ref={raiz}>
      <Cabecalho ancoras />
      <main>
        <Heroi />
        <Faixa />
        <Manifesto />
        <Demo />
        <MultiTelaSom />
        <Recursos />
        <TudoQueFaz />
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
