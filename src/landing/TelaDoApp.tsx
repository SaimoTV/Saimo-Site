import { useEffect, useState } from 'react';
import './tela-app.css';

/**
 * Réplica da interface real do Saimo (a mesma barra, as mesmas telas e a mesma
 * disposição dos apps de TV, computador e site), preenchida com uma lista de
 * demonstração: nomes inventados, logotipos de letra e capas só de cor. Nada de
 * marca, canal ou título de terceiros, porque o Saimo vem vazio.
 */

type Aba = 'inicio' | 'aovivo' | 'ondemand';
const ORDEM: Aba[] = ['inicio', 'aovivo', 'ondemand'];
const ROTULO: Record<Aba, string> = { inicio: 'Início', aovivo: 'Ao vivo', ondemand: 'On Demand' };

const CANAIS = [
  { n: 1, nome: 'Notícias 24h', sigla: 'N', cor: '#3b82f6', prog: 'Jornal da Noite', p: 0.62, sec: 'Notícias' },
  { n: 2, nome: 'Cine Clássico', sigla: 'CC', cor: '#a855f7', prog: 'Sessão das Dez', p: 0.28, sec: 'Filmes e Séries' },
  { n: 3, nome: 'Esporte Mais', sigla: 'E+', cor: '#22c55e', prog: 'Mesa Redonda', p: 0.81, sec: 'Esportes' },
  { n: 4, nome: 'Mundo Kids', sigla: 'MK', cor: '#f59e0b', prog: 'Desenhos da Tarde', p: 0.45, sec: 'Infantil' },
  { n: 5, nome: 'Doc Planeta', sigla: 'DP', cor: '#14b8a6', prog: 'Oceanos', p: 0.12, sec: 'Documentários' },
];

const CAPAS = [
  ['#7c5cff', '#1d1450', 'Noite Fria'], ['#4fe3d0', '#0a3d47', 'A Travessia'], ['#ff8a5b', '#5a1f0c', 'Último Verão'],
  ['#5b8cff', '#122560', 'Horizonte'], ['#c779ff', '#3a1260', 'Ecos'], ['#38d996', '#0b4a32', 'Raízes'],
  ['#ffb454', '#5e300c', 'Duna Azul'], ['#4fc3ff', '#0d3a5c', 'Maré Alta'],
] as const;

function Logo({ sigla, cor }: { sigla: string; cor: string }) {
  return <span className="ta-logo" style={{ background: `linear-gradient(140deg, ${cor}, ${cor}88)` }}>{sigla}</span>;
}

function Capa({ i, titulo = true }: { i: number; titulo?: boolean }) {
  const [a, b, t] = CAPAS[i % CAPAS.length];
  return (
    <span className="ta-capa" style={{ background: `linear-gradient(160deg, ${a}, ${b})` }}>
      {titulo && <b>{t}</b>}
    </span>
  );
}

function Barra({ aba, escolher }: { aba: Aba; escolher: (a: Aba) => void }) {
  const itens: [string, Aba | null][] = [['Buscar', null], ['Início', 'inicio'], ['Ao vivo', 'aovivo'], ['Eventos', null], ['On Demand', 'ondemand'], ['Favoritos', null], ['Rádios', null]];
  return (
    <div className="ta-barra">
      <span className="ta-marca">S</span>
      {itens.map(([t, a]) => (
        a
          ? <button key={t} type="button" tabIndex={-1} className={aba === a ? 'on' : ''} onClick={() => escolher(a)}>{t}</button>
          : <span key={t}>{t}</span>
      ))}
      <span className="ta-hora">20:58</span>
    </div>
  );
}

