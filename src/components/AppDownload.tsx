import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buscarVersao, type Plataforma, type Versao } from '../services/versao';
import { descreverAparelho } from '../services/telemetria';
import { BarraTopo } from './BarraTopo';
import './AppDownload.css';

/**
 * Download dos apps: TV Box, celular e Mac, com o do aparelho já escolhido.
 *
 * Os links e a versão vêm do versao.json publicado (services/versao.ts): a
 * página nunca aponta para versão velha e não sabe em que GitHub os arquivos
 * moram. Sem o arquivo, o botão vira "Tentar novamente" em vez de ficar morto.
 */

/** Código do Saimo TV no app Downloader (AFTVnews): digitar no lugar do endereço. */
const CODIGO_DOWNLOADER = '1506768';

type AppId = 'tvbox' | 'cell' | 'roku' | 'samsung' | 'lg' | 'windows' | 'linux' | 'mac' | 'ios';

interface App {
  id: AppId;
  aba: string;
  titulo: string;
  subtitulo: string;
  arquivo: string;
  /** Caminho curto no próprio site (public/_redirects), para digitar na TV. */
  atalho: string;
  botao: string;
  requisitos: string[];
  passos: { titulo: string; texto: string }[];
  /** Ainda não foi lançado: a aba mostra o aviso "em breve" em vez do download. */
  emBreve?: boolean;
}

