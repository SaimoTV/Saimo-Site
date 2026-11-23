/**
 * Seções dos Ajustes: estatísticas pessoais, aparência (tema) e legendas.
 */
import { useEffect, useRef, useState } from 'react';
import { definirNotificarNoSistema, notificarNoSistema } from '../services/novosEpisodios';
import { aoMudarAssistidos, duracaoLegivel, estatisticas, limparAssistidos } from '../services/assistidos';
import { DESTAQUES, FUNDOS, TAMANHOS, aoMudarTema, definirTema, marcarAcessibilidade, temaAtual, type Acessibilidade, type Animacoes, type Fundo } from '../plataforma/tema';
import {
  OPCOES, aoMudarEstiloDeLegenda, definirEstiloDeLegenda, estiloAtual, cssDaLegenda, type EstiloDeLegenda,
} from '../plataforma/legendaEstilo';

export function EstatisticasPessoais() {
  const [e, setE] = useState(estatisticas);
  useEffect(() => aoMudarAssistidos(() => setE(estatisticas())), []);
  const vazio = e.filmes === 0 && e.episodios === 0 && e.tempoTotal < 60;
  return (
    <section className="ajustes-bloco" id="estatisticas">
      <h2>Suas estatísticas</h2>
      <p>Do perfil em uso: o que você já assistiu aqui. Um título conta como concluído ao passar de 90%; episódios também podem ser marcados à mão na lista de episódios.</p>
      {vazio ? (
        <p className="ajustes-dica">Ainda não há nada por aqui. Assista a um filme ou episódio até o fim e ele aparece.</p>
      ) : (
        <div className="estat-grade">
          <div className="estat-cartao"><strong>{duracaoLegivel(e.tempoTotal)}</strong><span>Tempo assistido</span></div>
          <div className="estat-cartao"><strong>{e.filmes}</strong><span>{e.filmes === 1 ? 'Filme concluído' : 'Filmes concluídos'}</span></div>
          <div className="estat-cartao"><strong>{e.episodios}</strong><span>{e.episodios === 1 ? 'Episódio concluído' : 'Episódios concluídos'}</span></div>
          <div className="estat-cartao"><strong>{e.series}</strong><span>{e.series === 1 ? 'Série acompanhada' : 'Séries acompanhadas'}</span></div>
          <div className="estat-cartao"><strong>{e.ultimos30}</strong><span>Concluídos em 30 dias</span></div>
          {e.maisVista && (
            <div className="estat-cartao largo"><strong>{e.maisVista.titulo}</strong><span>Série mais vista · {e.maisVista.episodios} episódios</span></div>
          )}
        </div>
      )}
      {!vazio && (
        <div className="ajustes-botoes">
          <button className="ajustes-botao" onClick={() => { limparAssistidos(); setE(estatisticas()); }}>Zerar estatísticas</button>
        </div>
      )}
    </section>
  );
}

const OPCOES_ACESS: { chave: 'negrito' | 'contraste' | 'focoForte' | 'espacado'; nome: string; sobre: string }[] = [
  { chave: 'negrito', nome: 'Texto em negrito', sobre: 'Letras mais grossas, mais fáceis de ler de longe' },
  { chave: 'contraste', nome: 'Alto contraste', sobre: 'Texto branco puro, fundos mais escuros e bordas visíveis' },
  { chave: 'focoForte', nome: 'Foco reforçado', sobre: 'Contorno amarelo grosso onde o controle está' },
  { chave: 'espacado', nome: 'Mais espaço no texto', sobre: 'Mais espaço entre letras, palavras e linhas' },
];

const ACESS_PADRAO: Acessibilidade = { tamanho: 'normal', negrito: false, contraste: false, focoForte: false, espacado: false };

function acessDe(t: Acessibilidade): Acessibilidade {
  return { tamanho: t.tamanho, negrito: t.negrito, contraste: t.contraste, focoForte: t.focoForte, espacado: t.espacado };
}

