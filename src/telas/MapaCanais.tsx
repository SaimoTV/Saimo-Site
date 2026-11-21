/**
 * Mapa-múndi dos canais: uma bolinha por país, com o número de canais dentro.
 * Bolinhas que se encostariam na tela viram uma só, com a soma; aproximar o
 * mapa (roda do mouse, botões ou clique no grupo) separa de novo.
 *
 * Os contornos vêm prontos de src/data/mapaMundi.json (gerado por
 * scripts/gerar_mapa_mundi.mjs): nenhuma biblioteca de mapa no site. Este
 * módulo só é baixado quando a pessoa abre a visão Mapa.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import mapa from '../data/mapaMundi.json';
import type { Channel } from '../types/channel';
import { continenteDoPais, nomeDoPais, paisDoCanal, SEM_PAIS } from '../utils/paises';

const L = mapa.largura;
const A = mapa.altura;
const CENTROS = mapa.centros as unknown as Record<string, [number, number]>;
const ZOOM_MIN = 1;
const ZOOM_MAX = 16;

interface Vista { k: number; x: number; y: number }

interface Bolinha {
  /** Países do grupo, do que tem mais canais para o que tem menos. */
  paises: string[];
  total: number;
  /** Centro na tela, em unidades do viewBox (0..L). */
  cx: number;
  cy: number;
  r: number;
}

/** Raio em pixels de tela: cresce com a raiz da contagem, para a área seguir o número. */
function raioPx(total: number): number {
  return Math.min(34, 11 + Math.sqrt(total) * 0.9);
}

function limitar(v: Vista): Vista {
  const k = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.k));
  // Não deixa o mapa sair inteiro da tela.
  const x = Math.min(0, Math.max(L - L * k, v.x));
  const y = Math.min(0, Math.max(A - A * k, v.y));
  return { k, x, y };
}

