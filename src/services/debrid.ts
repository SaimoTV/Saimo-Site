/**
 * Serviço de contas Debrid cliente-direto (TorBox, Real-Debrid, AllDebrid, Premiumize).
 *
 * Chaves ficam exclusivamente no `localStorage` deste aparelho (`saimo_debrid_v1`),
 * sem passar por proxy ou servidor do Saimo.
 */

import { useSyncExternalStore } from 'react';
import {
  SAIMO_DEBRID_KEY,
  type DebridAccountConfig,
  type DebridProviderId,
} from '../utils/addonProtocol';
import {
  checkDebridAccount,
  resolveTorrentAcrossDebrid,
  type DebridAccountCheckResult,
  type DebridResolveResult,
} from '../utils/debridProtocol';

export { DEBRID_PROVIDERS, CORS_DEBRID_MESSAGE } from '../utils/debridProtocol';
export type { DebridAccountConfig, DebridProviderId, DebridAccountCheckResult, DebridResolveResult };

const EVENTO_DEBRID = 'saimo-debrid-mudou';
const CACHE_RESOLVIDOS = new Map<string, string>();
let snapshotCache: DebridAccountConfig[] = lerDoStorage();

function lerDoStorage(): DebridAccountConfig[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SAIMO_DEBRID_KEY) : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function salvarNoStorage(lista: DebridAccountConfig[]): void {
  snapshotCache = lista;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SAIMO_DEBRID_KEY, JSON.stringify(lista));
    }
  } catch {
    /* armazenamento indisponível */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENTO_DEBRID));
  }
}

export function getDebridAccounts(): DebridAccountConfig[] {
  return snapshotCache;
}

export function refreshDebridFromStorage(): void {
  snapshotCache = lerDoStorage();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENTO_DEBRID));
  }
}

export function replaceDebridAccounts(lista: DebridAccountConfig[]): void {
  CACHE_RESOLVIDOS.clear();
  salvarNoStorage(lista);
}

export function saveDebridAccount(config: DebridAccountConfig): void {
  const apiKey = (config.apiKey || '').trim();
  const atuais = snapshotCache.filter((a) => a.provider !== config.provider);
  if (apiKey) {
    atuais.push({
      provider: config.provider,
      apiKey,
      enabled: Boolean(config.enabled),
      syncWithConnect: Boolean(config.syncWithConnect),
    });
  }
  CACHE_RESOLVIDOS.clear();
  salvarNoStorage(atuais);
}

export function removeDebridAccount(provider: DebridProviderId): void {
  const proxima = snapshotCache.filter((a) => a.provider !== provider);
  CACHE_RESOLVIDOS.clear();
  salvarNoStorage(proxima);
}

export function hasEnabledDebrid(): boolean {
  return snapshotCache.some((a) => a.enabled && Boolean(a.apiKey && a.apiKey.trim()));
}

export function testDebridAccount(
  provider: DebridProviderId,
  apiKey: string,
): Promise<DebridAccountCheckResult> {
  return checkDebridAccount(provider, apiKey);
}

export async function resolveDebridStream(
  infoHash: string,
  fileIdx?: number,
  sources?: string[],
  displayName?: string,
): Promise<DebridResolveResult> {
  const key = (infoHash || '').trim().toLowerCase() + ':' + (typeof fileIdx === 'number' ? fileIdx : 'auto');
  const cached = CACHE_RESOLVIDOS.get(key);
  if (cached) {
    return { ok: true, url: cached };
  }

  const res = await resolveTorrentAcrossDebrid(snapshotCache, infoHash, fileIdx, sources, displayName);
  if (res.ok && res.url) {
    CACHE_RESOLVIDOS.set(key, res.url);
  }
  return res;
}

export function aoMudarDebrid(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key === SAIMO_DEBRID_KEY) {
      snapshotCache = lerDoStorage();
      cb();
    }
  };
  window.addEventListener(EVENTO_DEBRID, cb);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENTO_DEBRID, cb);
    window.removeEventListener('storage', onStorage);
  };
}

export function useDebridAccounts(): DebridAccountConfig[] {
  return useSyncExternalStore(aoMudarDebrid, getDebridAccounts, getDebridAccounts);
}

export function useHasDebrid(): boolean {
  const list = useDebridAccounts();
  return list.some((a) => a.enabled && Boolean(a.apiKey && a.apiKey.trim()));
}
