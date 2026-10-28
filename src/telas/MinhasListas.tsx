import { useEffect, useRef, useState } from 'react';
import {
  adicionarLista, aoMudar, atualizarLista, baixarLista, definirAtiva, ErroDeLista,
  lerListaBaixada, listas, MAXIMO_LISTAS, removerLista, type MinhaLista,
} from '../services/minhasListas';
import '../components/Listas.css';
import './MinhasListas.css';

function haQuanto(quando: number): string {
  const min = Math.floor((Date.now() - quando) / 60000);
  if (min < 1) return 'atualizada agora';
  if (min < 60) return `atualizada há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `atualizada há ${h} h`;
  return `atualizada há ${Math.floor(h / 24)} dias`;
}

/** Ajustes → Minhas listas: o usuário cola o link de uma lista .m3u (ou escolhe um arquivo). */
export function MinhasListas({ aviso }: { aviso: (msg: string) => void }) {
  const [itens, setItens] = useState<MinhaLista[]>(listas);
  const [link, setLink] = useState('');
  const [nome, setNome] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null); // 'novo' ou o id da lista
  const [erro, setErro] = useState('');
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  useEffect(() => aoMudar(() => setItens(listas())), []);
  useEffect(() => {
    if (!confirmando) return;
    const t = window.setTimeout(() => setConfirmando(null), 4000);
    return () => window.clearTimeout(t);
  }, [confirmando]);

  const mensagem = (e: unknown) => (e instanceof ErroDeLista ? e.message : 'Não consegui baixar essa lista');

  const adicionar = async () => {
    setErro('');
    if (!link.trim()) { setErro('Cole o link da lista'); return; }
    setOcupado('novo');
    try {
      const canais = await baixarLista(link);
      await adicionarLista(nome, link.trim(), canais);
      setLink(''); setNome('');
      aviso(`${canais.length} canais adicionados`);
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setOcupado(null);
    }
  };

  const doArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setErro('');
    setOcupado('novo');
    const leitor = new FileReader();
    leitor.onload = async () => {
      try {
        const canais = lerListaBaixada(String(leitor.result ?? ''));
        await adicionarLista(nome || f.name.replace(/\.[^.]+$/, ''), null, canais);
        setNome('');
        aviso(`${canais.length} canais adicionados`);
      } catch (x) {
        setErro(mensagem(x));
      } finally {
        setOcupado(null);
      }
    };
    leitor.onerror = () => { setErro('Não consegui ler esse arquivo'); setOcupado(null); };
    leitor.readAsText(f);
  };

  const atualizar = async (l: MinhaLista) => {
    setErro('');
    setOcupado(l.id);
    try { await atualizarLista(l.id); aviso('Lista atualizada'); } catch (e) { setErro(mensagem(e)); } finally { setOcupado(null); }
  };

  const remover = async (l: MinhaLista) => {
    if (confirmando !== l.id) { setConfirmando(l.id); return; }
    setConfirmando(null);
    await removerLista(l.id);
    aviso('Lista removida');
  };

  return (
    <section className="ajustes-bloco" id="minhas-listas">
      <h2>Minhas listas</h2>
      <p>Cole o link de uma lista .m3u. Ela fica só neste navegador.</p>

      {itens.length > 0 && (
        <ul className="minhas-listas-itens">
          {itens.map((l) => (
            <li key={l.id} className={l.ativa ? undefined : 'desativada'}>
              <div className="minhas-listas-nome">
                <strong>{l.nome}</strong>
                <small>{l.total} canais · {haQuanto(l.atualizadaEm)}{l.ativa ? '' : ' · desativada'}</small>
              </div>
              <div className="minhas-listas-acoes">
                {l.link && (
                  <button type="button" className="listas-botao" disabled={ocupado !== null} onClick={() => void atualizar(l)}>
                    {ocupado === l.id ? 'Atualizando…' : 'Atualizar'}
                  </button>
                )}
                <button type="button" className="listas-botao" onClick={() => definirAtiva(l.id, !l.ativa)}>
                  {l.ativa ? 'Desativar' : 'Ativar'}
                </button>
                <button type="button" className="listas-botao perigo" onClick={() => void remover(l)}>
                  {confirmando === l.id ? 'Confirmar' : 'Remover'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {itens.length < MAXIMO_LISTAS ? (
        <form className="listas-form" onSubmit={(e) => { e.preventDefault(); void adicionar(); }} noValidate>
          <div className="listas-campo">
            <label htmlFor="minha-lista-link">Link da lista (.m3u)</label>
            <input
              id="minha-lista-link" type="text" inputMode="url" autoComplete="off" spellCheck={false}
              placeholder="https://…/lista.m3u" value={link} onChange={(e) => setLink(e.target.value)}
              disabled={ocupado !== null} className={erro ? 'invalido' : ''}
            />
          </div>
          <div className="listas-campo">
            <label htmlFor="minha-lista-nome">Nome (opcional)</label>
            <input
              id="minha-lista-nome" type="text" autoComplete="off" placeholder={`Lista ${itens.length + 1}`}
              value={nome} onChange={(e) => setNome(e.target.value)} disabled={ocupado !== null}
            />
          </div>
          {erro && <div className="listas-erro" role="alert">{erro}</div>}
          <div className="listas-botoes">
            <button type="submit" className="listas-botao principal" disabled={ocupado !== null}>
              {ocupado === 'novo' ? 'Baixando…' : 'Adicionar lista'}
            </button>
            <button type="button" className="listas-botao" disabled={ocupado !== null} onClick={() => arquivo.current?.click()}>
              Escolher arquivo
            </button>
            <input ref={arquivo} type="file" accept=".m3u,.m3u8,.txt" style={{ display: 'none' }} onChange={doArquivo} />
          </div>
        </form>
      ) : (
        <p>Você já tem {MAXIMO_LISTAS} listas. Remova uma para adicionar outra.</p>
      )}
    </section>
  );
}
