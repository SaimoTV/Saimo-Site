/**
 * Protocolo Debrid cliente-direto (TorBox, Real-Debrid, AllDebrid, Premiumize).
 *
 * Implementação clean-room e ES5-safe (sem URLSearchParams, Object.fromEntries,
 * flatMap, structuredClone ou dependências de Node/DOM) compartilhada por
 * Web (`src/`), Smart TV nativa (`tv-native/`) e testes unitários (`scripts/test-addons.mjs`).
 */

import type { DebridAccountConfig, DebridProviderId } from './addonProtocol.ts';

export interface DebridProviderInfo {
  id: DebridProviderId;
  name: string;
  baseUrl: string;
  browserCorsFriendly: boolean;
  note: string;
}

export const DEBRID_PROVIDERS: DebridProviderInfo[] = [
  {
    id: 'torbox',
    name: 'TorBox',
    baseUrl: 'https://api.torbox.app/v1/api',
    browserCorsFriendly: true,
    note: 'Suporta chamadas CORS diretas do navegador e Smart TV.',
  },
  {
    id: 'realdebrid',
    name: 'Real-Debrid',
    baseUrl: 'https://api.real-debrid.com/rest/1.0',
    browserCorsFriendly: false,
    note: 'Ideal para app nativo/Smart TV; navegadores comuns podem bloquear via CORS.',
  },
  {
    id: 'alldebrid',
    name: 'AllDebrid',
    baseUrl: 'https://api.alldebrid.com/v4',
    browserCorsFriendly: false,
    note: 'Ideal para app nativo/Smart TV; navegadores comuns podem bloquear via CORS.',
  },
  {
    id: 'premiumize',
    name: 'Premiumize',
    baseUrl: 'https://www.premiumize.me/api',
    browserCorsFriendly: true,
    note: 'Resolução direta via API JSON (compatível com CORS em muitos ambientes).',
  },
];

export interface DebridFileEntry {
  id?: string | number;
  index?: number;
  name: string;
  size: number;
  link?: string;
}

export interface DebridResolveResult {
  ok: boolean;
  url?: string;
  provider?: DebridProviderId;
  fileName?: string;
  error?: string;
  corsBlocked?: boolean;
}

export interface DebridAccountCheckResult {
  ok: boolean;
  provider: DebridProviderId;
  label?: string;
  error?: string;
  corsBlocked?: boolean;
}

export const CORS_DEBRID_MESSAGE =
  'O navegador bloqueou o acesso direto à API Debrid (CORS). Use o TorBox, abra no app nativo da TV ou utilize um ambiente compatível com CORS.';

const VIDEO_EXT_RE = /\.(mp4|mkv|webm|mov|m4v|avi|ts|m2ts|mpg|mpeg)$/i;
const SAMPLE_RE = /\bsample\b/i;

/** Codifica pares chave/valor em `application/x-www-form-urlencoded` sem depender de `URLSearchParams`. */
export function encodeFormBody(pairs: Array<[string, string]>): string {
  const parts: string[] = [];
  for (let i = 0; i < pairs.length; i++) {
    parts.push(encodeURIComponent(pairs[i][0]) + '=' + encodeURIComponent(pairs[i][1]));
  }
  return parts.join('&');
}

/** Constrói URI magnet limpa a partir do `infoHash` e trackers opcionais do Stremio. */
export function buildMagnetUri(infoHash: string, displayName?: string, sources?: string[]): string {
  const cleanHash = (infoHash || '').trim().toLowerCase();
  if (!cleanHash) return '';
  let uri = 'magnet:?xt=urn:btih:' + encodeURIComponent(cleanHash);
  if (displayName && displayName.trim()) {
    uri += '&dn=' + encodeURIComponent(displayName.trim());
  }
  if (Array.isArray(sources)) {
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      if (!src || typeof src !== 'string') continue;
      if (src.indexOf('tracker:') === 0) {
        const tracker = src.slice('tracker:'.length).trim();
        if (tracker) uri += '&tr=' + encodeURIComponent(tracker);
      } else if (/^(udp|http|https|wss?):\/\//i.test(src.trim())) {
        uri += '&tr=' + encodeURIComponent(src.trim());
      }
    }
  }
  return uri;
}

