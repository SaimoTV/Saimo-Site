/**
 * Saimo Connect nas TVs Samsung e LG.
 *
 * Na TV Box, no Mac e no Windows a TV abre a porta 8999 e o celular entra. App
 * web de TV não pode abrir porta, então aqui é ao contrário: o celular abre a
 * porta e a TV se liga a ele (ws://<celular>:8999/tv). Depois de ligados, a
 * conversa é a mesma do Connect de sempre: o celular manda `hello` e comandos
 * (`key`, `text`, `tune`, `abrir`, `volume`…), a TV responde `welcome`,
 * `pong` e `state`.
 *
 * Como a TV sabe o endereço do celular:
 * - o celular abre o Saimo na TV pelo controle oficial da marca (LG: protocolo
 *   SSAP; Samsung: controle remoto por WebSocket) e manda junto
 *   `saimoConnect=<ip>:<porta>`; a TV lê na abertura (ou ao ser reaberta);
 * - o último celular fica guardado: ao abrir de novo, a TV tenta ele primeiro.
 *
 * Sem servidor nenhum no meio: nada passa pela nuvem, só pela rede de casa.
 */
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ehTv, marcaTv } from '../plataforma/tv';

const CHAVE_ULTIMO = 'saimo-connect-celular';
const PARAMETRO = 'saimoConnect';

type Msg = Record<string, unknown> & { t?: string };

interface JanelaTv {
  PalmSystem?: { launchParams?: string };
  tizen?: {
    application?: {
      getCurrentApplication?: () => {
        getRequestedAppControl?: () => { appControl?: { data?: { key: string; value: string[] }[] } } | null;
      };
    };
  };
}

/** Só endereço de rede local (ip:porta): nada de mandar a TV para fora de casa. */
function enderecoValido(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = /^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{2,5}))?$/.exec(v.trim());
  if (!m) return null;
  const ip = m[1];
  const local = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) || (import.meta.env.DEV && ip === '127.0.0.1');
  if (!local) return null;
  return `${ip}:${m[2] ?? '8999'}`;
}

/** O endereço que veio na abertura do app (LG: launchParams; Samsung: AppControl PAYLOAD). */
function enderecoDaAbertura(): string | null {
  const w = window as unknown as JanelaTv;
  try {
    const p = w.PalmSystem?.launchParams;
    if (p) {
      const j = JSON.parse(p) as Record<string, string>;
      const e = enderecoValido(j[PARAMETRO]);
      if (e) return e;
    }
  } catch { /* sem parâmetros */ }
  try {
    const dados = w.tizen?.application?.getCurrentApplication?.()?.getRequestedAppControl?.()?.appControl?.data ?? [];
    for (const d of dados) {
      for (const valor of d.value ?? []) {
        // PAYLOAD vem como {"values":"saimoConnect=ip:porta"} (metaTag do controle remoto).
        let texto = valor;
        try { texto = (JSON.parse(valor) as { values?: string }).values ?? valor; } catch { /* texto puro */ }
        const m = new RegExp(`${PARAMETRO}=([\\d.:]+)`).exec(texto);
        const e = enderecoValido(m?.[1]);
        if (e) return e;
      }
    }
  } catch { /* sem AppControl */ }
  // Teste no navegador: ?saimoConnect=192.168.0.10:8999
  try {
    return enderecoValido(new URLSearchParams(location.search).get(PARAMETRO));
  } catch {
    return null;
  }
}

