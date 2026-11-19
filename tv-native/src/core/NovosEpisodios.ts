/**
 * Avisos de episódios novos nas séries favoritas.
 *
 * O catálogo diz quantos episódios cada série tem. Para cada série favorita
 * guarda-se a contagem "já vista"; se o catálogo passa a ter mais, nasce um
 * aviso que fica em Ajustes até ser dispensado. A primeira olhada numa série
 * só marca a contagem, sem avisar. (ES5: roda em TVs antigas.)
 */
import { Storage } from './Storage';
import { Api } from './Api';
import { series } from '../../../src/services/vodService';
import { ativo as perfilAtivo } from '../../../src/perfis/perfis';

interface Dados { vistos: { [titulo: string]: number }; avisos: { [titulo: string]: number }; }

const chave = () => 'saimo-tv-novos-episodios:' + perfilAtivo().id;

function ler(): Dados {
  try {
    const d = JSON.parse(localStorage.getItem(chave()) || '{}');
    return { vistos: d.vistos || {}, avisos: d.avisos || {} };
  } catch (e) {
    return { vistos: {}, avisos: {} };
  }
}

function gravar(d: Dados) {
  try { localStorage.setItem(chave(), JSON.stringify(d)); } catch (e) { /* sem espaço */ }
}

export function resumoNovosEpisodios(): string {
  const a = ler().avisos;
  const titulos = Object.keys(a);
  if (!titulos.length) return 'Nenhum episódio novo';
  let total = 0;
  for (let i = 0; i < titulos.length; i++) total += a[titulos[i]];
  return total + ' novos em ' + titulos.length + ' séries · OK dispensa';
}

export function dispensarNovosEpisodios() {
  const d = ler();
  const titulos = Object.keys(d.avisos);
  for (let i = 0; i < titulos.length; i++) delete d.vistos[titulos[i]];
  d.avisos = {};
  gravar(d);
}

/** Confere as séries favoritas; devolve os títulos que ganharam episódios agora. */
export function verificarNovosEpisodios(): Promise<string[]> {
  const favoritos: string[] = [];
  Storage.getFavoriteVOD().forEach((t) => favoritos.push(t));
  if (!favoritos.length) return Promise.resolve([]);
  return Api.fetchFichas().then((pool) => {
    const dados = ler();
    const novas: string[] = [];
    const porLetra: { [l: string]: Promise<any[]> } = {};
    const tarefas = favoritos.map((titulo) => {
      let item: any = null;
      for (let i = 0; i < pool.length; i++) {
        if (pool[i].isSeries && pool[i].title === titulo) { item = pool[i]; break; }
      }
      if (!item || !item.letra) return Promise.resolve();
      if (!porLetra[item.letra]) porLetra[item.letra] = series(item.letra).catch(() => []);
      return porLetra[item.letra].then((lista) => {
        let achada: any = null;
        for (let i = 0; i < lista.length; i++) {
          if (lista[i].titulo === titulo) { achada = lista[i]; break; }
        }
        if (!achada || !achada.episodios) return;
        const visto = dados.vistos[titulo];
        if (visto === undefined) { dados.vistos[titulo] = achada.episodios; return; }
        if (achada.episodios > visto) {
          if (!dados.avisos[titulo]) novas.push(titulo);
          dados.avisos[titulo] = achada.episodios - visto;
        } else if (achada.episodios < visto) {
          dados.vistos[titulo] = achada.episodios;
          delete dados.avisos[titulo];
        }
      });
    });
    return Promise.all(tarefas).then(() => { gravar(dados); return novas; });
  }).catch(() => []);
}
