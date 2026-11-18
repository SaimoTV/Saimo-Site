/**
 * Ajustes: o que abrir ao iniciar, importar/exportar canais,
 * atalhos, limpezas e links.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BarraTopo } from '../components/BarraTopo';
import { FormListas } from '../components/FormListas';
import { AddonsModal } from '../components/AddonsModal';
import { useAddons } from '../services/addons';
import { useDebridAccounts } from '../services/debrid';
import { useListas } from '../services/listas';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useCanais } from '../hooks/useCanais';
import { audioInteligenteService, CHAVE_AUDIO_INTELIGENTE } from '../services/audioInteligente';
import { zeroDelayService, CHAVE_ZERO_DELAY, type ModoZeroDelay } from '../services/zeroDelay';
import {
  aoMudar as aoMudarPersonalizados,
  exportarM3U,
  importar,
  limpar as limparPersonalizados,
  locais as canaisLocais,
} from '../services/canaisPersonalizados';
import type { Channel } from '../types/channel';
import './Ajustes.css';
import { IconeMaterial } from '../components/IconeMaterial';
import { MinhasListas } from './MinhasListas';
import { abrirModalDoacao } from '../services/doacaoService';
import { ContaSaimo } from '../conta/ContaSaimo';
import { abrirEscolha, assinar as assinarPerfis, ativo as perfilAtivo, definirPerguntar, perfis as listaPerfis, perguntarAoAbrir, versaoAtual as versaoPerfis } from '../perfis/perfis';
import { Avatar } from '../perfis/EscolhaPerfil';
import { ControleParental } from '../perfis/ControleParental';
import { PedirCodigo } from '../perfis/PedirCodigo';
import { pedeCodigo } from '../perfis/perfis';
import { brilho as brilhoGuardado, definirBrilho, aoMudarBrilho } from '../plataforma/brilho';

export type AoIniciar = 'inicio' | 'ultimo';
export const CHAVE_AO_INICIAR = 'saimo-ao-iniciar';

export type ModoUpscaling = 'off' | 'hd' | '4k';
export const CHAVE_UPSCALING = 'saimo-upscaling';


/** No perfil Kids os Ajustes pedem o código do perfil: a criança não mexe nas listas nem nos ajustes. */
export function Ajustes() {
  const navigate = useNavigate();
  const perfil = perfilAtivo();
  const [liberado, setLiberado] = useState(() => !pedeCodigo(perfil));
  if (liberado) return <AjustesConteudo />;
  return (
    <div className="perfis-fundo" role="dialog" aria-modal="true" aria-labelledby="perfis-titulo">
      <PedirCodigo perfil={perfil} motivo="Os Ajustes ficam trancados no perfil Kids. Digite o código para abrir."
        aoConfirmar={() => setLiberado(true)} aoCancelar={() => navigate('/home')} />
    </div>
  );
}

const LIMPAR: { rotulo: string; chaves: string[]; aviso: string }[] = [
  { rotulo: 'Limpar “Continue assistindo”', chaves: ['saimo-continuar'], aviso: 'Histórico limpo' },
  { rotulo: 'Limpar buscas recentes', chaves: ['saimo-buscas-recentes'], aviso: 'Buscas limpas' },
  { rotulo: 'Limpar rádios ouvidas', chaves: ['saimo-radios-recentes'], aviso: 'Rádios limpas' },
  { rotulo: 'Limpar favoritos', chaves: ['tv-favorites', 'saimo-vod-favoritos'], aviso: 'Favoritos limpos' },
];