const APPS: App[] = [
  {
    id: 'ios',
    aba: 'iPhone',
    titulo: 'Saimo para iPhone e iPad',
    subtitulo: 'Em breve na App Store',
    arquivo: '',
    atalho: '/app',
    botao: '',
    emBreve: true,
    requisitos: ['iPhone ou iPad com iOS 16 ou mais novo', 'Conexão com a internet'],
    passos: [],
  },
  {
    id: 'tvbox',
    aba: 'TV Box',
    titulo: 'Saimo TV para TV Box',
    subtitulo: 'Android TV, Fire TV Stick, Mi Box, Chromecast com Google TV e TV Box Android',
    arquivo: 'SaimoTV.apk',
    atalho: '/tvbox',
    botao: 'Baixar para TV Box',
    requisitos: ['Android 5.0 ou mais novo', 'Controle remoto com setas e OK', 'Conexão com a internet'],
    passos: [
      { titulo: 'Instale o Downloader', texto: 'Na loja do aparelho (Play Store ou Amazon Appstore), procure por “Downloader” e instale.' },
      { titulo: 'Digite o código ou o endereço', texto: `Abra o Downloader e digite o código ${CODIGO_DOWNLOADER} (ou o endereço curto mostrado acima). O download começa sozinho.` },
      { titulo: 'Permita a instalação', texto: 'Se o aparelho pedir, ative “Instalar apps desconhecidos” para o Downloader.' },
      { titulo: 'Pronto', texto: 'Instale e abra o Saimo TV. As próximas versões são oferecidas dentro do próprio app.' },
    ],
  },
  {
    id: 'cell',
    aba: 'Celular',
    titulo: 'Saimo TV para celular',
    subtitulo: 'Celulares e tablets Android',
    arquivo: 'SaimoCell.apk',
    atalho: '/celular',
    botao: 'Baixar para celular',
    requisitos: ['Android 7.0 ou mais novo', 'Cerca de 90 MB livres', 'Conexão com a internet'],
    passos: [
      { titulo: 'Baixe o APK', texto: 'Toque no botão acima. O navegador pode avisar que o arquivo é um app: confirme o download.' },
      { titulo: 'Abra o arquivo', texto: 'Toque na notificação de download concluído, ou abra o arquivo pela pasta Downloads.' },
      { titulo: 'Permita a instalação', texto: 'Se o Android pedir, ative “Permitir desta fonte” para o navegador e volte.' },
      { titulo: 'Pronto', texto: 'Instale e abra o Saimo TV. As próximas versões são oferecidas dentro do próprio app.' },
    ],
  },
  {
    id: 'roku',
    aba: 'Roku',
    titulo: 'Saimo TV para Roku',
    subtitulo: 'TVs Roku (TCL, AOC, Philips, Philco, Semp…) e aparelhos Roku Express / Premiere / Streaming Stick',
    arquivo: 'SaimoTV-Roku.zip',
    atalho: '/roku',
    botao: 'Baixar para Roku',
    requisitos: ['TV Roku ou dispositivo Roku (Express, Premiere, Stick)', 'Modo desenvolvedor ativo na TV Roku', 'Computador ou celular na mesma rede Wi-Fi'],
    passos: [
      { titulo: 'Ative o modo desenvolvedor na TV', texto: 'No controle da TV, aperte a sequência: Home 3x › Cima 2x › Direita 1x › Esquerda 1x › Direita 1x › Esquerda 1x › Direita 1x. Ative o Developer Mode, defina uma senha e anote o IP exibido na tela.' },
      { titulo: 'Baixe o pacote do canal', texto: 'Clique no botão acima para baixar o arquivo SaimoTV-Roku.zip no computador ou celular.' },
      { titulo: 'Acesse o instalador da TV', texto: 'No navegador do computador ou celular na mesma rede Wi-Fi, acesse http://IP-DA-TV (ex: http://192.168.1.50). Digite o usuário rokudev e a senha que você definiu.' },
      { titulo: 'Envie e instale', texto: 'Na página do Roku, clique em “Upload”, selecione o SaimoTV-Roku.zip e clique em “Install”. O Saimo TV abrirá instantaneamente na sua TV!' },
    ],
  },
  {
    id: 'windows',
    aba: 'Windows',
    titulo: 'Saimo TV para Windows',
    subtitulo: 'PC e notebook com Windows 10 ou 11 (64 bits)',
    arquivo: 'SaimoTV-Windows.zip',
    atalho: '/windows',
    botao: 'Baixar para Windows',
    requisitos: ['Windows 10 ou 11, 64 bits', 'Cerca de 150 MB livres', 'Conexão com a internet'],
    passos: [
      { titulo: 'Baixe o arquivo', texto: 'Clique no botão acima. O navegador pode avisar que o arquivo é pouco baixado: mande manter.' },
      { titulo: 'Extraia o arquivo', texto: 'Clique com o botão direito no “SaimoTV-Windows.zip” baixado e escolha "Extrair Tudo..." para descompactar a pasta.' },
      { titulo: 'Rode o aplicativo', texto: 'Abra a pasta extraída e dê um duplo clique em “Saimo TV.exe”. Mantenha os arquivos .dll na mesma pasta do executável.' },
      { titulo: 'Se o Windows avisar', texto: 'Na tela do Windows Defender, clique em “Mais informações” e depois em “Executar assim mesmo”. Se pedir DLL, clique com o botão direito na DLL > Propriedades > marque "Desbloquear".' },
    ],
  },
  {
    id: 'linux',
    aba: 'Linux',
    titulo: 'Saimo TV para Linux',
    subtitulo: 'PC e notebook com Linux: o mesmo app do Windows, com a mesma tela',
    arquivo: 'SaimoTV-Linux-x86_64.AppImage',
    atalho: '/linux',
    botao: 'Baixar para Linux',
    requisitos: ['Distribuição de 2022 para cá (Ubuntu 22.04, Debian 12, Fedora 36, Mint 21 ou mais novo)', 'PC comum (x86_64) ou ARM (aarch64)', 'Cerca de 200 MB livres', 'Conexão com a internet'],
    passos: [
      { titulo: 'Baixe o AppImage', texto: 'Clique no botão acima. Ele roda em qualquer distribuição e já traz o reprodutor de vídeo junto.' },
      { titulo: 'Permita executar', texto: 'Clique com o botão direito no arquivo › Propriedades › marque “Permitir executar como programa”. No terminal: chmod +x SaimoTV-Linux-x86_64.AppImage' },
      { titulo: 'Abra o Saimo TV', texto: 'Dê um duplo clique no arquivo. O app avisa quando sair versão nova e abre o download no navegador.' },
      { titulo: 'Prefere instalar?', texto: 'No Ubuntu, Debian, Mint e Pop!_OS, baixe o .deb (link abaixo do botão) e abra com a Central de Programas, ou: sudo apt install ./SaimoTV-Linux-amd64.deb' },
    ],
  },
  {
    id: 'mac',
    aba: 'Mac',
    titulo: 'Saimo TV para Mac',
    subtitulo: 'Macs com chip Apple (M1, M2, M3, M4…)',
    arquivo: 'SaimoTV.dmg',
    atalho: '/mac',
    botao: 'Baixar para Mac',
    requisitos: ['macOS 15 Sequoia ou mais novo', 'Mac com chip Apple (não roda em Mac Intel)', 'Conexão com a internet'],
    passos: [
      { titulo: 'Baixe o DMG', texto: 'Clique no botão acima. O arquivo vai para a pasta Downloads.' },
      { titulo: 'Arraste para Aplicativos', texto: 'Abra o SaimoTV.dmg e arraste o Saimo TV para a pasta Aplicativos, substituindo o antigo se houver.' },
      { titulo: 'Libere na primeira abertura', texto: 'Se o macOS disser que não pode verificar o app, vá em Ajustes do Sistema › Privacidade e Segurança e clique em “Abrir Mesmo Assim”.' },
      { titulo: 'Pronto', texto: 'O app avisa quando sair versão nova e abre o download no navegador.' },
    ],
  },
  {
    id: 'samsung',
    aba: 'Samsung',
    titulo: 'Saimo TV para TV Samsung',
    subtitulo: 'Smart TVs Samsung (Tizen) de 2020 em diante',
    arquivo: 'SaimoTV-Samsung.wgt',
    atalho: '/samsung',
    botao: 'Baixar para Samsung',
    requisitos: ['TV Samsung de 2020 ou mais nova', 'Modo desenvolvedor ligado na TV', 'Um computador na mesma rede para instalar'],
    passos: [
      { titulo: 'Ligue o modo desenvolvedor', texto: 'Na TV, abra Apps, digite 12345 no controle, ligue “Developer mode” e informe o IP do seu computador. Reinicie a TV.' },
      { titulo: 'Baixe o arquivo', texto: 'Baixe o SaimoTV-Samsung.wgt no computador pelo botão acima.' },
      { titulo: 'Assine e instale', texto: 'No Tizen Studio (ou em um instalador de .wgt), gere o certificado Samsung com o ID da sua TV, assine o pacote e instale pelo sdb: sdb connect IP-DA-TV e tizen install -n SaimoTV-Samsung.wgt -t NOME-DA-TV.' },
      { titulo: 'Pronto', texto: 'Abra o Saimo TV em Apps. O conteúdo do app atualiza sozinho: só é preciso reinstalar quando o aviso pedir.' },
    ],
  },
  {
    id: 'lg',
    aba: 'LG',
    titulo: 'Saimo TV para TV LG',
    subtitulo: 'Smart TVs LG (webOS) de 2020 em diante',
    arquivo: 'SaimoTV-LG.ipk',
    atalho: '/lg',
    botao: 'Baixar para LG',
    requisitos: ['TV LG de 2020 ou mais nova', 'Conta LG e o app “Developer Mode” da TV', 'Um computador na mesma rede para instalar'],
    passos: [
      { titulo: 'Ligue o modo desenvolvedor', texto: 'Na TV, instale o app “Developer Mode” pela LG Content Store, entre com a conta LG e ligue “Dev Mode Status” e “Key Server”.' },
      { titulo: 'Baixe o arquivo', texto: 'Baixe o SaimoTV-LG.ipk no computador pelo botão acima.' },
      { titulo: 'Instale', texto: 'Com o ares-cli: ares-setup-device (cadastre a TV), ares-novacom --device TV --getkey e ares-install --device TV SaimoTV-LG.ipk.' },
      { titulo: 'Renove de tempos em tempos', texto: 'O modo desenvolvedor da LG expira em cerca de 50 horas. Abra o app “Developer Mode” e toque em “Extend” para manter o Saimo TV instalado.' },
    ],
  },
];