/** Seleciona o arquivo de vídeo principal (respeitando `fileIdx` quando válido ou o maior arquivo não-sample). */
export function selectVideoFileFromList(
  files: DebridFileEntry[],
  preferredFileIdx?: number,
): DebridFileEntry | null {
  if (!Array.isArray(files) || files.length === 0) return null;

  if (typeof preferredFileIdx === 'number' && preferredFileIdx >= 0) {
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.index === preferredFileIdx || i === preferredFileIdx || Number(f.id) === preferredFileIdx + 1) {
        if (VIDEO_EXT_RE.test(f.name) || files.length === 1) {
          return f;
        }
      }
    }
  }

  let bestVideo: DebridFileEntry | null = null;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!VIDEO_EXT_RE.test(f.name) || SAMPLE_RE.test(f.name)) continue;
    if (!bestVideo || f.size > bestVideo.size) {
      bestVideo = f;
    }
  }
  if (bestVideo) return bestVideo;

  // Fallback para maior arquivo se extensões estiverem ausentes
  let largest = files[0];
  for (let i = 1; i < files.length; i++) {
    if (files[i].size > largest.size) largest = files[i];
  }
  return largest;
}

export function buildTorBoxCreatePayload(magnet: string): {
  endpoint: string;
  headers: Record<string, string>;
  body: string;
} {
  return {
    endpoint: 'https://api.torbox.app/v1/api/torrents/createtorrent',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encodeFormBody([['magnet', magnet]]),
  };
}

export function buildRealDebridAddMagnetPayload(magnet: string): {
  endpoint: string;
  headers: Record<string, string>;
  body: string;
} {
  return {
    endpoint: 'https://api.real-debrid.com/rest/1.0/torrents/addMagnet',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encodeFormBody([['magnet', magnet]]),
  };
}

export function buildAllDebridUploadPayload(magnet: string): {
  endpoint: string;
  headers: Record<string, string>;
  body: string;
} {
  return {
    endpoint: 'https://api.alldebrid.com/v4/magnet/upload?agent=SaimoTV',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encodeFormBody([['magnets[]', magnet]]),
  };
}

export function buildPremiumizeDirectDlPayload(magnet: string, apiKey: string): {
  endpoint: string;
  headers: Record<string, string>;
  body: string;
} {
  return {
    endpoint: 'https://www.premiumize.me/api/transfer/directdl',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encodeFormBody([
      ['apikey', apiKey],
      ['src', magnet],
    ]),
  };
}