function idDaTv(): string {
  try {
    let id = localStorage.getItem('saimo-telemetria-id') || '';
    if (!id) {
      id = `tv-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem('saimo-telemetria-id', id);
    }
    return id;
  } catch {
    return 'tv';
  }
}

function nomeDaTv(): string {
  const marca = marcaTv();
  return marca === 'webos' ? 'TV LG' : marca === 'tizen' ? 'TV Samsung' : 'Saimo TV';
}

/** Tecla como o controle da TV mandaria (o D-pad do app trata igual). */
function apertar(key: string, keyCode: number): boolean {
  const alvo = document.activeElement ?? document.body;
  const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  Object.defineProperty(evento, 'keyCode', { get: () => keyCode });
  const tratado = !alvo.dispatchEvent(evento);
  alvo.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
  // OK num botão que ninguém tratou: clica, como o controle faria.
  if (!tratado && key === 'Enter' && alvo instanceof HTMLElement && alvo !== document.body) alvo.click();
  return tratado;
}

const TECLAS: Record<string, [string, number]> = {
  UP: ['ArrowUp', 38], DOWN: ['ArrowDown', 40], LEFT: ['ArrowLeft', 37], RIGHT: ['ArrowRight', 39],
  OK: ['Enter', 13], BACK: ['Escape', 27], DEL: ['Backspace', 8],
  CH_UP: ['ChannelUp', 427], CH_DOWN: ['ChannelDown', 428],
  PLAY: ['MediaPlayPause', 10252],
};

const TELAS: Record<string, string> = {
  inicio: '/home', aovivo: '/tv', ondemand: '/movies', eventos: '/eventos',
  radios: '/radios', busca: '/busca', ajustes: '/ajustes', favoritos: '/favoritos',
};

/** Escreve no campo em foco (busca, endereço de lista…), como se digitasse. */
function escrever(valor: string): void {
  const el = document.activeElement;
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
  const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, valor);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function video(): HTMLVideoElement | null {
  return document.querySelector('video');
}

export function ConnectTv() {
  // O navigate muda a cada troca de tela: a ligação com o celular não pode cair junto.
  const nav = useNavigate();
  const navegar = useRef(nav);
  useEffect(() => { navegar.current = nav; }, [nav]);
  const { pathname } = useLocation();

  useEffect(() => {
    if (!ehTv() && !new URLSearchParams(location.search).has(PARAMETRO)) return;
    let ws: WebSocket | null = null;
    let alvo: string | null = null;
    let autenticado = false;
    let tentativas = 0;
    let espera: ReturnType<typeof setTimeout> | undefined;
    let encerrado = false;

    const enviar = (m: Msg) => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
    };

    const estado = () => {
      const v = video();
      enviar({
        t: 'state',
        mode: v && !v.paused ? (location.pathname.startsWith('/tv') ? 'live' : 'vod') : 'idle',
        playing: !!v && !v.paused,
        screen: location.pathname.replace('/', '') || 'home',
        volume: v ? v.volume : 1,
        muted: v ? v.muted : false,
      });
    };
    (window as unknown as { __saimoConnectEstado?: () => void }).__saimoConnectEstado = estado;

    const navigate = (rota: string) => navegar.current(rota);
    const comando = (m: Msg) => {
      const t = String(m.t ?? '');
      if (t === 'key') {
        const code = String(m.code ?? '');
        if (code === 'HOME') navigate('/home');
        else if (/^\d$/.test(code)) apertar(code, 48 + Number(code));
        else if (TECLAS[code]) apertar(...TECLAS[code]);
      } else if (t === 'text') {
        escrever(String(m.value ?? ''));
      } else if (t === 'abrir') {
        const rota = TELAS[String(m.tela ?? '')];
        if (rota) navigate(rota);
      } else if (t === 'tune') {
        const canal = String(m.channel ?? '').trim();
        if (canal) navigate(`/tv/${encodeURIComponent(canal.replace(/\s+/g, ''))}`);
      } else if (t === 'volume') {
        const v = video();
        if (v) {
          if (typeof m.delta === 'number') v.volume = Math.min(1, Math.max(0, v.volume + (m.delta > 0 ? 0.1 : -0.1)));
          if (typeof m.set === 'number') v.volume = Math.min(1, Math.max(0, m.set));
          if (typeof m.mute === 'boolean') v.muted = m.mute;
        }
      } else if (t === 'seek') {
        const v = video();
        if (v && typeof m.delta === 'number') v.currentTime = Math.max(0, v.currentTime + m.delta);
        if (v && typeof m.to === 'number') v.currentTime = Math.max(0, m.to);
      } else if (t === 'play' || t === 'pause' || t === 'playPause') {
        const v = video();
        if (v) {
          if (t === 'pause' || (t === 'playPause' && !v.paused)) v.pause();
          else void v.play().catch(() => {});
        }
      } else if (t === 'busca') {
        navigate(`/busca?q=${encodeURIComponent(String(m.q ?? m.value ?? ''))}`);
      }
      setTimeout(estado, 300);
    };

    const aoReceber = (texto: string) => {
      let m: Msg;
      try { m = JSON.parse(texto) as Msg; } catch { return; }
      if (m.t === 'hello') {
        // O celular só chega aqui porque a pessoa mandou a TV se ligar a ele.
        autenticado = true;
        enviar({ t: 'welcome', tv: { id: idDaTv(), name: nomeDaTv(), plataforma: marcaTv() ?? 'web', reverso: true } });
        estado();
        return;
      }
      if (m.t === 'ping') {
        enviar({ t: 'pong', c0: m.c0, tv: Date.now() });
        return;
      }
      if (!autenticado) return;
      comando(m);
    };

    const ligar = (endereco: string) => {
      if (encerrado) return;
      alvo = endereco;
      clearTimeout(espera);
      try { ws?.close(); } catch { /* já fechado */ }
      autenticado = false;
      const s = new WebSocket(`ws://${endereco}/tv`);
      ws = s;
      s.onopen = () => {
        tentativas = 0;
        try { localStorage.setItem(CHAVE_ULTIMO, endereco); } catch { /* sem espaço */ }
        enviar({ t: 'tvhello', tv: { id: idDaTv(), name: nomeDaTv(), plataforma: marcaTv() ?? 'web' } });
      };
      s.onmessage = (e) => aoReceber(String(e.data));
      s.onclose = () => {
        if (ws !== s || encerrado) return;
        ws = null;
        // Celular saiu do app ou trocou de rede: tenta de novo, cada vez mais devagar, e para.
        if (++tentativas <= 6 && alvo) espera = setTimeout(() => alvo && ligar(alvo), Math.min(30000, 2000 * tentativas));
      };
    };

    const daAbertura = enderecoDaAbertura();
    let guardado: string | null = null;
    try { guardado = enderecoValido(localStorage.getItem(CHAVE_ULTIMO)); } catch { /* sem localStorage */ }
    const primeiro = daAbertura ?? guardado;
    if (primeiro) ligar(primeiro);

    // Já aberto e o celular manda abrir de novo (com o endereço dele).
    const aoReabrir = () => {
      const e = enderecoDaAbertura();
      if (e) ligar(e);
    };
    document.addEventListener('webOSRelaunch', aoReabrir);
    document.addEventListener('appcontrol', aoReabrir);
    const aoVoltarATela = () => {
      if (document.visibilityState === 'visible' && !ws && alvo) { tentativas = 0; ligar(alvo); }
    };
    document.addEventListener('visibilitychange', aoVoltarATela);

    return () => {
      encerrado = true;
      clearTimeout(espera);
      document.removeEventListener('webOSRelaunch', aoReabrir);
      document.removeEventListener('appcontrol', aoReabrir);
      document.removeEventListener('visibilitychange', aoVoltarATela);
      try { ws?.close(); } catch { /* já fechado */ }
    };
  }, []);

  // Trocou de tela: o celular fica sabendo.
  useEffect(() => {
    (window as unknown as { __saimoConnectEstado?: () => void }).__saimoConnectEstado?.();
  }, [pathname]);

  return null;
}
