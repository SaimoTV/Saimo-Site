/**
 * Países e categorias: os canais de todas as listas cruzados em dois eixos
 * (país, continente ou categoria), numa grade que se pode inverter, ou num mapa
 * com bolinhas que somam os canais de cada país e se juntam quando ficam perto.
 *
 * Clicar numa célula, num cabeçalho ou numa bolinha mostra os canais embaixo;
 * clicar num canal abre o Ao vivo.
 */
import { lazy, Suspense, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarraTopo } from '../components/BarraTopo';
import { CartaoLargo } from '../components/Telas';
import { useCanais } from '../hooks/useCanais';
import type { Channel } from '../types/channel';
import {
  CONTINENTES, ROTULO_EIXO, SEM_CATEGORIA, SEM_CONTINENTE, SEM_PAIS,
  categoriaDoCanal, continenteDoCanal, nomeDoPais, rotuloNoEixo, valorNoEixo,
  type Eixo,
} from '../utils/paises';
import './Grade.css';

const MapaCanais = lazy(() => import('./MapaCanais'));

type Visao = 'grade' | 'mapa';

/** O que está escolhido: uma célula, uma linha inteira ou uma coluna inteira. */
interface Escolha { linha?: string; coluna?: string }

/** Rampa sequencial azul, do escuro (poucos) ao claro (muitos), para o fundo escuro do site. */
const RAMPA = ['#0d366b', '#104281', '#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5', '#5598e7', '#6da7ec', '#86b6ef', '#9ec5f4'];

function corDaCelula(n: number, maximo: number): { fundo: string; tinta: string } {
  const t = maximo <= 1 ? 1 : Math.log(n) / Math.log(maximo);
  const i = Math.min(RAMPA.length - 1, Math.round(t * (RAMPA.length - 1)));
  return { fundo: RAMPA[i], tinta: i >= 7 ? '#0a0b14' : '#fff' };
}

/** "Sem país" e "Outros" vão para o fim; o resto do que tem mais canais para o que tem menos. */
function ordenar(totais: Map<string, number>, eixo: Eixo): string[] {
  const fim = new Set([SEM_PAIS, SEM_CATEGORIA, SEM_CONTINENTE]);
  return [...totais.keys()].sort((a, b) => {
    const fa = fim.has(a) ? 1 : 0;
    const fb = fim.has(b) ? 1 : 0;
    if (fa !== fb) return fa - fb;
    if (eixo === 'continente') return CONTINENTES.indexOf(a) - CONTINENTES.indexOf(b);
    return (totais.get(b) ?? 0) - (totais.get(a) ?? 0) || rotuloNoEixo(a, eixo).localeCompare(rotuloNoEixo(b, eixo), 'pt-BR');
  });
}

const POR_PAGINA = 60;