interface Deteccao {
  recomendado: AppId | null;
  aparelho: string;
  aviso: string | null;
}

/** Mac Intel não roda o app; a placa de vídeo que o WebGL anuncia entrega. */
function macIntel(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    const placa = ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    return /Intel|AMD|Radeon/i.test(placa);
  } catch {
    return false;
  }
}

function detectar(): Deteccao {
  const ua = navigator.userAgent;
  const toques = navigator.maxTouchPoints || 0;
  const { deviceType, model, os } = descreverAparelho(ua, toques);
  const aparelho =
    model.startsWith('Amazon AFT') ? `Fire TV (${model.slice(7)})` :
    model && model !== 'Desconhecido' ? `${model}${os && os !== 'outro' ? ` · ${os}` : ''}` :
    'este aparelho';

  if (/Tizen/i.test(ua)) {
    return { recomendado: 'samsung', aparelho,
      aviso: 'Para instalar o app numa TV Samsung é preciso um computador e o modo desenvolvedor da TV (passos abaixo). Sem isso, assista por este site.' };
  }
  if (/Web0S|webOS|NetCast/i.test(ua)) {
    return { recomendado: 'lg', aparelho,
      aviso: 'Para instalar o app numa TV LG é preciso um computador e o modo desenvolvedor da TV (passos abaixo). Sem isso, assista por este site.' };
  }
  if (/Roku/i.test(ua)) {
    return { recomendado: 'roku', aparelho,
      aviso: 'Para instalar o canal Saimo TV no Roku é preciso um computador ou celular na mesma rede para ativar o modo desenvolvedor (passos abaixo).' };
  }
  if (deviceType === 'tv') return { recomendado: 'tvbox', aparelho, aviso: null };
  // Navegador de TV Box Android costuma se anunciar como tablet ("Android 9; X96",
  // sem "Mobile"), mas tablet tem tela de toque e TV Box não.
  if (/Android/.test(ua) && !/Mobile/.test(ua) && toques === 0) {
    return { recomendado: 'tvbox', aparelho, aviso: null };
  }
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && toques > 1)) {
    return { recomendado: 'ios', aparelho,
      aviso: 'O app para iPhone e iPad está chegando em breve. Enquanto isso, assista por este site: no Safari, toque em Compartilhar › Adicionar à Tela de Início para abrir como app.' };
  }
  if (/Android/.test(ua)) return { recomendado: 'cell', aparelho, aviso: null };
  if (/Windows/.test(ua)) return { recomendado: 'windows', aparelho, aviso: null };
  if (/Macintosh|Mac OS X/.test(ua)) {
    return { recomendado: 'mac', aparelho,
      aviso: macIntel() ? 'Este Mac parece ter processador Intel, e o app só roda em Mac com chip Apple. Neste caso, assista por este site.' : null };
  }
  if (/Linux|X11|CrOS/.test(ua)) {
    return { recomendado: 'linux', aparelho,
      aviso: /CrOS/.test(ua) ? 'No Chromebook, o app de Linux roda com o Linux ativado (Configurações › Desenvolvedores). Sem ele, assista por este site.' : null };
  }
  return { recomendado: null, aparelho, aviso: null };
}