export function isLikelyCorsError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const msg = String((err as { message?: string }).message || '').toLowerCase();
  const name = String((err as { name?: string }).name || '');
  return (
    name === 'TypeError' ||
    msg.indexOf('failed to fetch') !== -1 ||
    msg.indexOf('networkerror') !== -1 ||
    msg.indexOf('load failed') !== -1 ||
    msg.indexOf('cors') !== -1
  );
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeJsonFetch(
  url: string,
  init: RequestInit,
  timeoutMs = 15000,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> | null; corsBlocked?: boolean; error?: string }> {
  const hasAbort = typeof AbortController === 'function';
  const ctrl = hasAbort ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;

  try {
    const reqInit: RequestInit = {
      method: init.method || 'GET',
      headers: init.headers,
      body: init.body,
      cache: 'no-store',
    };
    if (ctrl) reqInit.signal = ctrl.signal;
    const resp = await fetch(url, reqInit);
    let data: Record<string, unknown> | null = null;
    try {
      data = (await resp.json()) as Record<string, unknown>;
    } catch {
      data = null;
    }
    return { ok: resp.ok, status: resp.status, data };
  } catch (err) {
    if (isLikelyCorsError(err)) {
      return { ok: false, status: 0, data: null, corsBlocked: true, error: CORS_DEBRID_MESSAGE };
    }
    const aborted = err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError';
    return {
      ok: false,
      status: 0,
      data: null,
      error: aborted ? 'Tempo esgotado ao conectar ao serviço Debrid.' : 'Falha de rede ao consultar serviço Debrid.',
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Verifica credencial de um provedor Debrid diretamente do cliente. */
export async function checkDebridAccount(
  provider: DebridProviderId,
  apiKey: string,
): Promise<DebridAccountCheckResult> {
  const key = (apiKey || '').trim();
  if (!key) return { ok: false, provider, error: 'Informe a chave de API.' };

  if (provider === 'torbox') {
    const res = await safeJsonFetch('https://api.torbox.app/v1/api/user/me', {
      headers: { Authorization: 'Bearer ' + key },
    });
    if (!res.ok || !res.data || !res.data.success) {
      return {
        ok: false,
        provider,
        corsBlocked: res.corsBlocked,
        error: res.error || String((res.data && res.data.detail) || 'Chave TorBox inválida ou expirada.'),
      };
    }
    const u = (res.data.data as Record<string, unknown>) || {};
    return { ok: true, provider, label: String(u.email || 'TorBox conectado') };
  }

  if (provider === 'realdebrid') {
    const res = await safeJsonFetch('https://api.real-debrid.com/rest/1.0/user', {
      headers: { Authorization: 'Bearer ' + key },
    });
    if (!res.ok || !res.data || !res.data.username) {
      return {
        ok: false,
        provider,
        corsBlocked: res.corsBlocked,
        error: res.error || String((res.data && res.data.error) || 'Token Real-Debrid inválido.'),
      };
    }
    return { ok: true, provider, label: String(res.data.username) + ' (' + String(res.data.type || 'ok') + ')' };
  }

  if (provider === 'alldebrid') {
    const res = await safeJsonFetch('https://api.alldebrid.com/v4/user?agent=SaimoTV', {
      headers: { Authorization: 'Bearer ' + key },
    });
    const d = res.data && (res.data.data as Record<string, unknown>);
    const u = d && (d.user as Record<string, unknown>);
    if (!res.ok || !res.data || res.data.status !== 'success' || !u) {
      return {
        ok: false,
        provider,
        corsBlocked: res.corsBlocked,
        error: res.error || 'Chave AllDebrid inválida ou bloqueada.',
      };
    }
    return { ok: true, provider, label: String(u.username || 'AllDebrid conectado') };
  }

  const res = await safeJsonFetch(
    'https://www.premiumize.me/api/account/info?apikey=' + encodeURIComponent(key),
    {},
  );
  if (!res.ok || !res.data || res.data.status !== 'success') {
    return {
      ok: false,
      provider,
      corsBlocked: res.corsBlocked,
      error: res.error || String((res.data && res.data.message) || 'Chave Premiumize inválida.'),
    };
  }
  return { ok: true, provider, label: 'Premiumize #' + String(res.data.customer_id || 'OK') };
}

async function resolveWithTorBox(
  apiKey: string,
  infoHash: string,
  magnet: string,
  fileIdx?: number,
): Promise<DebridResolveResult> {
  const authHeader = { Authorization: 'Bearer ' + apiKey };

  // Verifica cache primeiro (falha silenciosa para seguir para createtorrent se necessário)
  await safeJsonFetch(
    'https://api.torbox.app/v1/api/torrents/checkcached?hash=' + encodeURIComponent(infoHash) + '&format=object&list_files=true',
    { headers: authHeader },
  );

  const p = buildTorBoxCreatePayload(magnet);
  const created = await safeJsonFetch(p.endpoint, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': p.headers['Content-Type'] },
    body: p.body,
  });

  if (!created.ok || !created.data || !created.data.success) {
    return {
      ok: false,
      provider: 'torbox',
      corsBlocked: created.corsBlocked,
      error: created.error || String((created.data && created.data.detail) || 'TorBox recusou o torrent.'),
    };
  }

  const cData = (created.data.data as Record<string, unknown>) || {};
  const torrentId = cData.torrent_id || cData.queued_id;
  if (!torrentId) {
    return { ok: false, provider: 'torbox', error: 'TorBox não retornou ID do torrent.' };
  }

  // Consulta arquivos do torrent criado (até 3 tentativas breves caso esteja concluindo cache)
  let filesRaw: Array<Record<string, unknown>> = [];
  let downloadPresent = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const infoRes = await safeJsonFetch(
      'https://api.torbox.app/v1/api/torrents/mylist?id=' + encodeURIComponent(String(torrentId)) + '&bypass_cache=true',
      { headers: authHeader },
    );
    const tInfo = infoRes.data && (infoRes.data.data as Record<string, unknown>);
    if (tInfo && Array.isArray(tInfo.files)) {
      filesRaw = tInfo.files as Array<Record<string, unknown>>;
      downloadPresent = Boolean(tInfo.download_present);
      if (downloadPresent && filesRaw.length > 0) break;
    }
    if (attempt < 2) await waitMs(700);
  }

  if (!downloadPresent || filesRaw.length === 0) {
    return {
      ok: false,
      provider: 'torbox',
      error: 'Este torrent ainda não está em cache pronto no TorBox.',
    };
  }

  const entries: DebridFileEntry[] = filesRaw.map((f, idx) => ({
    id: String(f.id !== undefined ? f.id : idx),
    index: idx,
    name: String(f.short_name || f.name || 'video.mp4'),
    size: Number(f.size) || 0,
  }));
  const chosen = selectVideoFileFromList(entries, fileIdx);
  if (!chosen || chosen.id === undefined) {
    return { ok: false, provider: 'torbox', error: 'Nenhum arquivo de vídeo encontrado no torrent.' };
  }

  const dlRes = await safeJsonFetch(
    'https://api.torbox.app/v1/api/torrents/requestdl?token=' +
      encodeURIComponent(apiKey) +
      '&torrent_id=' +
      encodeURIComponent(String(torrentId)) +
      '&file_id=' +
      encodeURIComponent(String(chosen.id)),
    { headers: authHeader },
  );

  if (!dlRes.ok || !dlRes.data || typeof dlRes.data.data !== 'string') {
    return {
      ok: false,
      provider: 'torbox',
      corsBlocked: dlRes.corsBlocked,
      error: dlRes.error || 'Falha ao obter link de reprodução no TorBox.',
    };
  }

  return { ok: true, provider: 'torbox', url: dlRes.data.data, fileName: chosen.name };
}

async function resolveWithRealDebrid(
  apiKey: string,
  magnet: string,
  fileIdx?: number,
): Promise<DebridResolveResult> {
  const authHeader = { Authorization: 'Bearer ' + apiKey };
  const addPayload = buildRealDebridAddMagnetPayload(magnet);
  const addRes = await safeJsonFetch(addPayload.endpoint, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': addPayload.headers['Content-Type'] },
    body: addPayload.body,
  });

  if (!addRes.ok || !addRes.data || !addRes.data.id) {
    return {
      ok: false,
      provider: 'realdebrid',
      corsBlocked: addRes.corsBlocked,
      error: addRes.error || String((addRes.data && addRes.data.error) || 'Real-Debrid recusou o magnet.'),
    };
  }

  const rdId = String(addRes.data.id);
  const infoRes = await safeJsonFetch('https://api.real-debrid.com/rest/1.0/torrents/info/' + encodeURIComponent(rdId), {
    headers: authHeader,
  });
  const rawFiles = infoRes.data && Array.isArray(infoRes.data.files) ? (infoRes.data.files as Array<Record<string, unknown>>) : [];
  if (rawFiles.length === 0) {
    return { ok: false, provider: 'realdebrid', error: 'Torrent sem arquivos listados no Real-Debrid.' };
  }

  const entries: DebridFileEntry[] = rawFiles.map((f, idx) => ({
    id: Number(f.id),
    index: idx,
    name: String(f.path || 'video.mp4'),
    size: Number(f.bytes) || 0,
  }));
  const chosen = selectVideoFileFromList(entries, fileIdx);
  if (!chosen || !chosen.id) {
    return { ok: false, provider: 'realdebrid', error: 'Nenhum vídeo válido encontrado no torrent.' };
  }

  await safeJsonFetch('https://api.real-debrid.com/rest/1.0/torrents/selectFiles/' + encodeURIComponent(rdId), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encodeFormBody([['files', String(chosen.id)]]),
  });

  let unlockedTarget = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const stRes = await safeJsonFetch(
      'https://api.real-debrid.com/rest/1.0/torrents/info/' + encodeURIComponent(rdId),
      { headers: authHeader },
    );
    const stData = stRes.data || {};
    const links = Array.isArray(stData.links) ? (stData.links as string[]) : [];
    if (stData.status === 'downloaded' && links.length > 0) {
      unlockedTarget = links[0];
      break;
    }
    if (attempt < 2) await waitMs(650);
  }

  if (!unlockedTarget) {
    // Limpa torrent pendente não-cacheado para não poluir a conta do usuário
    safeJsonFetch('https://api.real-debrid.com/rest/1.0/torrents/delete/' + encodeURIComponent(rdId), {
      method: 'DELETE',
      headers: authHeader,
    }).catch(() => {});
    return { ok: false, provider: 'realdebrid', error: 'Torrent ainda não está em cache no Real-Debrid.' };
  }

  const unrestrict = await safeJsonFetch('https://api.real-debrid.com/rest/1.0/unrestrict/link', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encodeFormBody([['link', unlockedTarget]]),
  });

  if (!unrestrict.ok || !unrestrict.data || typeof unrestrict.data.download !== 'string') {
    return {
      ok: false,
      provider: 'realdebrid',
      corsBlocked: unrestrict.corsBlocked,
      error: unrestrict.error || 'Falha ao liberar link no Real-Debrid.',
    };
  }

  return { ok: true, provider: 'realdebrid', url: unrestrict.data.download, fileName: chosen.name };
}

