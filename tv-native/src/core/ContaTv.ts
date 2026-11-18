/**
 * Conta Saimo no app da Samsung e da LG: como esta TV lê e grava os seus dados
 * no pacote da conta (núcleo em src/conta/conta.ts, o mesmo do site).
 *
 * - Onde parou: `saimo_tv_vod_progress` (por título, em segundos).
 * - Títulos favoritos: `saimo_tv_fav_vod` (só os nomes).
 * - Canais favoritos: `saimo_tv_fav_channels` (nomes, como no pacote).
 * - Listas: as Minhas listas que vieram de link.
 * - Addons e Debrid: o formato do Connect (core/Addons).
 */
import type { Adaptador, DadosDoPerfil } from '../../../src/conta/conta';
import { gravarNoPerfil, lerDoPerfil } from '../../../src/perfis/perfis';
import type { VODProgress } from './Storage';
import { MinhasListas } from './MinhasListas';
import { Addons } from './Addons';
import { Platform } from './Platform';
import { State } from './State';

type Obj = Record<string, any>;

const C_PROGRESSO = 'saimo_tv_vod_progress';
const C_FAV_VOD = 'saimo_tv_fav_vod';
const C_FAV_CANAIS = 'saimo_tv_fav_channels';
const C_LISTAS = 'saimo_tv_minhas_listas';

const txt = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);

function lerJson<T>(chave: string, id: string, padrao: T): T {
  try {
    const v = lerDoPerfil(chave, id);
    return v ? (JSON.parse(v) as T) : padrao;
  } catch { return padrao; }
}

function dadosDoPerfil(id: string): DadosDoPerfil {
  const prog = lerJson<Record<string, VODProgress>>(C_PROGRESSO, id, {});
  const progresso = Object.values(prog)
    .filter((p) => p && p.title && num(p.position) > 0 && num(p.duration) > 0)
    .map((p) => {
      const serie = num(p.season) > 0 && num(p.episode) > 0;
      return {
        // Ano e letra só existem no que veio de outro aparelho (guardados junto, para não duplicar).
        tipo: serie ? 's' : 'f', titulo: p.title, ano: txt((p as Obj).ano), letra: txt((p as Obj).letra),
        temporada: serie ? num(p.season) : 0, episodio: serie ? num(p.episode) : 0,
        pos: Math.round(num(p.position) * 1000), dur: Math.round(num(p.duration) * 1000), em: num(p.updatedAt),
      };
    });
  const favTitulos = lerJson<string[]>(C_FAV_VOD, id, [])
    .filter((t) => typeof t === 'string' && t)
    .map((titulo) => ({ tipo: 'f', titulo, ano: '', letra: '' }));
  const favCanais = lerJson<string[]>(C_FAV_CANAIS, id, []).filter((n) => typeof n === 'string' && n);
  return { progresso, favTitulos, favCanais };
}

function juntarNoPerfil(id: string, chegou: Partial<DadosDoPerfil>): void {
  if (Array.isArray(chegou.progresso) && chegou.progresso.length) {
    const atuais = lerJson<Record<string, VODProgress>>(C_PROGRESSO, id, {});
    let mudou = false;
    for (const p of chegou.progresso) {
      const titulo = txt(p?.titulo);
      const pos = num(p?.pos) / 1000, dur = num(p?.dur) / 1000, em = num(p?.em);
      if (!titulo || !(pos > 0) || !(dur > 0) || pos / dur > 0.95) continue;
      const serie = p.tipo === 's' && num(p.temporada) > 0 && num(p.episodio) > 0;
      if (p.tipo === 's' && !serie) continue;
      const local = atuais[titulo];
      if (local && num(local.updatedAt) >= em) continue;
      atuais[titulo] = <VODProgress & Obj>{
        title: titulo, position: pos, duration: dur, percent: Math.round((pos / dur) * 100), updatedAt: em,
        ...(txt(p.ano) ? { ano: txt(p.ano) } : {}), ...(txt(p.letra) ? { letra: txt(p.letra) } : {}),
        ...(serie ? { season: num(p.temporada), episode: num(p.episodio) } : {}),
      };
      mudou = true;
    }
    if (mudou) gravarNoPerfil(C_PROGRESSO, id, JSON.stringify(atuais));
  }
  const unir = (chave: string, novos: unknown[]) => {
    const atuais = lerJson<string[]>(chave, id, []);
    const somar = [...new Set(novos.map(txt).filter((n) => n && !atuais.includes(n)))];
    if (somar.length) gravarNoPerfil(chave, id, JSON.stringify([...atuais, ...somar]));
  };
  if (Array.isArray(chegou.favTitulos)) unir(C_FAV_VOD, chegou.favTitulos.map((f) => f?.titulo));
  if (Array.isArray(chegou.favCanais)) unir(C_FAV_CANAIS, chegou.favCanais);
}

function listas(): Obj {
  // Esta TV não tem os dois endereços do site: vão vazios e com `em` 0, que nunca vencem os de outro aparelho.
  return { minhas: MinhasListas.listas().filter((l) => !!l.link).map((l) => ({ nome: l.nome, link: l.link })) };
}

async function aplicarListas(l: Obj): Promise<void> {
  const minhas: Obj[] = Array.isArray(l.minhas) ? l.minhas : [];
  let novas = 0;
  for (const m of minhas) {
    const link = txt(m?.link).trim();
    if (!/^https?:\/\//i.test(link) || MinhasListas.listas().some((x) => x.link === link)) continue;
    try { await MinhasListas.adicionar(link, txt(m.nome)); novas++; } catch { /* fora do ar ou no limite: segue */ }
  }
  if (novas) State.emit('minhas-listas-mudou');
}

function nomeDoAparelho(): string {
  return Platform.isTizen ? 'Saimo na TV Samsung' : Platform.isWebOS ? 'Saimo na TV LG' : 'Saimo na TV (navegador)';
}

function aoMudarLocal(f: () => void): void {
  const chaves = new Set([C_PROGRESSO, C_FAV_VOD, C_FAV_CANAIS, C_LISTAS, 'saimo-perfis', 'saimo-perfis-removidos', 'saimo_addons_v1', 'saimo_debrid_v1']);
  const proto = Storage.prototype;
  const set = proto.setItem;
  proto.setItem = function (this: Storage, k: string, v: string) {
    set.call(this, k, v);
    if (chaves.has(String(k).split('@')[0])) f();
  };
  State.on('addons-changed', f);
}

export const adaptadorDaTv: Adaptador = {
  nomeDoAparelho,
  dadosDoPerfil,
  juntarNoPerfil,
  listas,
  aplicarListas,
  addons: () => Addons.exportDados() as Obj,
  aplicarAddons: (p) => { Addons.applyDados(p); },
  avisarTelas: () => State.emit('conta-sincronizou'),
  aoMudarLocal,
};
