import { useEffect, useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PAGINAS_LEGAIS, SITE } from './config';
import { Cabecalho, Rodape } from './Moldura';
import texto from './formato-saimo.md?raw';
import './landing.css';
import './legal.css';

/**
 * Página "Formato de lista": mostra docs/formato-saimo.md (cópia em
 * formato-saimo.md, mantida igual à do repositório SaimoPlayer). O renderizador
 * abaixo entende só o que esse documento usa: títulos, parágrafos, listas,
 * tabelas, citações, blocos de código, `código`, **negrito** e [links](…).
 */

const REPO = 'https://github.com/SaimoTV/SaimoPlayer/';

function endereco(href: string): string {
  if (/^(https?:|mailto:|#)/.test(href)) return href;
  if (href.startsWith('exemplos/')) return `${REPO}tree/main/docs/${href}`;
  if (href.startsWith('../')) return `${REPO}blob/main/${href.slice(3)}`;
  return `${REPO}blob/main/docs/${href}`;
}

function slug(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Inline: `código`, **negrito**, [texto](endereço). */
function inline(s: string, chave = 'i'): ReactNode[] {
  const partes: ReactNode[] = [];
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(s))) {
    if (m.index > ultimo) partes.push(s.slice(ultimo, m.index));
    const k = `${chave}${n++}`;
    if (m[1] !== undefined) partes.push(<code key={k}>{m[1]}</code>);
    else if (m[2] !== undefined) partes.push(<strong key={k}>{inline(m[2], k)}</strong>);
    else {
      const href = endereco(m[4]);
      partes.push(href.startsWith('#')
        ? <a key={k} href={href}>{inline(m[3], k)}</a>
        : <a key={k} href={href} target="_blank" rel="noreferrer">{inline(m[3], k)}</a>);
    }
    ultimo = m.index + m[0].length;
  }
  if (ultimo < s.length) partes.push(s.slice(ultimo));
  return partes;
}

function celulas(linha: string): string[] {
  const out: string[] = [];
  let atual = '';
  let cod = false;
  const t = linha.trim().replace(/^\|/, '').replace(/\|$/, '');
  for (const c of t) {
    if (c === '`') cod = !cod;
    if (c === '|' && !cod) { out.push(atual.trim()); atual = ''; } else atual += c;
  }
  out.push(atual.trim());
  return out;
}

interface Secao { id: string; titulo: string; blocos: ReactNode[] }

function interpretar(md: string): { secoes: Secao[]; abertura: ReactNode[] } {
  const linhas = md.replace(/\r/g, '').split('\n');
  const secoes: Secao[] = [];
  const abertura: ReactNode[] = [];
  let atual: Secao | null = null;
  let i = 0;
  let k = 0;
  const empurrar = (b: ReactNode) => (atual ? atual.blocos : abertura).push(b);

  while (i < linhas.length) {
    const l = linhas[i];
    if (!l.trim() || /^---+$/.test(l.trim())) { i++; continue; }
    if (l.startsWith('# ')) { i++; continue; }
    if (l.startsWith('## ')) {
      const titulo = l.slice(3).replace(/^\d+\.\s*/, '').trim();
      if (/^sum[aá]rio$/i.test(titulo)) {
        i++;
        while (i < linhas.length && !linhas[i].startsWith('## ') && !/^---+$/.test(linhas[i].trim())) i++;
        continue;
      }
      atual = { id: slug(titulo), titulo, blocos: [] };
      secoes.push(atual);
      i++;
      continue;
    }
    if (l.startsWith('### ')) { empurrar(<h3 key={k++} id={slug(l.slice(4))}>{inline(l.slice(4))}</h3>); i++; continue; }
    if (l.startsWith('```')) {
      const cod: string[] = [];
      i++;
      while (i < linhas.length && !linhas[i].startsWith('```')) cod.push(linhas[i++]);
      i++;
      empurrar(<pre key={k++} className="formato-codigo"><code>{cod.join('\n')}</code></pre>);
      continue;
    }
    if (l.startsWith('>')) {
      const q: string[] = [];
      while (i < linhas.length && linhas[i].startsWith('>')) q.push(linhas[i++].replace(/^>\s?/, ''));
      empurrar(<aside key={k++} className="legal-destaque"><p>{inline(q.join(' '))}</p></aside>);
      continue;
    }
    if (l.trim().startsWith('|')) {
      const tab: string[] = [];
      while (i < linhas.length && linhas[i].trim().startsWith('|')) tab.push(linhas[i++]);
      const cab = celulas(tab[0]);
      const corpo = tab.slice(2).map(celulas);
      empurrar(
        <div key={k++} className="formato-rolagem">
          <table className="legal-tabela">
            <thead><tr>{cab.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr></thead>
            <tbody>{corpo.map((r, j) => <tr key={j}>{r.map((c, x) => <td key={x}>{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^(-|\d+\.)\s/.test(l)) {
      const ord = /^\d+\./.test(l);
      const itens: string[] = [];
      while (i < linhas.length && /^(-|\d+\.|\s{2,})/.test(linhas[i]) && linhas[i].trim()) {
        if (/^(-|\d+\.)\s/.test(linhas[i])) itens.push(linhas[i].replace(/^(-|\d+\.)\s/, ''));
        else itens[itens.length - 1] += ' ' + linhas[i].trim();
        i++;
      }
      const lis = itens.map((t, j) => <li key={j}>{inline(t)}</li>);
      empurrar(ord ? <ol key={k++} className="formato-lista">{lis}</ol> : <ul key={k++}>{lis}</ul>);
      continue;
    }
    const p: string[] = [];
    while (i < linhas.length && linhas[i].trim() && !/^(#|```|>|\||-\s|\d+\.\s|---)/.test(linhas[i])) p.push(linhas[i++].trim());
    if (!p.length) { i++; continue; }
    empurrar(<p key={k++}>{inline(p.join(' '))}</p>);
  }
  return { secoes, abertura };
}

export default function Formato() {
  const { secoes, abertura } = useMemo(() => interpretar(texto), []);
  useEffect(() => {
    document.title = `Formato de lista — ${SITE.nomeCompleto}`;
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="legal">
      <Cabecalho />
      <main className="legal-miolo">
        <header className="legal-topo">
          <span className="eyebrow"><i /> {SITE.nomeCompleto}</span>
          <h1>Formato de lista do Saimo</h1>
          <p className="legal-resumo">Como montar a sua própria lista de canais e de filmes e séries para o Saimo reconhecer, com exemplos prontos e um validador.</p>
        </header>
        <div className="legal-corpo">
          <nav className="legal-indice" aria-label="Neste documento">
            <strong>Neste documento</strong>
            {secoes.map((s, i) => <a key={s.id} href={`#${s.id}`}>{i + 1}. {s.titulo}</a>)}
            <div className="legal-outros">
              <strong>Outras páginas</strong>
              <a href={`${REPO}tree/main/docs/exemplos`} target="_blank" rel="noreferrer">Exemplos prontos</a>
              <a href={`${REPO}blob/main/scripts/validar_formato_saimo.py`} target="_blank" rel="noreferrer">Validador</a>
              {PAGINAS_LEGAIS.map((p) => <Link key={p.rota} to={p.rota}>{p.rotulo}</Link>)}
            </div>
          </nav>
          <article className="legal-texto">
            {abertura}
            {secoes.map((s, i) => (
              <section key={s.id} id={s.id}>
                <h2><span>{i + 1}</span>{s.titulo}</h2>
                {s.blocos}
              </section>
            ))}
          </article>
        </div>
      </main>
      <Rodape />
    </div>
  );
}
