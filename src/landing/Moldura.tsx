import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PAGINAS_LEGAIS, SITE } from './config';

/** Marca do Saimo (ícone do app + nome). */
function Marca() {
  return (
    <Link to="/sobre" className="marca" aria-label="Saimo TV, página inicial">
      <img src="/icons/icon-192.png" alt="" width="34" height="34" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
      <span>Saimo<b>TV</b></span>
    </Link>
  );
}

/** Cabeçalho das páginas institucionais. `ancoras`: mostra os atalhos da página inicial. */
export function Cabecalho({ ancoras = false }: { ancoras?: boolean }) {
  const [rolou, setRolou] = useState(false);
  const [aberto, setAberto] = useState(false);
  const navegar = useNavigate();
  useEffect(() => {
    const f = () => setRolou(window.scrollY > 24);
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  const abrirWeb = () => {
    try { localStorage.setItem('saimo-entrou', '1'); } catch { /* sem armazenamento */ }
    navegar('/');
  };
  const base = ancoras ? '' : '/sobre';
  const ancora = (id: string) => `${base}#${id}`;
  const fechar = () => setAberto(false);
  return (
    <header className={`cab ${rolou ? 'rolou' : ''} ${aberto ? 'aberto' : ''}`}>
      <div className="cab-miolo">
        <Marca />
        <nav className="cab-nav" aria-label="Principal">
          {ancoras ? (
            <>
              <a href="#sobre" onClick={fechar}>Sobre</a>
              <a href="#como" onClick={fechar}>Como funciona</a>
              <a href="#recursos" onClick={fechar}>Recursos</a>
              <a href="#connect" onClick={fechar}>Saimo Connect</a>
              <a href="#aparelhos" onClick={fechar}>Aparelhos</a>
            </>
          ) : (
            <>
              <a href={ancora('sobre')}>Sobre</a>
              <a href={ancora('connect')}>Saimo Connect</a>
              <Link to="/suporte">Suporte</Link>
            </>
          )}
          <Link to="/app" onClick={fechar}>Baixar</Link>
        </nav>
        <button type="button" className="botao botao-principal cab-cta" onClick={abrirWeb}>Abrir no navegador</button>
        <button type="button" className="cab-menu" aria-label="Menu" aria-expanded={aberto} onClick={() => setAberto(!aberto)}><i /><i /><i /></button>
      </div>
    </header>
  );
}

export function Rodape() {
  return (
    <footer className="rodape">
      <div className="miolo rodape-grade">
        <div>
          <Marca />
          <p className="rodape-texto">
            Ecossistema de streaming pessoal para a sua lista de IPTV. O Saimo é só o reprodutor:
            não fornece, não hospeda e não distribui canais, filmes ou séries.
          </p>
          <p className="rodape-selo">Feito no Brasil · v{SITE.versaoDoTexto} dos textos legais</p>
        </div>
        <div>
          <h4>Produto</h4>
          <Link to="/sobre">Sobre</Link>
          <Link to="/app">Baixar</Link>
          <Link to="/suporte">Suporte</Link>
        </div>
        <div>
          <h4>Legal</h4>
          {PAGINAS_LEGAIS.filter((p) => p.rota !== '/suporte').map((p) => <Link key={p.rota} to={p.rota}>{p.rotulo}</Link>)}
        </div>
      </div>
      <div className="miolo rodape-fim">
        <span>© {new Date().getFullYear()} {SITE.nomeCompleto}. Todos os direitos reservados.</span>
        <span>Nomes de marcas citados pertencem aos seus respectivos donos. O Saimo não tem relação com eles.</span>
      </div>
    </footer>
  );
}