function AjustesConteudo() {
  const [brilhoApp, setBrilhoApp] = useState(brilhoGuardado());
  useEffect(() => aoMudarBrilho(setBrilhoApp), []);
  const navigate = useNavigate();
  const location = useLocation();
  const canais = useCanais();
  const listas = useListas();
  const addons = useAddons();
  const debridAccounts = useDebridAccounts();
  const [addonsAberto, setAddonsAberto] = useState(false);
  const [favoritosIds] = useLocalStorage<string[]>('tv-favorites', []);
  const [aoIniciar, setAoIniciar] = useLocalStorage<AoIniciar>(CHAVE_AO_INICIAR, 'inicio');
  const [upscaling, setUpscaling] = useLocalStorage<ModoUpscaling>(CHAVE_UPSCALING, 'off');
  const [audioInteligente, setAudioInteligente] = useLocalStorage<boolean>(CHAVE_AUDIO_INTELIGENTE, true);
  const [zeroDelay, setZeroDelay] = useLocalStorage<ModoZeroDelay>(CHAVE_ZERO_DELAY, 'off');
  const [aviso, setAviso] = useState('');
  useSyncExternalStore(assinarPerfis, versaoPerfis);
  const perfil = perfilAtivo();
  const [personalizados, setPersonalizados] = useState<Channel[]>(canaisLocais);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const alterarAudioInteligente = (ativo: boolean) => {
    setAudioInteligente(ativo);
    audioInteligenteService.setAtivo(ativo);
  };

  const alterarZeroDelay = (modo: ModoZeroDelay) => {
    setZeroDelay(modo);
    zeroDelayService.setModo(modo);
  };

  const alterarUpscaling = (modo: ModoUpscaling) => {
    setUpscaling(modo);
    document.documentElement.dataset.upscaling = modo;
    window.dispatchEvent(new Event('saimo-upscaling-mudou'));
  };

  useEffect(() => aoMudarPersonalizados(() => setPersonalizados(canaisLocais())), []);

  useEffect(() => {
    if (location.hash === '#addons') {
      document.getElementById('addons')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setAddonsAberto(true);
    }
  }, [location.hash]);

  const notificar = (msg: string) => {
    setAviso(msg);
    window.setTimeout(() => setAviso(''), 3000);
  };

  const limparDados = (chaves: string[], texto: string) => {
    chaves.forEach((c) => localStorage.removeItem(c));
    window.dispatchEvent(new Event('saimo-vod-favoritos-mudou'));
    notificar(texto);
  };

  const handleExportarTodos = () => {
    exportarM3U(canais, 'saimo-tv-todos-canais.m3u');
    notificar('Lista de canais exportada!');
  };

  const handleExportarFavoritos = () => {
    const favs = canais.filter((c) => favoritosIds.includes(c.id));
    if (!favs.length) {
      notificar('Você não tem canais favoritos para exportar');
      return;
    }
    exportarM3U(favs, 'saimo-tv-favoritos.m3u');
    notificar('Canais favoritos exportados!');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result;
      if (typeof text === 'string') {
        const qtd = importar(text);
        if (qtd > 0) {
          notificar(`${qtd} canal(is) importado(s) com sucesso!`);
        } else {
          notificar('Nenhum canal válido encontrado no arquivo.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="tela tela-com-barra">
      <BarraTopo />
      <div className="tela-miolo ajustes">
        <h1 className="tela-titulo">Ajustes</h1>
        {aviso && <div className="ajustes-aviso">{aviso}</div>}

        <section className="ajustes-bloco" id="listas">
          <h2>Listas</h2>
          <p>Os endereços de onde o site lê os canais e os filmes e séries. Já vêm preenchidos; troque por outros, ou deixe em branco e salve para desligar uma lista (o site fica vazio naquela parte).</p>
          <FormListas
            key={`${listas.canais}|${listas.filmes}`}
            permitirApagar
            aoSalvar={() => notificar('Listas salvas')}
            aoApagar={() => notificar('Lista desligada')}
          />
        </section>

        <div id="minhas-listas"><MinhasListas aviso={notificar} /></div>

        <section className="ajustes-bloco" id="addons">
          <h2>Addons &amp; Debrid (Protocolo Stremio)</h2>
          <p>
            Instale addons compatíveis com o protocolo Stremio e configure contas Debrid (TorBox, Real-Debrid,
            AllDebrid, Premiumize) diretamente neste navegador, sem passar pelos servidores do Saimo.
          </p>
          <p style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.72)' }}>
            {addons.filter((a) => a.enabled).length} addon(s) ativo(s) ·{' '}
            {debridAccounts.filter((d) => d.enabled).length} conta(s) Debrid ativa(s)
          </p>
          <div className="ajustes-botoes">
            <button type="button" className="ajustes-botao" onClick={() => setAddonsAberto(true)}>
              Gerenciar Addons e Debrid
            </button>
          </div>
        </section>

        <AddonsModal aberta={addonsAberto} aoFechar={() => setAddonsAberto(false)} />

        {!perfil.kids && (
          <section className="ajustes-bloco" id="conta">
            <h2>Conta Saimo</h2>
            <ContaSaimo />
          </section>
        )}

        <section className="ajustes-bloco" id="perfis">
          <h2>Perfis</h2>
          <p>
            Cada perfil tem os seus favoritos, o que está assistindo e os recentes. As listas, as fontes e estes
            ajustes valem para todos. Até 10 perfis.
          </p>
          <div className="ajustes-perfil">
            <Avatar perfil={perfil} tamanho={56} />
            <div>
              <strong>{perfil.nome}</strong>
              <span>{listaPerfis().length === 1 ? 'Único perfil' : `Perfil em uso, de ${listaPerfis().length}`}</span>
            </div>
          </div>
          <div className="ajustes-botoes">
            <button className="ajustes-botao" onClick={() => abrirEscolha()}>Trocar de perfil</button>
            <button className="ajustes-botao" onClick={() => abrirEscolha('gerenciar')}>Gerenciar perfis</button>
          </div>
          <p>Ao abrir, com mais de um perfil:</p>
          <div className="pilulas">
            <button className={perguntarAoAbrir() ? 'on' : ''} onClick={() => definirPerguntar(true)}>Perguntar quem está assistindo</button>
            <button className={!perguntarAoAbrir() ? 'on' : ''} onClick={() => definirPerguntar(false)}>Entrar no último perfil</button>
          </div>
        </section>

        <section className="ajustes-bloco">
          <h2>Ao iniciar</h2>
          <p>O que o site abre quando você entra.</p>
          <div className="pilulas">
            <button className={aoIniciar === 'inicio' ? 'on' : ''} onClick={() => setAoIniciar('inicio')}>Início</button>
            <button className={aoIniciar === 'ultimo' ? 'on' : ''} onClick={() => setAoIniciar('ultimo')}>Último canal assistido</button>
          </div>
        </section>

        <section className="ajustes-bloco">
          <h2>Super Resolução (Upscaling)</h2>
          <p>Reconstrói bordas e realça a nitidez do vídeo em tempo real (HD → Full HD e Full HD → 4K).</p>
          <div className="pilulas">
            <button className={upscaling === 'off' ? 'on' : ''} onClick={() => alterarUpscaling('off')}>Desligado</button>
            <button className={upscaling === 'hd' ? 'on' : ''} onClick={() => alterarUpscaling('hd')}>Nitidez HD (720p → Full HD)</button>
            <button className={upscaling === '4k' ? 'on' : ''} onClick={() => alterarUpscaling('4k')}>Super Resolução Ultra (Full HD → 4K)</button>
          </div>
        </section>

        <section className="ajustes-bloco">
          <h2>Áudio Inteligente (Nivelar Volume)</h2>
          <p>Nivela dinamicamente o volume entre diferentes canais e fontes, eliminando discrepâncias sonoras.</p>
          <div className="pilulas">
            <button className={audioInteligente ? 'on' : ''} onClick={() => alterarAudioInteligente(true)}>Ligado</button>
            <button className={!audioInteligente ? 'on' : ''} onClick={() => alterarAudioInteligente(false)}>Desligado</button>
          </div>
        </section>

        <section className="ajustes-bloco">
          <h2>Zero Delay (Menor Atraso ao Vivo)</h2>
          <p>Reduz o atraso da transmissão para acompanhar eventos esportivos e notícias no tempo real mais próximo do estádio/emissora.</p>
          <div className="pilulas">
            <button className={zeroDelay === 'off' ? 'on' : ''} onClick={() => alterarZeroDelay('off')}>
              Desligado
            </button>
            <button className={zeroDelay === 'equilibrado' ? 'on' : ''} onClick={() => alterarZeroDelay('equilibrado')}>
              Equilibrado
            </button>
            <button className={zeroDelay === 'agressivo' ? 'on' : ''} onClick={() => alterarZeroDelay('agressivo')}>
              Agressivo (Ultra)
            </button>
          </div>
          {zeroDelay === 'agressivo' && (
            <p className="ajustes-dica" style={{ fontSize: '0.85rem', color: '#ffaa00', marginTop: '8px' }}>
              <IconeMaterial nome="raio" /> <strong>Modo Agressivo:</strong> Cola na ponta máxima da transmissão ignorando margens de segurança. Busca estar o mais ao vivo possível sem recuo automático.
            </p>
          )}
          {zeroDelay === 'equilibrado' && (
            <p className="ajustes-dica" style={{ fontSize: '0.85rem', color: '#4ade80', marginTop: '8px' }}>
              ✓ <strong>Modo Equilibrado:</strong> Reduz o atraso consideravelmente com perseguição suave e proteção inteligente contra travamentos.
            </p>
          )}
        </section>

        <section className="ajustes-bloco">
          <h2>Exportar canais e importar catálogo (.txt)</h2>
          <p>Exporte seus canais favoritos em .m3u, ou importe um catálogo .txt no formato do Saimo. Para uma lista .m3u use "Minhas listas".</p>
          <div className="ajustes-botoes">
            <button className="ajustes-botao" onClick={handleExportarTodos}>Exportar todos os canais (M3U)</button>
            <button className="ajustes-botao" onClick={handleExportarFavoritos}>Exportar favoritos (M3U)</button>
            <button className="ajustes-botao destaque" onClick={() => fileInputRef.current?.click()}>
              Importar catálogo (.txt)
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            {personalizados.length > 0 && (
              <button
                className="ajustes-botao perigo"
                onClick={() => {
                  limparPersonalizados();
                  notificar('Canais importados removidos.');
                }}
              >
                Limpar {personalizados.length} canais importados
              </button>
            )}
          </div>
        </section>

        <section className="ajustes-bloco">
          <h2>Tela</h2>
          <label className="ajustes-brilho">
            <span>Brilho do app: <strong>{brilhoApp}%</strong></span>
            <input type="range" min={0} max={100} step={5} value={brilhoApp}
              onChange={(e) => setBrilhoApp(Number(e.target.value))}
              onPointerUp={() => definirBrilho(brilhoApp)} onKeyUp={() => definirBrilho(brilhoApp)} />
          </label>
          <p className="ajustes-dica">Em 0% a tela fica preta: qualquer tecla ou clique volta ao normal.</p>
        </section>

        <section className="ajustes-bloco">
          <h2>Dados deste perfil</h2>
          <div className="ajustes-botoes">
            {LIMPAR.map((l) => (
              <button key={l.rotulo} className="ajustes-botao" onClick={() => limparDados(l.chaves, l.aviso)}>{l.rotulo}</button>
            ))}
          </div>
        </section>

        <section className="ajustes-bloco">
          <h2>Mais</h2>
          <div className="ajustes-botoes">
            <button className="ajustes-botao" onClick={() => navigate('/app')}>Baixar o app (TV Box, Roku, Smart TVs, celular, PC/Mac)</button>
            <button className="ajustes-botao" onClick={() => navigate('/novidades')}>Novidades</button>
            <button type="button" className="ajustes-botao destaque" onClick={abrirModalDoacao}>Apoiar o projeto ❤️</button>
            <a className="ajustes-botao" href="https://discord.gg/BrWbQQhfh7" target="_blank" rel="noreferrer noopener">Comunidade no Discord</a>
            {listas.canais && (
              <a className="ajustes-botao" href={`${listas.canais}catalogo.txt`} target="_blank" rel="noreferrer noopener">Lista de canais (texto)</a>
            )}
          </div>
        </section>

        <ControleParental />
      </div>
    </div>
  );
}