async function resolveWithAllDebrid(
  apiKey: string,
  magnet: string,
  fileIdx?: number,
): Promise<DebridResolveResult> {
  const authHeader = { Authorization: 'Bearer ' + apiKey };
  const up = buildAllDebridUploadPayload(magnet);
  const upRes = await safeJsonFetch(up.endpoint, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': up.headers['Content-Type'] },
    body: up.body,
  });

  const upData = upRes.data && (upRes.data.data as Record<string, unknown>);
  const magnets = upData && Array.isArray(upData.magnets) ? (upData.magnets as Array<Record<string, unknown>>) : [];
  if (!upRes.ok || magnets.length === 0 || !magnets[0].id) {
    return {
      ok: false,
      provider: 'alldebrid',
      corsBlocked: upRes.corsBlocked,
      error: upRes.error || 'AllDebrid não aceitou o torrent.',
    };
  }

  const magnetId = String(magnets[0].id);
  let linksRaw: Array<Record<string, unknown>> = [];
  let ready = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const stRes = await safeJsonFetch(
      'https://api.alldebrid.com/v4/magnet/status?agent=SaimoTV&id=' + encodeURIComponent(magnetId),
      { headers: authHeader },
    );
    const stData = stRes.data && (stRes.data.data as Record<string, unknown>);
    const mInfo = stData && (stData.magnets as Record<string, unknown>);
    if (mInfo && (mInfo.statusCode === 4 || mInfo.status === 'Ready') && Array.isArray(mInfo.links)) {
      ready = true;
      linksRaw = mInfo.links as Array<Record<string, unknown>>;
      break;
    }
    if (attempt < 2) await waitMs(650);
  }

  if (!ready || linksRaw.length === 0) {
    return { ok: false, provider: 'alldebrid', error: 'Torrent ainda não está em cache no AllDebrid.' };
  }

  const entries: DebridFileEntry[] = linksRaw.map((l, idx) => ({
    index: idx,
    name: String(l.filename || 'video.mp4'),
    size: Number(l.size) || 0,
    link: String(l.link || ''),
  }));
  const chosen = selectVideoFileFromList(entries, fileIdx);
  if (!chosen || !chosen.link) {
    return { ok: false, provider: 'alldebrid', error: 'Nenhum link de vídeo disponível no AllDebrid.' };
  }

  const unlock = await safeJsonFetch(
    'https://api.alldebrid.com/v4/link/unlock?agent=SaimoTV&link=' + encodeURIComponent(chosen.link),
    { headers: authHeader },
  );
  const uData = unlock.data && (unlock.data.data as Record<string, unknown>);
  if (!unlock.ok || !uData || typeof uData.link !== 'string') {
    return {
      ok: false,
      provider: 'alldebrid',
      corsBlocked: unlock.corsBlocked,
      error: unlock.error || 'Falha ao liberar link no AllDebrid.',
    };
  }

  return { ok: true, provider: 'alldebrid', url: uData.link, fileName: chosen.name };
}