function Inicio() {
  return (
    <div className="ta-miolo ta-inicio">
      <div className="ta-destaque">
        <div>
          <small>Boa noite</small>
          <strong>O que vamos assistir?</strong>
          <span className="ta-play">▶ Continuar: A Travessia</span>
        </div>
      </div>
      <div className="ta-fila">Ao vivo agora</div>
      <div className="ta-cartoes">
        {CANAIS.slice(0, 4).map((c) => (
          <div key={c.n} className="ta-cartao">
            <Logo sigla={c.sigla} cor={c.cor} />
            <b>{c.nome}</b>
            <small>{c.prog}</small>
            <i style={{ width: `${c.p * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="ta-fila">Continue assistindo</div>
      <div className="ta-capas">{[1, 0, 4, 2, 6, 3].map((i) => <Capa key={i} i={i} />)}</div>
    </div>
  );
}

function AoVivo() {
  const [atual, setAtual] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setAtual((a) => (a + 1) % 4), 1600);
    return () => window.clearInterval(t);
  }, []);
  const c = CANAIS[atual];
  return (
    <div className="ta-miolo ta-aovivo">
      <div className="ta-lista">
        <div className="ta-lista-topo"><strong>Canais</strong><span><em>5</em> 5</span></div>
        <div className="ta-secoes"><span className="on">Todos</span><span>Notícias</span><span>Esportes</span><span>Infantil</span></div>
        {CANAIS.slice(0, 4).map((k, i) => (
          <div key={k.n} className={`ta-canal ${i === atual ? 'on' : ''}`}>
            <span className="ta-num">{k.n}</span>
            <Logo sigla={k.sigla} cor={k.cor} />
            <div><b>{k.nome}</b><small>{k.prog}</small><i style={{ width: `${k.p * 100}%` }} /></div>
          </div>
        ))}
      </div>
      <div className="ta-ver">
        <div className="ta-video" style={{ ['--c' as string]: c.cor }}>
          <span className="ta-vivo">AO VIVO</span>
          <Logo sigla={c.sigla} cor={c.cor} />
        </div>
        <div className="ta-info">
          <small>{c.n} · {c.nome}</small>
          <strong>{c.prog}</strong>
          <span>20:30 – 21:25 · faltam 27 min</span>
          <span className="ta-seguir">A seguir: Programa Especial</span>
        </div>
      </div>
    </div>
  );
}

function OnDemand() {
  return (
    <div className="ta-miolo ta-ondemand">
      <strong className="ta-titulo">Filmes</strong>
      <small className="ta-sub">Da sua lista, por letra, com busca e filtros</small>
      <div className="ta-categorias">
        {[['Filmes', '#4fe3d0'], ['Séries', '#5b8cff'], ['Animes', '#ffb454']].map(([t, cor], i) => (
          <div key={t} className={`ta-categoria ${i === 0 ? 'on' : ''}`}>
            <span style={{ background: cor }} />
            <b>{t}</b>
          </div>
        ))}
      </div>
      <div className="ta-filtros">{['Gênero', 'Ano', 'Idade', 'Nota', 'Ordem'].map((f) => <span key={f}>{f}</span>)}</div>
      <div className="ta-capas">{[3, 5, 7, 0, 2, 4].map((i) => <Capa key={i} i={i} />)}</div>
    </div>
  );
}

/** A TV com o app; troca de tela sozinha e aceita clique nas abas. */
export function TelaDoApp() {
  const [aba, setAba] = useState<Aba>('inicio');
  const [parado, setParado] = useState(false);
  useEffect(() => {
    if (parado || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setTimeout(() => setAba((a) => ORDEM[(ORDEM.indexOf(a) + 1) % ORDEM.length]), 5200);
    return () => window.clearTimeout(t);
  }, [aba, parado]);
  return (
    <div className="ta" onPointerEnter={() => setParado(true)} onPointerLeave={() => setParado(false)}>
      <div className="ta-tela">
        <Barra aba={aba} escolher={setAba} />
        <div className="ta-palco" key={aba}>
          {aba === 'inicio' && <Inicio />}
          {aba === 'aovivo' && <AoVivo />}
          {aba === 'ondemand' && <OnDemand />}
        </div>
      </div>
      <div className="ta-pe" />
      <div className="ta-pontos" aria-hidden="true">
        {ORDEM.map((a) => <button key={a} type="button" tabIndex={-1} className={a === aba ? 'on' : ''} onClick={() => setAba(a)}>{ROTULO[a]}</button>)}
      </div>
    </div>
  );
}

/** O celular: a mesma lista, no app de celular. */
export function CelularDoApp() {
  return (
    <div className="tc">
      <div className="tc-tela">
        <div className="tc-entalhe" />
        <div className="tc-video"><span className="ta-vivo">AO VIVO</span></div>
        <div className="tc-info"><b>1 · Notícias 24h</b><small>Jornal da Noite</small><i /></div>
        {CANAIS.slice(1, 5).map((k) => (
          <div key={k.n} className="tc-canal">
            <Logo sigla={k.sigla} cor={k.cor} />
            <div><b>{k.nome}</b><small>{k.prog}</small></div>
          </div>
        ))}
        <div className="tc-nav"><span className="on" /><span /><span /><span /></div>
      </div>
    </div>
  );
}