export function Grade() {
  const navigate = useNavigate();
  const todos = useCanais();
  const [visao, setVisao] = useState<Visao>('grade');
  const [linhas, setLinhas] = useState<Eixo>('pais');
  const [colunas, setColunas] = useState<Eixo>('categoria');
  const [continente, setContinente] = useState('');
  const [busca, setBusca] = useState('');
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const [limite, setLimite] = useState(POR_PAGINA);

  const continentes = useMemo(() => {
    const presentes = new Set(todos.map(continenteDoCanal));
    return CONTINENTES.filter((c) => presentes.has(c));
  }, [todos]);

  const canais = useMemo(
    () => (continente ? todos.filter((c) => continenteDoCanal(c) === continente) : todos),
    [todos, continente],
  );

  const tabela = useMemo(() => {
    const celulas = new Map<string, Map<string, Channel[]>>();
    const totLinha = new Map<string, number>();
    const totColuna = new Map<string, number>();
    let maximo = 0;
    for (const c of canais) {
      const l = valorNoEixo(c, linhas);
      const k = valorNoEixo(c, colunas);
      let linha = celulas.get(l);
      if (!linha) { linha = new Map(); celulas.set(l, linha); }
      const lista = linha.get(k) ?? [];
      lista.push(c);
      linha.set(k, lista);
      maximo = Math.max(maximo, lista.length);
      totLinha.set(l, (totLinha.get(l) ?? 0) + 1);
      totColuna.set(k, (totColuna.get(k) ?? 0) + 1);
    }
    return { celulas, totLinha, totColuna, maximo, ordemLinhas: ordenar(totLinha, linhas), ordemColunas: ordenar(totColuna, colunas) };
  }, [canais, linhas, colunas]);

  const termo = busca.trim().toLowerCase();
  const linhasVisiveis = termo
    ? tabela.ordemLinhas.filter((l) => rotuloNoEixo(l, linhas).toLowerCase().includes(termo))
    : tabela.ordemLinhas;

  const escolhidos = useMemo(() => {
    if (!escolha) return [];
    return canais
      .filter((c) => (escolha.linha === undefined || valorNoEixo(c, linhas) === escolha.linha)
        && (escolha.coluna === undefined || valorNoEixo(c, colunas) === escolha.coluna))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [canais, escolha, linhas, colunas]);

  const escolher = (e: Escolha | null) => { setEscolha(e); setLimite(POR_PAGINA); };

  const trocarEixo = (qual: 'linhas' | 'colunas', eixo: Eixo) => {
    // Os dois eixos iguais não cruzam nada: o outro fica com o que este tinha.
    if (qual === 'linhas') {
      if (eixo === colunas) setColunas(linhas);
      setLinhas(eixo);
    } else {
      if (eixo === linhas) setLinhas(colunas);
      setColunas(eixo);
    }
    escolher(null);
  };

  const inverter = () => {
    setLinhas(colunas);
    setColunas(linhas);
    setEscolha((e) => (e ? { linha: e.coluna, coluna: e.linha } : e));
  };

  const tituloEscolha = !escolha ? '' : [
    escolha.linha !== undefined ? rotuloNoEixo(escolha.linha, linhas) : null,
    escolha.coluna !== undefined ? rotuloNoEixo(escolha.coluna, colunas) : null,
  ].filter(Boolean).join(' · ');

  const totalPaises = useMemo(() => new Set(canais.map((c) => c.country).filter(Boolean)).size, [canais]);

  return (
    <div className="tela tela-com-barra">
      <BarraTopo />
      <div className="tela-miolo">
        <h1 className="tela-titulo">Países e categorias</h1>
        <p className="tela-sub">
          {canais.length.toLocaleString('pt-BR')} canais · {totalPaises} países
          {continente ? ` · ${continente}` : ''}
        </p>

        <div className="grade-controles">
          <div className="grade-visao" role="tablist" aria-label="Como mostrar">
            <button role="tab" aria-selected={visao === 'grade'} className={visao === 'grade' ? 'on' : ''} onClick={() => setVisao('grade')}>Grade</button>
            <button role="tab" aria-selected={visao === 'mapa'} className={visao === 'mapa' ? 'on' : ''} onClick={() => setVisao('mapa')}>Mapa</button>
          </div>

          <label className="grade-campo">
            <span>Continente</span>
            <select value={continente} onChange={(e) => { setContinente(e.target.value); escolher(null); }}>
              <option value="">Todos</option>
              {continentes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          {visao === 'grade' && (
            <>
              <label className="grade-campo">
                <span>Linhas</span>
                <select value={linhas} onChange={(e) => trocarEixo('linhas', e.target.value as Eixo)}>
                  {(Object.keys(ROTULO_EIXO) as Eixo[]).map((k) => <option key={k} value={k}>{ROTULO_EIXO[k]}</option>)}
                </select>
              </label>
              <button className="grade-inverter" onClick={inverter} title="Trocar linhas e colunas">⇄ Inverter eixos</button>
              <label className="grade-campo">
                <span>Colunas</span>
                <select value={colunas} onChange={(e) => trocarEixo('colunas', e.target.value as Eixo)}>
                  {(Object.keys(ROTULO_EIXO) as Eixo[]).map((k) => <option key={k} value={k}>{ROTULO_EIXO[k]}</option>)}
                </select>
              </label>
              <input
                className="grade-busca" type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
                placeholder={`Buscar ${ROTULO_EIXO[linhas].toLowerCase()}`} aria-label={`Buscar ${ROTULO_EIXO[linhas].toLowerCase()} nas linhas`}
              />
            </>
          )}
        </div>

        {canais.length === 0 ? (
          <div className="tela-vazio">
            <h2>Nenhum canal ainda</h2>
            <p>Adicione uma lista em Ajustes para ver os canais por país e categoria.</p>
          </div>
        ) : visao === 'grade' ? (
          <div className="grade-matriz-rolagem">
            <table className="grade-matriz">
              <thead>
                <tr>
                  <th className="grade-canto" scope="col">{ROTULO_EIXO[linhas]} \ {ROTULO_EIXO[colunas]}</th>
                  {tabela.ordemColunas.map((k) => (
                    <th key={k} scope="col" className={escolha?.coluna === k && escolha.linha === undefined ? 'on' : ''}>
                      <button onClick={() => escolher({ coluna: k })} title={`Todos os canais de ${rotuloNoEixo(k, colunas)}`}>
                        {rotuloNoEixo(k, colunas)}
                      </button>
                    </th>
                  ))}
                  <th scope="col" className="grade-total">Total</th>
                </tr>
              </thead>
              <tbody>
                {linhasVisiveis.map((l) => {
                  const linha = tabela.celulas.get(l);
                  return (
                    <tr key={l}>
                      <th scope="row" className={escolha?.linha === l && escolha.coluna === undefined ? 'on' : ''}>
                        <button onClick={() => escolher({ linha: l })} title={`Todos os canais de ${rotuloNoEixo(l, linhas)}`}>
                          {rotuloNoEixo(l, linhas)}
                        </button>
                      </th>
                      {tabela.ordemColunas.map((k) => {
                        const n = linha?.get(k)?.length ?? 0;
                        if (!n) return <td key={k} className="grade-vazia" />;
                        const cor = corDaCelula(n, tabela.maximo);
                        const on = escolha?.linha === l && escolha.coluna === k;
                        return (
                          <td key={k}>
                            <button
                              className={`grade-celula ${on ? 'on' : ''}`}
                              style={{ background: cor.fundo, color: cor.tinta }}
                              onClick={() => escolher(on ? null : { linha: l, coluna: k })}
                              title={`${rotuloNoEixo(l, linhas)} · ${rotuloNoEixo(k, colunas)}: ${n} ${n === 1 ? 'canal' : 'canais'}`}
                            >
                              {n}
                            </button>
                          </td>
                        );
                      })}
                      <td className="grade-total">{tabela.totLinha.get(l)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  {tabela.ordemColunas.map((k) => <td key={k} className="grade-total">{tabela.totColuna.get(k)}</td>)}
                  <td className="grade-total">{canais.length}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <Suspense fallback={<div className="grade-carregando">Carregando o mapa…</div>}>
            <MapaCanais
              canais={canais}
              escolhido={linhas === 'pais' ? escolha?.linha : undefined}
              aoEscolher={(pais) => {
                // O mapa escolhe país: a lista embaixo passa a ser país × categoria.
                setLinhas('pais');
                setColunas('categoria');
                escolher(pais ? { linha: pais } : null);
              }}
            />
          </Suspense>
        )}

        {escolha && (
          <section className="grade-escolhidos" aria-live="polite">
            <div className="grade-escolhidos-topo">
              <h2 className="grade-titulo">{tituloEscolha} <span>{escolhidos.length} {escolhidos.length === 1 ? 'canal' : 'canais'}</span></h2>
              <button className="grade-limpar" onClick={() => escolher(null)}>Limpar</button>
            </div>
            {escolha.linha !== undefined && escolha.coluna === undefined && linhas === 'pais' && (
              <PorCategoria canais={escolhidos} aoEscolher={(cat) => { setColunas('categoria'); escolher({ linha: escolha.linha, coluna: cat }); }} />
            )}
            <div className="grade">
              {escolhidos.slice(0, limite).map((c) => (
                <div key={c.id} className="grade-item">
                  <CartaoLargo titulo={c.name} logo={c.logo}
                    linha={[c.country ? nomeDoPais(c.country) : null, categoriaDoCanal(c)].filter(Boolean).join(' · ')}
                    aoAbrir={() => navigate(`/tv/${c.id}`)} />
                </div>
              ))}
            </div>
            {escolhidos.length > limite && (
              <button className="grade-mais" onClick={() => setLimite((n) => n + POR_PAGINA)}>
                Mostrar mais ({escolhidos.length - limite} restantes)
              </button>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

/** Atalho dentro de um país: as categorias dele, com a contagem. */
function PorCategoria({ canais, aoEscolher }: { canais: Channel[]; aoEscolher: (categoria: string) => void }) {
  const cats = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of canais) { const k = categoriaDoCanal(c); m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [canais]);
  if (cats.length < 2) return null;
  return (
    <div className="pilulas">
      {cats.map(([k, n]) => <button key={k} onClick={() => aoEscolher(k)}>{k} <small>{n}</small></button>)}
    </div>
  );
}