const PLATAFORMA: Partial<Record<AppId, Plataforma>> = { tvbox: 'tvbox', cell: 'celular', mac: 'mac', windows: 'windows', linux: 'linux', samsung: 'tizen', lg: 'webos', roku: 'roku' };

/** O navegador conta quando o Linux é ARM (Raspberry Pi, notebooks ARM). */
function linuxArm(): boolean {
  return /aarch64|arm64|armv8/i.test(navigator.userAgent);
}

/** Os outros pacotes do Linux, mostrados embaixo do botão. */
const OUTROS_LINUX: { plataforma: Plataforma; rotulo: string }[] = [
  { plataforma: 'linux-deb', rotulo: '.deb para Ubuntu, Debian e Mint' },
  { plataforma: 'linux-arm64', rotulo: 'AppImage para ARM' },
  { plataforma: 'linux-deb-arm64', rotulo: '.deb para ARM' },
  { plataforma: 'linux', rotulo: 'AppImage para PC comum (x86_64)' },
];

function megas(bytes?: number): string {
  return bytes ? `${Math.round(bytes / 1024 / 1024)} MB` : '';
}

function Icone({ id }: { id: AppId }) {
  const comum = {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
  };
  if (id === 'tvbox') {
    return <svg {...comum}><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>;
  }
  if (id === 'ios') {
    return <svg {...comum}><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M10 5h4" /><path d="M9.5 13.5 12 11l2.5 2.5M12 11v5" /></svg>;
  }
  if (id === 'cell') {
    return <svg {...comum}><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></svg>;
  }
  if (id === 'roku') {
    return (
      <svg {...comum}>
        <rect x="2" y="4" width="20" height="13" rx="2" />
        <path d="M8 21h8M12 17v4" />
        <path d="M9.5 8h2.5a2 2 0 0 1 0 4H9.5V8Zm2.5 4 2 3" />
      </svg>
    );
  }
  if (id === 'samsung' || id === 'lg') {
    return <svg {...comum}><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4M9 10.5l2 2 4-4" /></svg>;
  }
  if (id === 'windows') {
    return <svg {...comum}><path d="M3 6.5 10.5 5.2v6.3H3V6.5Zm0 11 7.5 1.3v-6.2H3v4.9Zm9.5 1.6L21 20.5v-8.7h-8.5v7.3ZM12.5 4.9 21 3.5v7.3h-8.5V4.9Z" /></svg>;
  }
  return <svg {...comum}><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M1 20h22" /></svg>;
}

