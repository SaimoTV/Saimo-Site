/**
 * Saimo Connect na TV Samsung e LG (app nativo).
 *
 * O app de TV não pode abrir porta; então é o celular que abre a 8999 e a TV se
 * liga a ele (ws://<celular>:8999/tv). O celular abre o Saimo na TV pelo controle
 * oficial da marca (LG: SSAP; Samsung: controle remoto por WebSocket) mandando
 * `saimoConnect=<ip>:<porta>` (LG: launchParams; Samsung: AppControl). Depois é a
 * conversa de sempre do Connect: hello/welcome, ping/pong, state e os comandos
 * key, text, abrir, tune, volume, seek, play/pause e busca. Nada passa pela nuvem.
 */
import { State } from './State';
import { Platform } from './Platform';

const CHAVE_ULTIMO = 'saimo-connect-celular';
const PARAMETRO = 'saimoConnect';

type Msg = Record<string, unknown> & { t?: string };

/** Só endereço de rede local (ip:porta). */
function enderecoValido(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = /^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{2,5}))?$/.exec(v.trim());
  if (!m) return null;
  const ip = m[1];
  if (!/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) return null;
  return `${ip}:${m[2] ?? '8999'}`;
}

function enderecoDaAbertura(): string | null {
  const w = window as unknown as {
    PalmSystem?: { launchParams?: string };
    tizen?: { application?: { getCurrentApplication?: () => { getRequestedAppControl?: () => { appControl?: { data?: { key: string; value: string[] }[] } } | null } } };
  };
  try {
    const p = w.PalmSystem?.launchParams;
    if (p) {
      const e = enderecoValido((JSON.parse(p) as Record<string, string>)[PARAMETRO]);
      if (e) return e;
    }
  } catch { /* sem parâmetros */ }
  try {
    const dados = w.tizen?.application?.getCurrentApplication?.()?.getRequestedAppControl?.()?.appControl?.data ?? [];
    for (const d of dados) {
      for (const valor of d.value ?? []) {
        let texto = valor;
        try { texto = (JSON.parse(valor) as { values?: string }).values ?? valor; } catch { /* texto puro */ }
        const m = new RegExp(`${PARAMETRO}=([\\d.:]+)`).exec(texto);
        const e = enderecoValido(m?.[1]);
        if (e) return e;
      }
    }
  } catch { /* sem AppControl */ }
  try {
    return enderecoValido(new URLSearchParams(location.search).get(PARAMETRO));
  } catch {
    return null;
  }
}

function idDaTv(): string {
  try {
    let id = localStorage.getItem('saimo-telemetria-id') || '';
    if (!id) { id = `tv-${Math.random().toString(36).slice(2, 10)}`; localStorage.setItem('saimo-telemetria-id', id); }
    return id;
  } catch {
    return 'tv';
  }
}

const TECLAS: Record<string, number> = {
  UP: 38, DOWN: 40, LEFT: 37, RIGHT: 39, OK: 13, BACK: 10009, DEL: 8, CH_UP: 427, CH_DOWN: 428, PLAY: 10252,
};

