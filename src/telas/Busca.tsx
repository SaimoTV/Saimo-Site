/**
 * Buscar: filmes, séries, animes, doramas e canais enquanto se digita, sem
 * ligar para acento, com as buscas recentes.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarraTopo } from '../components/BarraTopo';
import { CampoBusca, CartaoCapa, CartaoLargo, Fileira, SemLista } from '../components/Telas';
import { useCanais } from '../hooks/useCanais';
import { useListas } from '../services/listas';
import {
  discoveryToItemDestaque,
  metaPreviewToItemDestaque,
  searchAddonsCatalogs,
  searchTmdbMulti,
  useAddons,
  useTemAddons,
} from '../services/addons';
import {
  buscar, capaDaFicha, colecao, generos as lerGeneros, semAno, todos as listarTudo, tituloDoId,
  type Achado, type Generos, type ItemDestaque, type SerieColecao,
} from '../services/vodService';
import { buscarPessoas, creditosDe, type PessoaAchada } from '../services/tmdbService';
import { chave } from '../services/radios';
import { ROTULO_TIPO, useAbrirVod } from './compartilhado';

const RECENTES = 'saimo-buscas-recentes';
const lerRecentes = (): string[] => {
  try { const l = JSON.parse(localStorage.getItem(RECENTES) || '[]'); return Array.isArray(l) ? l : []; } catch { return []; }
};

export function Busca() {
  const navigate = useNavigate();
  const abrirVod = useAbrirVod();
  const canais = useCanais();
  const links = useListas();
  const addons = useAddons();
  const temAddons = useTemAddons();
  const podeVod = Boolean(links.filmes) || temAddons;
  const [termo, setTermo] = useState('');
  const [acervo, setAcervo] = useState<ItemDestaque[]>([]);
  const [colecoes, setColecoes] = useState<{ animes: SerieColecao[]; doramas: SerieColecao[] } | null>(null);
  const [fichas, setFichas] = useState<Generos | null>(null);
  const [recentes, setRecentes] = useState(lerRecentes);
  // Atores e diretores: o nome digitado também procura gente, e escolher uma
  // pessoa mostra o que dela existe no acervo.
  const [pessoas, setPessoas] = useState<PessoaAchada[]>([]);
  const [pessoa, setPessoa] = useState<PessoaAchada | null>(null);
  const [achados, setAchados] = useState<{ id: number; lista: ItemDestaque[] } | null>(null);
  const t = termo.trim();

  useEffect(() => {
    // Sem endereço de filmes não há o que carregar do catálogo M3U/Saimo.
    if (!links.filmes) return;
    void lerGeneros().then(setFichas);
    void Promise.all([colecao('animes'), colecao('doramas')]).then(([animes, doramas]) => setColecoes({ animes, doramas }));
  }, [links.filmes]);

  // O índice de nomes é pequeno; espera-se um instante entre as teclas.
  useEffect(() => {
    if (t.length < 2 || !podeVod) return;
    let vivo = true;
    const espera = window.setTimeout(() => {
      void (async () => {
        const baseProm = links.filmes
          ? buscar(t).then((achados) =>
              achados.map((a) => ({ tipo: a.serie ? 's' : 'f', titulo: a.titulo, letra: a.letra, ano: a.ano, capa: '' } as ItemDestaque)),
            ).catch(() => [] as ItemDestaque[])
          : Promise.resolve([] as ItemDestaque[]);
        const addonProm = temAddons
          ? Promise.all([
              searchAddonsCatalogs(addons.filter((a) => a.enabled), t).catch(() => []),
              searchTmdbMulti(t).catch(() => []),
            ])
          : Promise.resolve([[], []] as const);

        const [baseItems, [addonMetas, tmdbItems]] = await Promise.all([baseProm, addonProm]);
        if (!vivo) return;
        const combinados: ItemDestaque[] = [...baseItems];
        const vistos = new Set(combinados.map((x) => `${x.tipo}:${x.titulo.toLowerCase()}`));
        for (const m of addonMetas) {
          const conv = metaPreviewToItemDestaque(m);
          const k = `${conv.tipo}:${conv.titulo.toLowerCase()}`;
          if (!vistos.has(k)) {
            vistos.add(k);
            combinados.push(conv);
          }
        }
        for (const td of tmdbItems) {
          const conv = discoveryToItemDestaque(td);
          const k = `${conv.tipo}:${conv.titulo.toLowerCase()}`;
          if (!vistos.has(k)) {
            vistos.add(k);
            combinados.push(conv);
          }
        }
        setAcervo(combinados);
      })();
    }, 220);
    return () => { vivo = false; window.clearTimeout(espera); };
  }, [t, podeVod, links.filmes, temAddons, addons]);

  useEffect(() => {
    if (t.length < 3) return;
    let vivo = true;
    const espera = window.setTimeout(() => {
      void buscarPessoas(t).then((l) => { if (vivo) setPessoas(l); });
    }, 350);
    return () => { vivo = false; window.clearTimeout(espera); };
  }, [t]);

  useEffect(() => {
    if (!pessoa || !fichas) return;
    let vivo = true;
    void (async () => {
      const creditos = await creditosDe(pessoa.id);
      const [comFilmes, comSeries] = await Promise.all([listarTudo(false), listarTudo(true)]);
      if (!vivo) return;
      const porNome = new Map<string, Achado>();
      for (const a of [...comFilmes, ...comSeries]) porNome.set(`${a.serie ? 's' : 'f'}|${a.titulo}`, a);
      const vistos = new Set<string>();
      const saida: ItemDestaque[] = [];
      for (const c of creditos) {
        const titulo = tituloDoId(fichas, c.id, c.serie);
        if (!titulo) continue;
        const marca = c.serie ? 's' : 'f';
        const achado = porNome.get(`${marca}|${titulo}`) ?? porNome.get(`${marca}|${semAno(titulo)}`);
        if (!achado) continue;
        const k = `${marca}|${achado.titulo}`;
        if (vistos.has(k)) continue;
        vistos.add(k);
        saida.push({ tipo: marca, titulo: achado.titulo, letra: achado.letra, ano: achado.ano, capa: c.capa ?? capaDaFicha(fichas, achado.titulo, achado.serie) ?? '' });
      }
      setAchados({ id: pessoa.id, lista: saida });
    })();
    return () => { vivo = false; };
  }, [pessoa, fichas]);

  // Só vale enquanto o termo tem 3 letras ou mais, e para a pessoa escolhida.
  const pessoasVisiveis = t.length >= 3 ? pessoas : [];
  const trabalhos = pessoa && achados?.id === pessoa.id ? achados.lista : null;

  const guardar = (q: string) => {
    if (q.length < 2) return;
    const nova = [q, ...lerRecentes().filter((x) => x !== q)].slice(0, 8);
    localStorage.setItem(RECENTES, JSON.stringify(nova));
    setRecentes(nova);
  };

  const comCapa = (i: ItemDestaque) => i.capa || (fichas ? capaDaFicha(fichas, i.titulo, i.tipo !== 'f') ?? '' : '');

  const canaisAchados = useMemo(() => {
    if (t.length < 2) return [];
    const q = chave(t);
    return canais.filter((c) => chave(c.name).includes(q)).slice(0, 40);
  }, [t, canais]);

  const daColecao = useMemo(() => {
    if (t.length < 2 || !colecoes) return { animes: [], doramas: [] };
    const q = chave(t);
    const pega = (l: SerieColecao[], tipo: string): ItemDestaque[] => l
      .filter((s) => chave(s.titulo).includes(q))
      .slice(0, 40).map((s) => ({ tipo, titulo: s.titulo, letra: '', ano: s.ano, capa: '' }));
    return { animes: pega(colecoes.animes, 'a'), doramas: pega(colecoes.doramas, 'd') };
  }, [t, colecoes]);

  // Sem termo, resultado velho não aparece: ele só vale enquanto se digita.
  const achadosAcervo = t.length >= 2 && podeVod ? acervo : [];
  const filmes = achadosAcervo.filter((i) => i.tipo === 'f');
  const series = achadosAcervo.filter((i) => i.tipo === 's');
  const nada = t.length >= 2 && !canaisAchados.length && !achadosAcervo.length
    && !daColecao.animes.length && !daColecao.doramas.length;

  const grade = (titulo: string, itens: ItemDestaque[]) => itens.length > 0 && (
    <Fileira titulo={titulo}>
      {itens.map((i) => (
        <CartaoCapa key={`${i.tipo}${i.titulo}${i.ano}`} titulo={semAno(i.titulo)} capa={comCapa(i)}
          rotulo={i.ano || ROTULO_TIPO[i.tipo]} aoAbrir={() => { guardar(t); abrirVod({ ...i, capa: comCapa(i) }); }} />
      ))}
    </Fileira>
  );

  return (
    <div className="tela tela-com-barra">
      <BarraTopo />
      <div className="tela-miolo" style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 className="tela-titulo">Buscar</h1>
        <CampoBusca valor={termo} aoMudar={setTermo} placeholder="Filmes, séries, animes, doramas e canais" autoFocus />
        {!t && recentes.length > 0 && (
          <>
            <h2 className="grade-titulo">Buscas recentes</h2>
            <div className="pilulas">
              {recentes.map((r) => <button key={r} onClick={() => setTermo(r)}>{r}</button>)}
              <button onClick={() => { localStorage.removeItem(RECENTES); setRecentes([]); }}>Limpar</button>
            </div>
          </>
        )}
        {pessoasVisiveis.length > 0 && !pessoa && links.filmes && (
          <>
            <h2 className="grade-titulo">Atores e diretores</h2>
            <div className="busca-pessoas">
              {pessoasVisiveis.map((p) => (
                <button key={p.id} className="busca-pessoa" onClick={() => { guardar(t); setPessoa(p); }}>
                  {p.foto ? <img src={p.foto} alt="" loading="lazy" /> : <span className="busca-pessoa-sem" />}
                  <span><strong>{p.nome}</strong><small>{[p.area, p.conhecidaPor].filter(Boolean).join(' · ')}</small></span>
                </button>
              ))}
            </div>
          </>
        )}
        {pessoa && (
          <>
            <div className="busca-pessoa-cab">
              <button className="busca-pessoa-voltar" onClick={() => setPessoa(null)}>‹ Voltar</button>
              <h2 className="grade-titulo">No acervo, com {pessoa.nome}</h2>
            </div>
            {trabalhos === null && <p className="ajustes-dica">Procurando no acervo…</p>}
            {trabalhos?.length === 0 && <p className="ajustes-dica">Nada de {pessoa.nome} no acervo agora.</p>}
          </>
        )}
        {!links.canais && !temAddons && <SemLista tipo="canais" />}
        {!links.filmes && !temAddons && <SemLista tipo="filmes" />}
        {nada && (links.canais || podeVod) && <div className="tela-vazio"><h2>Nada encontrado</h2><p>Nada para “{t}”. Tente outro nome.</p></div>}
      </div>

      {pessoa && trabalhos && trabalhos.length > 0 && (
        <div className="busca-pessoa-grade">
          {trabalhos.map((i) => (
            <CartaoCapa key={`${i.tipo}${i.titulo}${i.ano}`} titulo={semAno(i.titulo)} capa={i.capa}
              rotulo={i.ano || ROTULO_TIPO[i.tipo]} aoAbrir={() => abrirVod(i)} />
          ))}
        </div>
      )}

      {!pessoa && canaisAchados.length > 0 && (
        <Fileira titulo="Canais">
          {canaisAchados.map((c) => (
            <CartaoLargo key={c.id} titulo={c.name} logo={c.logo} linha={c.category}
              aoAbrir={() => { guardar(t); navigate(`/tv/${c.id}`); }} />
          ))}
        </Fileira>
      )}
      {!pessoa && grade('Filmes', filmes)}
      {!pessoa && grade('Séries', series)}
      {!pessoa && grade('Animes', daColecao.animes)}
      {!pessoa && grade('Doramas', daColecao.doramas)}
    </div>
  );
}