export default function MapaCanais({ canais, escolhido, aoEscolher }: {
  canais: Channel[];
  escolhido?: string;
  aoEscolher: (pais: string | null) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [vista, setVista] = useState<Vista>({ k: 1, x: 0, y: 0 });
  const [larguraPx, setLarguraPx] = useState(1000);
  const [dica, setDica] = useState<{ x: number; y: number; b: Bolinha } | null>(null);
  const arrasto = useRef<{ x: number; y: number; vx: number; vy: number; moveu: boolean } | null>(null);

  // Tamanho real do mapa na tela: o raio das bolinhas é em pixels, não em unidades do mapa.
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setLarguraPx(el.clientWidth || 1000));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const porPais = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of canais) {
      const p = paisDoCanal(c);
      if (p !== SEM_PAIS && CENTROS[p]) m.set(p, (m.get(p) ?? 0) + 1);
    }
    return m;
  }, [canais]);

  const semLugar = useMemo(() => canais.filter((c) => !CENTROS[paisDoCanal(c)]).length, [canais]);

  // Agrupa na tela: do maior país para o menor, cada um entra no primeiro grupo
  // que ele encostaria; o grupo vai para o centro ponderado e cresce com a soma.
  const bolinhas = useMemo(() => {
    const unidadesPorPx = L / larguraPx;
    const folga = 2 * unidadesPorPx;
    const grupos: (Bolinha & { sx: number; sy: number })[] = [];
    const ordem = [...porPais.entries()].sort((a, b) => b[1] - a[1]);
    for (const [pais, n] of ordem) {
      const [mx, my] = CENTROS[pais];
      const cx = mx * vista.k + vista.x;
      const cy = my * vista.k + vista.y;
      const r = raioPx(n) * unidadesPorPx;
      const alvo = grupos.find((g) => Math.hypot(g.cx - cx, g.cy - cy) < g.r + r + folga);
      if (alvo) {
        alvo.paises.push(pais);
        alvo.sx += cx * n;
        alvo.sy += cy * n;
        alvo.total += n;
        alvo.cx = alvo.sx / alvo.total;
        alvo.cy = alvo.sy / alvo.total;
        alvo.r = raioPx(alvo.total) * unidadesPorPx;
      } else {
        grupos.push({ paises: [pais], total: n, cx, cy, r, sx: cx * n, sy: cy * n });
      }
    }
    // Um grupo que cresceu e andou pode passar a encostar em outro: junta de
    // novo até nenhuma bolinha ficar em cima de outra.
    for (let juntou = true; juntou;) {
      juntou = false;
      for (let i = 0; i < grupos.length && !juntou; i++) {
        for (let j = i + 1; j < grupos.length; j++) {
          const a = grupos[i];
          const b = grupos[j];
          if (Math.hypot(a.cx - b.cx, a.cy - b.cy) >= a.r + b.r + folga) continue;
          a.paises.push(...b.paises);
          a.sx += b.sx;
          a.sy += b.sy;
          a.total += b.total;
          a.cx = a.sx / a.total;
          a.cy = a.sy / a.total;
          a.r = raioPx(a.total) * unidadesPorPx;
          grupos.splice(j, 1);
          juntou = true;
          break;
        }
      }
    }
    // Os menores por cima, para nenhum número sumir atrás de uma bolinha maior.
    return grupos.sort((a, b) => b.total - a.total);
  }, [porPais, vista, larguraPx]);

  const paraMapa = (clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * L, y: ((clientY - r.top) / r.height) * A };
  };

  const zoomEm = (fator: number, px = L / 2, py = A / 2) => {
    setVista((v) => {
      const k = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.k * fator));
      const f = k / v.k;
      return limitar({ k, x: px - (px - v.x) * f, y: py - (py - v.y) * f });
    });
  };

  // Roda do mouse aproxima em volta do ponteiro; precisa de listener não passivo para não rolar a página.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const roda = (e: WheelEvent) => {
      e.preventDefault();
      const p = paraMapa(e.clientX, e.clientY);
      zoomEm(e.deltaY < 0 ? 1.25 : 0.8, p.x, p.y);
    };
    el.addEventListener('wheel', roda, { passive: false });
    return () => el.removeEventListener('wheel', roda);
  }, []);

  /** Aproxima até os países do grupo caberem na tela (ou dobra o zoom, se já estão juntos demais). */
  const abrirGrupo = (b: Bolinha) => {
    const pts = b.paises.map((p) => CENTROS[p]);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const margem = 40;
    const kCabe = Math.min(L / (x1 - x0 + margem * 2), A / (y1 - y0 + margem * 2));
    const k = Math.min(ZOOM_MAX, Math.max(vista.k * 2, kCabe));
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    setVista(limitar({ k, x: L / 2 - cx * k, y: A / 2 - cy * k }));
    setDica(null);
  };

  const clicarBolinha = (b: Bolinha) => {
    if (arrasto.current?.moveu) return;
    if (b.paises.length > 1) abrirGrupo(b);
    else aoEscolher(escolhido === b.paises[0] ? null : b.paises[0]);
  };

  const rotuloGrupo = (b: Bolinha) => {
    if (b.paises.length === 1) return nomeDoPais(b.paises[0]);
    const continentes = new Set(b.paises.map(continenteDoPais));
    const nomes = b.paises.slice(0, 3).map(nomeDoPais).join(', ');
    const resto = b.paises.length > 3 ? ` e mais ${b.paises.length - 3}` : '';
    return `${continentes.size === 1 ? `${[...continentes][0]}: ` : ''}${nomes}${resto}`;
  };

  const escalaTexto = L / larguraPx;

  return (
    <div className="mapa-canais">
      <div className="mapa-botoes">
        <button onClick={() => zoomEm(1.6)} aria-label="Aproximar">+</button>
        <button onClick={() => zoomEm(1 / 1.6)} aria-label="Afastar">−</button>
        <button onClick={() => setVista({ k: 1, x: 0, y: 0 })} aria-label="Ver o mundo todo" title="Ver o mundo todo">⟲</button>
      </div>

      <svg
        ref={svgRef}
        className="mapa-svg"
        viewBox={`0 0 ${L} ${A}`}
        role="img"
        aria-label="Mapa-múndi com a quantidade de canais por país"
        onPointerDown={(e) => {
          arrasto.current = { x: e.clientX, y: e.clientY, vx: vista.x, vy: vista.y, moveu: false };
        }}
        onPointerMove={(e) => {
          const a = arrasto.current;
          if (!a || e.buttons === 0) return;
          const dx = e.clientX - a.x;
          const dy = e.clientY - a.y;
          if (!a.moveu && Math.hypot(dx, dy) < 4) return;
          if (!a.moveu) (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
          a.moveu = true;
          const f = L / larguraPx;
          setVista((v) => limitar({ ...v, x: a.vx + dx * f, y: a.vy + dy * f }));
          setDica(null);
        }}
        onPointerUp={() => { window.setTimeout(() => { arrasto.current = null; }, 0); }}
        onPointerLeave={() => setDica(null)}
      >
        <rect width={L} height={A} className="mapa-mar" />
        <g transform={`translate(${vista.x} ${vista.y}) scale(${vista.k})`}>
          {mapa.contornos.map((p, i) => {
            const tem = porPais.has(p.c);
            return (
              <path
                key={i}
                d={p.d}
                className={`mapa-pais ${tem ? 'tem' : ''} ${p.c && p.c === escolhido ? 'on' : ''}`}
                strokeWidth={0.6 / vista.k}
                onClick={() => { if (tem && !arrasto.current?.moveu) aoEscolher(escolhido === p.c ? null : p.c); }}
              >
                {p.c && <title>{`${nomeDoPais(p.c)}: ${porPais.get(p.c) ?? 0} canais`}</title>}
              </path>
            );
          })}
        </g>

        {bolinhas.map((b) => {
          const grupo = b.paises.length > 1;
          const on = !grupo && b.paises[0] === escolhido;
          return (
            <g
              key={b.paises.join()}
              className={`mapa-bolinha ${grupo ? 'grupo' : ''} ${on ? 'on' : ''}`}
              transform={`translate(${b.cx} ${b.cy})`}
              role="button"
              tabIndex={0}
              aria-label={`${rotuloGrupo(b)}: ${b.total} canais${grupo ? ', aproximar' : ''}`}
              onClick={() => clicarBolinha(b)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clicarBolinha(b); } }}
              onPointerEnter={(e) => {
                const r = svgRef.current!.getBoundingClientRect();
                setDica({ x: e.clientX - r.left, y: e.clientY - r.top, b });
              }}
              onPointerLeave={() => setDica(null)}
            >
              {/* Alvo de toque maior que a bolinha. */}
              <circle r={b.r + 4 * escalaTexto} className="mapa-alvo" />
              <circle r={b.r} className="mapa-disco" strokeWidth={2 * escalaTexto} />
              <text
                className="mapa-numero"
                fontSize={(b.total >= 1000 ? 10 : 11.5) * escalaTexto}
                dy="0.35em"
              >
                {b.total >= 10000 ? `${Math.round(b.total / 1000)}k` : b.total.toLocaleString('pt-BR')}
              </text>
            </g>
          );
        })}
      </svg>

      {dica && (
        <div className="mapa-dica" style={{ left: dica.x, top: dica.y }}>
          <strong>{rotuloGrupo(dica.b)}</strong>
          <span>{dica.b.total.toLocaleString('pt-BR')} {dica.b.total === 1 ? 'canal' : 'canais'}</span>
          <em>{dica.b.paises.length > 1 ? 'Clique para aproximar' : 'Clique para ver os canais'}</em>
        </div>
      )}

      <p className="mapa-legenda">
        Cada bolinha mostra quantos canais há no país; bolinhas próximas se juntam e mostram a soma.
        Role ou use + e − para aproximar, arraste para mover.
        {semLugar > 0 && ` ${semLugar.toLocaleString('pt-BR')} canais sem país informado não aparecem no mapa.`}
      </p>
    </div>
  );
}