/** A tecla chega ao app como se viesse do controle (o SpatialNav e as telas ouvem na janela). */
function apertar(codigo: number) {
  for (const tipo of ['keydown', 'keyup']) {
    const e = new KeyboardEvent(tipo, { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'keyCode', { get: () => codigo });
    Object.defineProperty(e, 'which', { get: () => codigo });
    window.dispatchEvent(e);
  }
}

const TELAS: Record<string, string> = {
  inicio: 'home', aovivo: 'live', ondemand: 'ondemand', eventos: 'events', radios: 'radios',
  busca: 'search', ajustes: 'settings', favoritos: 'favorites',
};

function video(): HTMLVideoElement | null {
  return document.getElementById('tv-video') as HTMLVideoElement | null;
}

function escrever(valor: string) {
  const el = document.activeElement;
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
  el.value = valor;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

export function iniciarConnectTv() {
  if (!Platform.isWebOS && !Platform.isTizen && !new URLSearchParams(location.search).has(PARAMETRO)) return;
  let ws: WebSocket | null = null;
  let alvo: string | null = null;
  let autenticado = false;
  let tentativas = 0;
  let espera: ReturnType<typeof setTimeout> | undefined;

  const enviar = (m: Msg) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)); };
  const estado = () => {
    const v = video();
    enviar({
      t: 'state',
      mode: v && !v.paused ? (State.currentScreen === 'live' ? 'live' : 'vod') : 'idle',
      playing: !!v && !v.paused,
      screen: State.currentScreen,
      volume: v ? v.volume : 1,
      muted: v ? v.muted : false,
    });
  };
  State.on('screen-changed', () => setTimeout(estado, 300));

  const comando = (m: Msg) => {
    const t = String(m.t ?? '');
    if (t === 'key') {
      const code = String(m.code ?? '');
      if (code === 'HOME') State.setScreen('home');
      else if (/^\d$/.test(code)) apertar(48 + Number(code));
      else if (TECLAS[code]) apertar(TECLAS[code]);
    } else if (t === 'text') {
      escrever(String(m.value ?? ''));
    } else if (t === 'abrir') {
      const tela = TELAS[String(m.tela ?? '')];
      if (tela) State.setScreen(tela as never);
    } else if (t === 'tune') {
      const nome = String(m.channel ?? '').trim().toLowerCase();
      const canal = State.channels.find((c) => c.name.toLowerCase() === nome) ?? State.channels.find((c) => c.name.toLowerCase().includes(nome));
      if (canal) State.setScreen('live', { channel: canal });
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
    }
    setTimeout(estado, 300);
  };

  const aoReceber = (texto: string) => {
    let m: Msg;
    try { m = JSON.parse(texto) as Msg; } catch { return; }
    if (m.t === 'hello') {
      autenticado = true;
      enviar({ t: 'welcome', tv: { id: idDaTv(), name: Platform.isWebOS ? 'TV LG' : 'TV Samsung', plataforma: Platform.isWebOS ? 'webos' : 'tizen', reverso: true } });
      estado();
      return;
    }
    if (m.t === 'ping') { enviar({ t: 'pong', c0: m.c0, tv: Date.now() }); return; }
    if (!autenticado) return;
    comando(m);
  };

  const ligar = (endereco: string) => {
    alvo = endereco;
    clearTimeout(espera);
    try { ws?.close(); } catch { /* já fechado */ }
    autenticado = false;
    const s = new WebSocket(`ws://${endereco}/tv`);
    ws = s;
    s.onopen = () => {
      tentativas = 0;
      try { localStorage.setItem(CHAVE_ULTIMO, endereco); } catch { /* sem espaço */ }
      enviar({ t: 'tvhello', tv: { id: idDaTv(), name: Platform.isWebOS ? 'TV LG' : 'TV Samsung', plataforma: Platform.isWebOS ? 'webos' : 'tizen' } });
    };
    s.onmessage = (e) => aoReceber(String(e.data));
    s.onclose = () => {
      if (ws !== s) return;
      ws = null;
      if (++tentativas <= 6 && alvo) espera = setTimeout(() => alvo && ligar(alvo), Math.min(30000, 2000 * tentativas));
    };
  };

  let guardado: string | null = null;
  try { guardado = enderecoValido(localStorage.getItem(CHAVE_ULTIMO)); } catch { /* sem localStorage */ }
  const primeiro = enderecoDaAbertura() ?? guardado;
  if (primeiro) ligar(primeiro);

  const reabrir = () => { const e = enderecoDaAbertura(); if (e) ligar(e); };
  document.addEventListener('webOSRelaunch', reabrir);
  document.addEventListener('appcontrol', reabrir);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !ws && alvo) { tentativas = 0; ligar(alvo); }
  });
}