/**
 * Acessibilidade com prévia: as escolhas aparecem primeiro no quadro de
 * exemplo; só "Aplicar" leva para o app inteiro. Vale neste aparelho, para
 * todos os perfis.
 */
export function AcessibilidadeAjustes() {
  const [aplicado, setAplicado] = useState(() => acessDe(temaAtual()));
  const [rascunho, setRascunho] = useState(aplicado);
  const previa = useRef<HTMLDivElement>(null);
  useEffect(() => { if (previa.current) marcarAcessibilidade(previa.current, rascunho); }, [rascunho]);
  const mudou = JSON.stringify(rascunho) !== JSON.stringify(aplicado);
  const padrao = JSON.stringify(rascunho) === JSON.stringify(ACESS_PADRAO);
  const aplicar = () => { definirTema(rascunho); setAplicado(rascunho); };
  return (
    <section className="ajustes-bloco" id="acessibilidade">
      <h2>Acessibilidade</h2>
      <p>Escolha e veja no exemplo abaixo como fica. Nada muda no app até você tocar em Aplicar.</p>
      <p>Tamanho do texto e das telas</p>
      <div className="pilulas" role="radiogroup" aria-label="Tamanho do texto">
        {TAMANHOS.map((x) => (
          <button key={x.id} role="radio" aria-checked={rascunho.tamanho === x.id} className={rascunho.tamanho === x.id ? 'on' : ''}
            onClick={() => setRascunho((r) => ({ ...r, tamanho: x.id }))}>{x.nome}</button>
        ))}
      </div>
      <div className="acess-opcoes">
        {OPCOES_ACESS.map((o) => (
          <button key={o.chave} type="button" role="switch" aria-checked={rascunho[o.chave]}
            className={`acess-opcao${rascunho[o.chave] ? ' on' : ''}`}
            onClick={() => setRascunho((r) => ({ ...r, [o.chave]: !r[o.chave] }))}>
            <span className="acess-chave" aria-hidden="true"><span /></span>
            <span><strong>{o.nome}</strong><small>{o.sobre}</small></span>
          </button>
        ))}
      </div>
      <p>Prévia</p>
      <div className="previa-acess" ref={previa} aria-label="Prévia de como o app vai ficar">
        <div className="previa-miolo">
          <h3>Filmes em alta</h3>
          <div className="previa-cartoes">
            <div className="previa-cartao previa-focado"><span className="previa-capa" /><span>A Odisseia</span><small>2026 · Aventura</small></div>
            <div className="previa-cartao"><span className="previa-capa" /><span>Série do domingo</span><small>T2 · E5</small></div>
          </div>
          <p>OK abre · segure OK para favoritar · VOLTAR vai ao menu</p>
        </div>
      </div>
      <div className="ajustes-botoes">
        <button type="button" className="ajustes-botao destaque" disabled={!mudou} onClick={aplicar}>Aplicar</button>
        <button type="button" className="ajustes-botao" disabled={!mudou} onClick={() => setRascunho(aplicado)}>Desfazer</button>
        <button type="button" className="ajustes-botao" disabled={padrao} onClick={() => setRascunho(ACESS_PADRAO)}>Voltar ao padrão</button>
      </div>
      <p className="ajustes-dica">Animações: em Aparência, “Reduzidas” tira o movimento das telas. Legendas: no grupo Legendas.</p>
    </section>
  );
}

