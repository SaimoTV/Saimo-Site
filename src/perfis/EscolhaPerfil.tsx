/**
 * "Quem está assistindo?": a escolha de perfil ao abrir, e o lugar de criar,
 * editar e apagar perfis. Abre sozinha com 2 ou mais perfis (uma vez por aba)
 * e também pelo avatar da barra do topo e pelos Ajustes.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  AVATARES, MAX_NOME, MAX_PERFIS, PRINCIPAL, apagar, assinar, avatarUrl, criar, deveEscolherAoAbrir, editar,
  entrar, idAtivo, marcarEscolhido, perfis, versaoAtual, EVENTO_ABRIR, type Perfil,
} from './perfis';
import './perfis.css';

export function Avatar({ perfil, tamanho = 96 }: { perfil: Pick<Perfil, 'nome' | 'avatar'>; tamanho?: number }) {
  const url = avatarUrl(perfil.avatar);
  return (
    <span className="perfil-avatar" style={{ width: tamanho, height: tamanho }}>
      {url
        ? <img src={url} alt="" width={tamanho} height={tamanho} draggable={false} />
        : <span className="perfil-avatar-letra" style={{ fontSize: tamanho * 0.45 }}>{(perfil.nome.trim()[0] ?? '?').toUpperCase()}</span>}
    </span>
  );
}

type Modo = 'escolher' | 'gerenciar' | { editar: Perfil | null };

export function EscolhaPerfil() {
  useSyncExternalStore(assinar, versaoAtual);
  const [aberto, setAberto] = useState(deveEscolherAoAbrir);
  const [modo, setModo] = useState<Modo>('escolher');
  // Aberta sozinha ao entrar: sem perfil escolhido, não dá para fechar sem escolher.
  const [obrigatoria, setObrigatoria] = useState(aberto);
  const lista = perfis();
  const atual = idAtivo();

  useEffect(() => {
    const abrir = (e: Event) => {
      const m = (e as CustomEvent<'escolher' | 'gerenciar'>).detail;
      setModo(m === 'gerenciar' ? 'gerenciar' : 'escolher');
      setObrigatoria(false);
      setAberto(true);
    };
    window.addEventListener(EVENTO_ABRIR, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR, abrir);
  }, []);

  const fechar = useCallback(() => {
    if (obrigatoria) return;
    setAberto(false);
    setModo('escolher');
  }, [obrigatoria]);

  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'Backspace' && e.keyCode !== 10009 && e.keyCode !== 461) return;
      const alvo = e.target as HTMLElement | null;
      if (e.key === 'Backspace' && alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof modo === 'object') setModo('gerenciar');
      else if (modo === 'gerenciar') setModo('escolher');
      else fechar();
    };
    window.addEventListener('keydown', tecla, true);
    return () => window.removeEventListener('keydown', tecla, true);
  }, [aberto, modo, fechar]);

  // Trava a rolagem da página por baixo.
  useEffect(() => {
    if (!aberto) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = antes; };
  }, [aberto]);

  if (!aberto) return null;

  const escolher = (p: Perfil) => {
    setObrigatoria(false);
    marcarEscolhido();
    if (p.id === atual) { setAberto(false); setModo('escolher'); }
    entrar(p.id);
  };

  return (
    <div className="perfis-fundo" role="dialog" aria-modal="true" aria-labelledby="perfis-titulo">
      {typeof modo === 'object' ? (
        <EditarPerfil
          perfil={modo.editar}
          aoVoltar={() => setModo('gerenciar')}
          aoSalvar={() => setModo('gerenciar')}
        />
      ) : (
        <div className="perfis-caixa">
          <h1 id="perfis-titulo">{modo === 'gerenciar' ? 'Gerenciar perfis' : 'Quem está assistindo?'}</h1>
          {modo === 'gerenciar' && <p className="perfis-sub">Escolha um perfil para mudar o nome ou o avatar.</p>}
          <ul className="perfis-grade">
            {lista.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`perfis-item ${p.id === atual ? 'atual' : ''} ${modo === 'gerenciar' ? 'editando' : ''}`}
                  data-focusable="true"
                  autoFocus={modo === 'escolher' ? p.id === atual : i === 0}
                  onClick={() => (modo === 'gerenciar' ? setModo({ editar: p }) : escolher(p))}
                >
                  <span className="perfis-moldura">
                    <Avatar perfil={p} tamanho={132} />
                    {modo === 'gerenciar' && (
                      <span className="perfis-lapis" aria-hidden="true">
                        <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>
                      </span>
                    )}
                  </span>
                  <span className="perfis-nome">{p.nome}</span>
                </button>
              </li>
            ))}
            {lista.length < MAX_PERFIS && (
              <li>
                <button type="button" className="perfis-item perfis-novo" data-focusable="true" onClick={() => setModo({ editar: null })}>
                  <span className="perfis-moldura">
                    <span className="perfis-mais" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
                    </span>
                  </span>
                  <span className="perfis-nome">Adicionar perfil</span>
                </button>
              </li>
            )}
          </ul>
          <div className="perfis-acoes">
            {modo === 'gerenciar' ? (
              <button type="button" className="perfis-botao principal" data-focusable="true" onClick={() => setModo('escolher')}>Pronto</button>
            ) : (
              <>
                <button type="button" className="perfis-botao" data-focusable="true" onClick={() => setModo('gerenciar')}>Gerenciar perfis</button>
                {!obrigatoria && <button type="button" className="perfis-botao" data-focusable="true" onClick={fechar}>Fechar</button>}
              </>
            )}
          </div>
          <p className="perfis-nota">
            Cada perfil tem os seus favoritos, o que está assistindo e os recentes. As listas e os ajustes valem para todos.
            Até {MAX_PERFIS} perfis.
          </p>
        </div>
      )}
    </div>
  );
}

function EditarPerfil({ perfil, aoVoltar, aoSalvar }: { perfil: Perfil | null; aoVoltar: () => void; aoSalvar: () => void }) {
  const [nome, setNome] = useState(perfil?.nome ?? '');
  const [avatar, setAvatar] = useState(perfil?.avatar ?? sugestao());
  const [confirmar, setConfirmar] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const valido = nome.trim().length > 0;

  useEffect(() => { if (!perfil) campo.current?.focus(); }, [perfil]);

  const salvar = () => {
    if (!valido) { campo.current?.focus(); return; }
    if (perfil) editar(perfil.id, nome, avatar);
    else criar(nome, avatar);
    aoSalvar();
  };

  return (
    <div className="perfis-caixa perfis-editar">
      <h1 id="perfis-titulo">{perfil ? 'Editar perfil' : 'Novo perfil'}</h1>
      <div className="perfis-editar-topo">
        <Avatar perfil={{ nome: nome || '?', avatar }} tamanho={120} />
        <label className="perfis-campo">
          <span>Nome</span>
          <input
            ref={campo}
            value={nome}
            maxLength={MAX_NOME}
            placeholder="Como chamar este perfil"
            data-focusable="true"
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') salvar(); }}
          />
        </label>
      </div>
      <p className="perfis-sub">Escolha um avatar</p>
      <div className="perfis-avatares" role="radiogroup" aria-label="Avatar">
        {AVATARES.map((a) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={a === avatar}
            aria-label={a}
            className={a === avatar ? 'on' : ''}
            data-focusable="true"
            onClick={() => setAvatar(a)}
          >
            <img src={avatarUrl(a)} alt="" width={64} height={64} draggable={false} />
          </button>
        ))}
      </div>
      <div className="perfis-acoes">
        <button type="button" className="perfis-botao principal" data-focusable="true" disabled={!valido} onClick={salvar}>Salvar</button>
        <button type="button" className="perfis-botao" data-focusable="true" onClick={aoVoltar}>Cancelar</button>
        {perfil && perfil.id !== PRINCIPAL && (
          confirmar ? (
            <button type="button" className="perfis-botao perigo" data-focusable="true" autoFocus
              onClick={() => { apagar(perfil.id); aoSalvar(); }}>
              Apagar mesmo (favoritos e progresso somem)
            </button>
          ) : (
            <button type="button" className="perfis-botao perigo" data-focusable="true" onClick={() => setConfirmar(true)}>Apagar perfil</button>
          )
        )}
      </div>
    </div>
  );
}

/** Um avatar que ninguém usa ainda, para o perfil novo já começar diferente. */
function sugestao(): string {
  const usados = new Set(perfis().map((p) => p.avatar));
  return AVATARES.find((a) => !usados.has(a)) ?? AVATARES[0];
}
