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

export class SettingsScreen {
  private element: HTMLElement;
  private listContainer: HTMLElement;

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

    setTimeout(() => {
      const firstItem = this.listContainer.querySelector<HTMLElement>('.tv-settings-item');
      if (firstItem) SpatialNav.focus(firstItem);
    }, 50);
  }

  leave() {
    this.element.classList.add('hidden');
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

    // CONTA SAIMO (fora do Kids)
    if (!perfilAtivo().kids) {
      addSection('Conta Saimo');
      addOption('conta', 'Conta Saimo', resumoDaConta(), () => {
        this.mostrarCaixa(caixaDaConta(() => {
          this.mostrarCaixa(null);
          this.renderSettings();
          setTimeout(() => { const i = document.getElementById('setting-conta'); if (i) SpatialNav.focus(i); }, 50);
        }));
      });
    }

    // PERFIS
    addSection('Perfis');
    const n = perfis().length;
    addOption('perfis', 'Perfis', n === 1 ? 'Só um perfil. Criar, editar, Kids e avatares' : `${perfilAtivo().nome} · ${n} perfis`,
      () => State.emit('abrir-perfis', 'gerenciar'));

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

    // 2. LEGENDAS
    addSection('Legendas');

    const tamanhoNomes = ['Pequena', 'Normal', 'Grande', 'Enorme'];
    addOption(
      'tamanho-legenda',
      'Tamanho das Legendas',
      tamanhoNomes[prefs.tamanhoLegenda] || 'Normal',
      () => {
        const next = (prefs.tamanhoLegenda + 1) % 4;
        Storage.savePrefs({ tamanhoLegenda: next });
      }
    );

    addOption(
      'fundo-legenda',
      'Fundo Escuro Atrás da Legenda',
      prefs.legendaFundo ? 'Ativado' : 'Desativado',
      () => {
        Storage.savePrefs({ legendaFundo: !prefs.legendaFundo });
      }
    );

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

    addOption('sobre-plataforma', 'Sistema Operacional', platformLabel, () => {});
    addOption('sobre-versao', 'Versão', __VERSAO_APP__, () => {});

    // CONTROLE PARENTAL: no fim, separado e discreto. No Kids não aparece.
    if (!ehKids()) {
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