export function AparenciaAjustes() {
  const [t, setT] = useState(temaAtual);
  useEffect(() => aoMudarTema(() => setT(temaAtual())), []);
  return (
    <section className="ajustes-bloco" id="aparencia">
      <h2>Aparência</h2>
      <p>Cor de destaque, fundo e animações. Vale neste aparelho, para todos os perfis.</p>
      <p>Cor de destaque</p>
      <div className="tema-amostras" role="radiogroup" aria-label="Cor de destaque">
        {DESTAQUES.map((d) => (
          <button key={d.id} type="button" role="radio" aria-checked={t.destaque === d.id}
            className={`tema-amostra${t.destaque === d.id ? ' on' : ''}`} onClick={() => definirTema({ destaque: d.id })}>
            <span className="tema-bola" style={{ background: `linear-gradient(135deg, ${d.acento}, ${d.roxo})` }} />
            <span>{d.nome}</span>
          </button>
        ))}
      </div>
      <p>Fundo</p>
      <div className="pilulas">
        {FUNDOS.map((f) => (
          <button key={f.id} className={t.fundo === f.id ? 'on' : ''} onClick={() => definirTema({ fundo: f.id as Fundo })}>{f.nome}</button>
        ))}
      </div>
      <p>Animações e transições entre telas</p>
      <div className="pilulas">
        {([['suaves', 'Suaves'], ['reduzidas', 'Reduzidas']] as [Animacoes, string][]).map(([id, nome]) => (
          <button key={id} className={t.animacoes === id ? 'on' : ''} onClick={() => definirTema({ animacoes: id })}>{nome}</button>
        ))}
      </div>
    </section>
  );
}

const ROTULOS: Record<keyof EstiloDeLegenda, string> = {
  fonte: 'Fonte', tamanho: 'Tamanho', cor: 'Cor', fundo: 'Fundo', posicao: 'Posição',
};

export function LegendasAjustes() {
  const [e, setE] = useState(estiloAtual);
  useEffect(() => aoMudarEstiloDeLegenda(() => setE(estiloAtual())), []);
  return (
    <section className="ajustes-bloco" id="legendas">
      <h2>Legendas</h2>
      <p>Como a legenda aparece no player. Vale para as legendas do vídeo e para as baixadas.</p>
      {(Object.keys(OPCOES) as (keyof EstiloDeLegenda)[]).map((campo) => (
        <div key={campo}>
          <p>{ROTULOS[campo]}</p>
          <div className="pilulas">
            {OPCOES[campo].map(([valor, nome]) => (
              <button key={valor} className={e[campo] === valor ? 'on' : ''}
                onClick={() => definirEstiloDeLegenda({ [campo]: valor } as Partial<EstiloDeLegenda>)}>{nome}</button>
            ))}
          </div>
        </div>
      ))}
      <div className="legenda-previa" aria-label="Prévia da legenda">
        <style>{cssDaLegenda(e).replace(/\.movie-video::cue, video::cue/, '.legenda-previa-texto')}</style>
        <span className="legenda-previa-texto" style={{ padding: e.fundo === 'preto' || e.fundo === 'translucido' ? '2px 8px' : 0 }}>
          Assim aparece a legenda
        </span>
      </div>
    </section>
  );
}

export function NotificacoesAjustes() {
  const [ligado, setLigado] = useState(notificarNoSistema);
  const [aviso, setAviso] = useState('');
  const suportado = typeof Notification !== 'undefined';
  const alternar = async (ligar: boolean) => {
    const ok = await definirNotificarNoSistema(ligar);
    setLigado(ok);
    setAviso(ligar && !ok ? 'O navegador não deixou: libere as notificações deste site nas permissões dele.' : '');
  };
  return (
    <section className="ajustes-bloco" id="notificacoes">
      <h2>Episódios novos</h2>
      <p>Quando uma série favorita ganha episódios, aparece um aviso nos Favoritos. Se quiser, o navegador também avisa fora do site (com ele aberto em alguma aba).</p>
      {suportado ? (
        <div className="pilulas">
          <button className={ligado ? 'on' : ''} onClick={() => void alternar(true)}>Avisar também pelo navegador</button>
          <button className={!ligado ? 'on' : ''} onClick={() => void alternar(false)}>Só nos Favoritos</button>
        </div>
      ) : (
        <p className="ajustes-dica">Este navegador não tem notificações do sistema: os avisos ficam nos Favoritos.</p>
      )}
      {aviso && <p className="ajustes-dica">{aviso}</p>}
    </section>
  );
}
