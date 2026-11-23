/** Versão do app (package.json), posta pelo vite.config.ts no build. */
declare const __VERSAO_APP__: string;

/**
 * Tela de Configurações e Preferências (SettingsScreen).
 * Permite ajustar modo Zero Delay, normalização de volume, comportamento de reprodução,
 * legendas, desbloqueio parental e visualização do status do hardware.
 */

import { State } from '../core/State';
import { Storage, TVPreferences } from '../core/Storage';
import { Addons } from '../core/Addons';
import { Platform } from '../core/Platform';
import { SpatialNav } from '../core/SpatialNav';
import { caixaDeCodigo } from './PerfisScreen';
import { ativo as perfilAtivo, conferirCodigo, pedeCodigo, perfis } from '../../../src/perfis/perfis';
import { conferirSenha, senhaEhPadrao, trocarSenha } from '../../../src/perfis/parental';
import { brilho, definirBrilho } from '../../../src/plataforma/brilho';
import { ehKids } from '../../../src/perfis/kids';
import { caixaDaConta, resumoDaConta } from './ContaTela';
import { caixaDeAcessibilidade } from './AcessibilidadeTela';
import { Platform as PlataformaTv } from '../core/Platform';
import { estadoConta } from '../../../src/conta/conta';
import { DESTAQUES, FUNDOS, TAMANHOS, definirTema, temaAtual } from '../../../src/plataforma/tema';
import { OPCOES, definirEstiloDeLegenda, estiloAtual, type EstiloDeLegenda } from '../../../src/plataforma/legendaEstilo';
import { resumoNovosEpisodios, dispensarNovosEpisodios } from '../core/NovosEpisodios';
import { duracaoLegivel, estatisticas, limparAssistidos } from '../../../src/services/assistidos';

/** O valor seguinte de uma lista de opções (volta ao primeiro depois do último). */
function seguinte<T extends string>(lista: readonly (readonly [T, string])[], atual: T): T {
  const i = lista.findIndex((x) => x[0] === atual);
  return lista[(i + 1) % lista.length][0];
}
function rotuloDe<T extends string>(lista: readonly (readonly [T, string])[], valor: T): string {
  const x = lista.find((y) => y[0] === valor);
  return x ? x[1] : String(valor);
}

export class SettingsScreen {
  private element: HTMLElement;
  private listContainer: HTMLElement;
  /** O grupo aberto dos Ajustes (null = a lista de grupos). */
  private grupo: string | null = null;
  private posGrupo = 0;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'tv-screen tv-settings-screen hidden';
    this.element.id = 'screen-settings';

    this.listContainer = document.createElement('div');
    this.listContainer.className = 'tv-settings-list tv-scroll-v';
    this.element.appendChild(this.listContainer);

    State.on('addons-changed', () => {
      if (!this.element.classList.contains('hidden')) {
        this.renderSettings();
      }
    });

    // VOLTAR dentro de um grupo volta à lista de grupos (e não ao menu).
    window.addEventListener('keydown', (e) => {
      if (this.element.classList.contains('hidden') || this.grupo === null || this.caixa || this.element.querySelector('.tv-conta, .tv-acess')) return;
      if (!PlataformaTv.isBackKey(e.keyCode)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      this.fecharGrupo();
    }, true);
  }

  private fecharGrupo() {
    this.grupo = null;
    this.renderSettings();
    setTimeout(() => {
      const itens = this.listContainer.querySelectorAll<HTMLElement>('.tv-settings-item');
      const alvo = itens[Math.min(this.posGrupo, itens.length - 1)];
      if (alvo) SpatialNav.focus(alvo);
    }, 50);
  }

  private abrirGrupo(id: string, posicao: number) {
    this.posGrupo = posicao;
    this.grupo = id;
    this.renderSettings();
    setTimeout(() => {
      const primeiro = this.listContainer.querySelector<HTMLElement>('.tv-settings-item');
      if (primeiro) SpatialNav.focus(primeiro);
    }, 50);
  }

  getElement(): HTMLElement {
    return this.element;
  }

  /** No perfil Kids os Ajustes pedem o código (a criança não mexe nas listas nem nos ajustes). */
  private liberado = false;
  private caixa: HTMLElement | null = null;

  private mostrarCaixa(c: HTMLElement | null) {
    this.caixa?.remove();
    // A caixa da conta troca a si mesma (QR por e-mail e senha): sai também.
    this.element.querySelectorAll('.tv-conta').forEach((e) => e.remove());
    this.caixa = c;
    this.listContainer.style.display = c ? 'none' : '';
    if (c) this.element.appendChild(c);
  }