export function AppDownload() {
  const navigate = useNavigate();
  const deteccao = useMemo(() => detectar(), []);
  const [aba, setAba] = useState<AppId>(deteccao.recomendado ?? 'tvbox');
  const [lancamento, setLancamento] = useState<Versao | null>(null);
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro'>('carregando');
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vivo = true;
    setEstado('carregando');
    buscarVersao().then(v => {
      if (!vivo) return;
      setLancamento(v);
      setEstado(v ? 'pronto' : 'erro');
    });
    return () => { vivo = false; };
  }, [tentativa]);

  const app = APPS.find(a => a.id === aba)!;
  const linkCurto = `${window.location.host}${app.atalho}`;
  const plataforma = app.id === 'linux' && linuxArm() ? 'linux-arm64' : PLATAFORMA[app.id];
  const arquivo = plataforma ? lancamento?.arquivos[plataforma] : undefined;
  const detalhes = [
    lancamento ? `Versão ${lancamento.versao}` : '',
    megas(arquivo?.bytes),
  ].filter(Boolean).join(' · ');

  return (
    <div className="app-download-page">
      <BarraTopo />
      <div className="download-bg" aria-hidden="true">
        <div className="gradient-orb orb-1" />
        <div className="gradient-orb orb-2" />
      </div>

      <header className="download-header">
        <button className="back-link" onClick={() => navigate('/')} data-focusable="true" data-focus-key="download-back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Voltar</span>
        </button>
      </header>

      <main className="download-main">
        <section className="download-hero">
          <h1>Baixe o Saimo<span>TV</span></h1>
          <p>Grátis e sem cadastro. Escolha onde vai assistir.</p>
          <p className="download-detected">Você está em: <strong>{deteccao.aparelho}</strong></p>
          {deteccao.aviso && <p className="download-aviso">{deteccao.aviso}</p>}
        </section>

        <div className="download-tabs" role="tablist" aria-label="Escolha o aparelho">
          {APPS.map(a => (
            <button
              key={a.id}
              role="tab"
              aria-selected={aba === a.id}
              className={`download-tab ${aba === a.id ? 'active' : ''}`}
              onClick={() => setAba(a.id)}
              data-focusable="true"
              data-focus-key={`download-tab-${a.id}`}
            >
              <span className="download-tab-icon"><Icone id={a.id} /></span>
              <span className="download-tab-label">{a.aba}</span>
              {deteccao.recomendado === a.id && <span className="download-badge">Seu aparelho</span>}
            </button>
          ))}
        </div>

        <section className="download-card" role="tabpanel">
          <div className="download-card-top">
            <div className="download-card-icon"><Icone id={app.id} /></div>
            <div>
              <h2>{app.titulo}</h2>
              <p>{app.subtitulo}</p>
            </div>
          </div>

          {app.emBreve ? (
            <div className="download-embreve" role="status">
              <span className="download-embreve-selo"><i aria-hidden="true" /> Em breve</span>
              <p>O Saimo para iPhone e iPad está a caminho da App Store. Quando sair, o botão de download aparece aqui.</p>
              <p className="download-embreve-dica">Enquanto isso, o Saimo funciona direto no navegador: no Safari, toque em Compartilhar › Adicionar à Tela de Início.</p>
            </div>
          ) : arquivo ? (
            <a
              className="download-button"
              href={arquivo.url}
              rel="noopener"
              data-focusable="true"
              data-focus-key="download-button"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>{app.botao}</span>
            </a>
          ) : (
            <button
              type="button"
              className="download-button"
              disabled={estado === 'carregando'}
              onClick={() => setTentativa(t => t + 1)}
              data-focusable="true"
              data-focus-key="download-button"
            >
              <span>{estado === 'carregando' ? 'Carregando…' : 'Não consegui buscar o download. Tentar novamente'}</span>
            </button>
          )}
          {!app.emBreve && detalhes && <p className="download-meta">{detalhes}</p>}

          {!app.emBreve && <p className="download-short">
            {app.id === 'tvbox' ? 'No Downloader, digite:' : 'Para baixar em outro aparelho, abra:'} <code>{linkCurto}</code>
          </p>}
          {app.id === 'tvbox' && (
            <p className="download-short">
              Ou, no Downloader, digite o código: <code>{CODIGO_DOWNLOADER}</code>
            </p>
          )}
          {app.id === 'roku' && (
            <p className="download-short">
              Canal nativo oficial: rápido, leve e com suporte total ao controle remoto do Roku.
            </p>
          )}
          {app.id === 'windows' && (
            <p className="download-short">
              Aplicativo de verdade, não é o site numa janela: a lista, o guia e o vídeo rodam no próprio PC.
            </p>
          )}
          {app.id === 'linux' && (
            <p className="download-short">
              Também em:{' '}
              {OUTROS_LINUX.filter(o => o.plataforma !== plataforma && lancamento?.arquivos[o.plataforma]).map((o, i, lista) => (
                <span key={o.plataforma}>
                  <a href={lancamento!.arquivos[o.plataforma]!.url} rel="noopener" data-focusable="true">{o.rotulo}</a>
                  {i < lista.length - 1 ? ' · ' : ''}
                </span>
              ))}
            </p>
          )}

          <div className="download-columns">
            {app.passos.length > 0 && <div>
              <h3>Como instalar</h3>
              <ol className="install-steps">
                {app.passos.map((p, i) => (
                  <li key={p.titulo}>
                    <span className="step-number">{i + 1}</span>
                    <div>
                      <strong>{p.titulo}</strong>
                      <p>{p.texto}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>}
            <div>
              <h3>Requisitos</h3>
              <ul className="requirements">
                {app.requisitos.map(r => <li key={r}>{r}</li>)}
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