async function resolveWithPremiumize(
  apiKey: string,
  magnet: string,
  fileIdx?: number,
): Promise<DebridResolveResult> {
  const payload = buildPremiumizeDirectDlPayload(magnet, apiKey);
  const res = await safeJsonFetch(payload.endpoint, {
    method: 'POST',
    headers: payload.headers,
    body: payload.body,
  });

  if (!res.ok || !res.data || res.data.status !== 'success' || !Array.isArray(res.data.content)) {
    return {
      ok: false,
      provider: 'premiumize',
      corsBlocked: res.corsBlocked,
      error: res.error || String((res.data && res.data.message) || 'Torrent indisponível no Premiumize.'),
    };
  }

  const entries: DebridFileEntry[] = (res.data.content as Array<Record<string, unknown>>).map((c, idx) => ({
    index: idx,
    name: String(c.path || 'video.mp4'),
    size: Number(c.size) || 0,
    link: String(c.link || c.stream_link || ''),
  }));
  const chosen = selectVideoFileFromList(entries, fileIdx);
  if (!chosen || !chosen.link) {
    return { ok: false, provider: 'premiumize', error: 'Nenhum arquivo de vídeo encontrado no Premiumize.' };
  }

  return { ok: true, provider: 'premiumize', url: chosen.link, fileName: chosen.name };
}