  enter() {
    this.element.classList.remove('hidden');
    const p = perfilAtivo();
    if (pedeCodigo(p) && !this.liberado) {
      this.mostrarCaixa(caixaDeCodigo({
        titulo: `Código do perfil ${p.nome}`,
        motivo: 'Os Ajustes ficam trancados no perfil Kids. Digite o código para abrir.',
        campos: ['••••'],
        aoConfirmar: (v) => {
          if (!conferirCodigo(p, v[0])) return 'Código errado. Tente de novo.';
          this.liberado = true;
          this.mostrarCaixa(null);
          this.enter();
          return null;
        },
        aoCancelar: () => { this.mostrarCaixa(null); State.setScreen('home'); },
      }));
      return;
    }
    this.renderSettings();

    if (!estadoConta().token) document.getElementById('setting-conta')?.classList.add('destaque-conta');
    setTimeout(() => {
      const firstItem = this.listContainer.querySelector<HTMLElement>('.tv-settings-item');
      if (firstItem) SpatialNav.focus(firstItem);
    }, 50);
  }

  leave() {
    this.element.classList.add('hidden');
    this.grupo = null;
    this.liberado = false;
    this.mostrarCaixa(null);
  }

  private renderSettings() {
    const prefs = Storage.getPrefs();
    this.listContainer.innerHTML = '';

    const addSection = (title: string) => {
      const sec = document.createElement('div');
      sec.className = 'tv-settings-section-title';
      sec.textContent = title;
      this.listContainer.appendChild(sec);
    };

    const addOption = (
      id: string,
      title: string,
      valueText: string,
      onClick: () => void
    ) => {
      const item = document.createElement('div');
      item.className = 'tv-settings-item nav-focusable';
      item.setAttribute('data-nav', 'true');
      item.id = `setting-${id}`;

      item.innerHTML = `
        <span class="tv-settings-item-title">${title}</span>
        <span class="tv-settings-item-value">${valueText}</span>
      `;

      item.addEventListener('click', () => {
        onClick();
        this.renderSettings();
      });

      this.listContainer.appendChild(item);
    };

    const grupos: { id: string; nome: string; sobre: string; ocultoKids?: boolean }[] = [
      { id: 'reproducao', nome: 'Reprodução', sobre: 'Ao abrir, atraso do ao vivo, áudio, abertura e próximo episódio' },
      { id: 'legendas', nome: 'Legendas', sobre: 'Fonte, tamanho, cor, fundo e posição' },
      { id: 'aparencia', nome: 'Aparência e acessibilidade', sobre: 'Tamanho do texto e do menu, negrito, contraste, foco, cores e brilho' },
      { id: 'listas', nome: 'Listas e fontes', sobre: 'Minhas listas, addons e Debrid' },
      { id: 'perfis', nome: 'Perfis e estatísticas', sobre: 'Trocar e criar perfis, seu tempo e episódios novos' },
      { id: 'sistema', nome: 'Sistema', sobre: 'Limpezas, versão e dados do aparelho' },
      { id: 'parental', nome: 'Controle parental', sobre: 'Conteúdo adulto e senha', ocultoKids: true },
    ];
    const g = this.grupo;
    if (g === null) {
      if (!perfilAtivo().kids) {
        addOption('conta', 'Conta Saimo', resumoDaConta(), () => {
          this.mostrarCaixa(caixaDaConta(() => {
            this.mostrarCaixa(null);
            this.renderSettings();
            setTimeout(() => { const i = document.getElementById('setting-conta'); if (i) SpatialNav.focus(i); }, 50);
          }));
        });
      }
      grupos.filter((x) => !(x.ocultoKids && ehKids())).forEach((x, n) => {
        const pos = (perfilAtivo().kids ? 0 : 1) + n;
        addOption(`grupo-${x.id}`, x.nome, x.sobre, () => { this.abrirGrupo(x.id, pos); });
      });
      // O clique de cada linha redesenha a lista: o grupo aberto troca a tela logo em seguida.
      return;
    }

    if (g === 'perfis') {
    // PERFIS
    addSection('Perfis');
    const n = perfis().length;
    addOption('perfis', 'Perfis', n === 1 ? 'Só um perfil. Criar, editar, Kids e avatares' : `${perfilAtivo().nome} · ${n} perfis`,
      () => State.emit('abrir-perfis', 'gerenciar'));

    // ESTATÍSTICAS (do perfil em uso)
    addSection('Suas estatísticas');
    const est = estatisticas();
    addOption('estat-tempo', 'Tempo assistido', est.tempoTotal < 60 ? 'Ainda nada' : duracaoLegivel(est.tempoTotal), () => {});
    addOption('estat-filmes', 'Filmes concluídos', String(est.filmes), () => {});
    addOption('estat-eps', 'Episódios concluídos', `${est.episodios}${est.series ? ` · ${est.series} séries` : ''}`, () => {});
    if (est.maisVista) addOption('estat-top', 'Série mais vista', `${est.maisVista.titulo} (${est.maisVista.episodios})`, () => {});
    addOption('novos-eps', 'Séries favoritas com episódio novo', resumoNovosEpisodios(), () => { dispensarNovosEpisodios(); });
    addOption('estat-zerar', 'Zerar estatísticas', 'OK para zerar', () => { limparAssistidos(); });

    }

    if (g === 'listas') {
    // 1. LISTAS E FONTES
    addSection('Listas e Fontes');
    addOption('minhas', 'Minhas listas', 'Adicionar listas .m3u pelo link', () => State.setScreen('minhas'));
    const ativos = Addons.enabledList().length;
    const total = Addons.list().length;
    const deb = Addons.getDebridAccounts().filter((d) => d.enabled).length;
    const resumoAddons = total === 0 && deb === 0
      ? 'Nenhum instalado (protocolo Stremio + Debrid)'
      : `${ativos}/${total} ativo(s)${deb > 0 ? ` · ${deb} Debrid` : ''}`;
    addOption('addons', 'Addons & Debrid', resumoAddons, () => State.setScreen('addons'));

    }

    if (g === 'reproducao') {
    addSection('Reprodução');

    addOption(
      'abrir-em',
      'Abrir o aplicativo em',
      prefs.abrirEm === 'inicio' ? 'Tela Inicial' : 'Último Canal Assistido',
      () => {
        const next = prefs.abrirEm === 'inicio' ? 'canal' : 'inicio';
        Storage.savePrefs({ abrirEm: next });
      }
    );

    addOption(
      'zero-delay',
      'Modo Zero Delay (Buffer de Baixa Latência)',
      prefs.zeroDelay === 'agressivo'
        ? 'Agressivo (Instantâneo)'
        : prefs.zeroDelay === 'equilibrado'
        ? 'Equilibrado'
        : 'Desativado',
      () => {
        const map: Record<string, 'off' | 'equilibrado' | 'agressivo'> = {
          off: 'equilibrado',
          equilibrado: 'agressivo',
          agressivo: 'off',
        };
        Storage.savePrefs({ zeroDelay: map[prefs.zeroDelay] });
      }
    );

    addOption(
      'audio-inteligente',
      'Áudio Inteligente (Normalização de Volume)',
      prefs.audioInteligente ? 'Ativado' : 'Desativado',
      () => {
        Storage.savePrefs({ audioInteligente: !prefs.audioInteligente });
      }
    );

    addOption(
      'pular-abertura',
      'Pular Aberturas Automaticamente',
      prefs.pularAutomatico ? 'Sim' : 'Não',
      () => {
        Storage.savePrefs({ pularAutomatico: !prefs.pularAutomatico });
      }
    );

    addOption(
      'proximo-ep',
      'Iniciar Próximo Episódio Sozinho',
      prefs.proximoAutomatico ? 'Sim' : 'Não',
      () => {
        Storage.savePrefs({ proximoAutomatico: !prefs.proximoAutomatico });
      }
    );

    }

    if (g === 'legendas') {
    // 2. LEGENDAS
    addSection('Legendas');

    const leg = estiloAtual();
    (['fonte', 'tamanho', 'cor', 'fundo', 'posicao'] as (keyof EstiloDeLegenda)[]).forEach((campo) => {
      const nomes: Record<string, string> = { fonte: 'Fonte', tamanho: 'Tamanho', cor: 'Cor', fundo: 'Fundo', posicao: 'Posição' };
      const lista = OPCOES[campo] as readonly (readonly [string, string])[];
      addOption(`legenda-${campo}`, `${nomes[campo]} da legenda`, rotuloDe(lista, leg[campo]), () => {
        definirEstiloDeLegenda({ [campo]: seguinte(lista, leg[campo]) } as Partial<EstiloDeLegenda>);
      });
    });

    }

    if (g === 'aparencia') {
      addOption('acessibilidade', 'Acessibilidade', (() => {
        const t = temaAtual();
        const partes = [TAMANHOS.find((x) => x.id === t.tamanho)!.nome];
        if (t.negrito) partes.push('negrito');
        if (t.contraste) partes.push('alto contraste');
        if (t.focoForte) partes.push('foco reforçado');
        return `${partes.join(' · ')} · com prévia antes de aplicar`;
      })(), () => {
        this.mostrarCaixa(caixaDeAcessibilidade(() => {
          this.mostrarCaixa(null);
          this.renderSettings();
          setTimeout(() => { const i = document.getElementById('setting-acessibilidade'); if (i) SpatialNav.focus(i); }, 50);
        }));
      });
    // APARÊNCIA
    addSection('Aparência');
    const tema = temaAtual();
    const destaques = DESTAQUES.map((d) => [d.id, d.nome] as const);
    const fundos = FUNDOS.map((f) => [f.id, f.nome] as const);
    const animacoes = [['suaves', 'Suaves'], ['reduzidas', 'Reduzidas']] as const;
    addOption('tema-cor', 'Cor de destaque', rotuloDe(destaques, tema.destaque), () => {
      definirTema({ destaque: seguinte(destaques, tema.destaque) });
    });
    addOption('tema-fundo', 'Fundo', rotuloDe(fundos, tema.fundo), () => {
      definirTema({ fundo: seguinte(fundos, tema.fundo) as typeof tema.fundo });
    });
    addOption('tema-anim', 'Animações entre telas', rotuloDe(animacoes, tema.animacoes), () => {
      definirTema({ animacoes: seguinte(animacoes, tema.animacoes) });
    });

    // Brilho do app (não o da TV): 100 -> 75 -> 50 -> 25 -> 0 -> 100. Em 0 qualquer botão volta.
    const textoBrilho = (v: number) => (v >= 100 ? '100% (normal) · OK diminui 25%' : `${v}% · OK muda · em 0% qualquer botão volta`);
    addSection('Tela');
    addOption('brilho', 'Brilho do app', textoBrilho(brilho()), () => {
      const atual = brilho();
      const novo = atual <= 0 ? 100 : Math.max(0, atual - 25);
      definirBrilho(novo);
      const valor = document.querySelector('#setting-brilho .tv-settings-item-value');
      if (valor) valor.textContent = textoBrilho(novo);
    });

    }

    if (g === 'sistema') {
    // 3. CONTROLE PARENTAL
    addSection('Dados');

    addOption(
      'limpar-progresso',
      'Limpar Histórico de "Continuar Assistindo"',
      'Executar Limpeza',
      () => {
        localStorage.removeItem('saimo_tv_vod_progress');
        alert('Histórico de reprodução limpo com sucesso.');
      }
    );

    // 5. SOBRE
    addSection('Sobre');

    const platformLabel = Platform.isTizen
      ? 'Samsung Smart TV (Tizen Native)'
      : Platform.isWebOS
      ? 'LG Smart TV (webOS Native)'
      : 'Navegador Web / Simulador';

    addOption('sobre-plataforma', 'Sistema Operacional', platformLabel, () => {});
    addOption('sobre-versao', 'Versão', __VERSAO_APP__, () => {});

    }

    if (g === 'parental' && !ehKids()) {
      addSection('Controle parental');
      const titulo = this.listContainer.lastElementChild as HTMLElement | null;
      titulo?.classList.add('discreto');
      const pedirSenha = (motivo: string, campos: string[], acao: (v: string[]) => string | null) => {
        this.mostrarCaixa(caixaDeCodigo({ titulo: 'Controle parental', motivo, campos,
          aoConfirmar: (v) => { const erro = acao(v); if (!erro) { this.mostrarCaixa(null); this.renderSettings(); } return erro; },
          aoCancelar: () => { this.mostrarCaixa(null); this.renderSettings(); } }));
      };
      addOption('parental', 'Conteúdo adulto', State.unlockedExtras ? 'Liberado (OK bloqueia)' : 'Bloqueado', () => {
        if (State.unlockedExtras) { State.unlockedExtras = false; State.emit('extras-unlocked'); return; }
        pedirSenha('Digite a senha do controle parental.', ['Senha'],
          (v) => (State.unlockParental(v[0]) ? null : 'Senha errada.'));
      });
      addOption('parental-senha', 'Trocar a senha', senhaEhPadrao() ? 'Ainda com a senha de fábrica' : 'Senha própria', () => {
        pedirSenha('Digite a senha atual e a nova (4 números).', ['Senha atual', 'Senha nova'], (v) => {
          if (!conferirSenha(v[0])) return 'Senha atual errada.';
          return trocarSenha(v[0], v[1]) ? null : 'A senha nova tem 4 números.';
        });
      });
      this.listContainer.querySelectorAll('#setting-parental, #setting-parental-senha').forEach((e) => e.classList.add('discreto'));
    }
  }
}