/** Resolve um `infoHash` sob demanda tentando na ordem as contas Debrid ativas. */
export async function resolveTorrentAcrossDebrid(
  accounts: DebridAccountConfig[],
  infoHash: string,
  fileIdx?: number,
  sources?: string[],
  displayName?: string,
): Promise<DebridResolveResult> {
  const active = accounts.filter((a) => a.enabled && Boolean(a.apiKey && a.apiKey.trim()));
  if (active.length === 0) {
    return { ok: false, error: 'Nenhuma conta Debrid ativa configurada em Ajustes > Addons.' };
  }

  const magnet = buildMagnetUri(infoHash, displayName, sources);
  if (!magnet) {
    return { ok: false, error: 'InfoHash de torrent inválido.' };
  }

  let lastError = 'Não foi possível resolver este torrent no Debrid.';
  let anyCorsBlocked = false;

  for (let i = 0; i < active.length; i++) {
    const acc = active[i];
    const key = acc.apiKey.trim();
    let res: DebridResolveResult;

    if (acc.provider === 'torbox') {
      res = await resolveWithTorBox(key, infoHash, magnet, fileIdx);
    } else if (acc.provider === 'realdebrid') {
      res = await resolveWithRealDebrid(key, magnet, fileIdx);
    } else if (acc.provider === 'alldebrid') {
      res = await resolveWithAllDebrid(key, magnet, fileIdx);
    } else {
      res = await resolveWithPremiumize(key, magnet, fileIdx);
    }

    if (res.ok && res.url) return res;
    if (res.corsBlocked) anyCorsBlocked = true;
    if (res.error) lastError = res.error;
  }

  return { ok: false, error: lastError, corsBlocked: anyCorsBlocked };
}
