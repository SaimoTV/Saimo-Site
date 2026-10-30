/**
 * Tela de Configurações e Preferências (SettingsScreen).
 * Permite ajustar modo Zero Delay, normalização de volume, comportamento de reprodução,
 * legendas, desbloqueio parental e visualização do status do hardware.
 */

import { State } from '../core/State';
import { Storage, TVPreferences } from '../core/Storage';
import { Platform } from '../core/Platform';
import { SpatialNav } from '../core/SpatialNav';

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
  }

  getElement(): HTMLElement {
    return this.element;
  }

  enter() {
    this.element.classList.remove('hidden');
    this.renderSettings();

    setTimeout(() => {
      const firstItem = this.listContainer.querySelector<HTMLElement>('.tv-settings-item');
      if (firstItem) SpatialNav.focus(firstItem);
    }, 50);
  }

  leave() {
    this.element.classList.add('hidden');
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

    // 1. REPRODUÇÃO
    addSection('Reprodução & Inicialização');

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
    addSection('Controle Parental');

    addOption(
      'bloqueio-parental',
      'Canais Adultos / Extras',
      State.unlockedExtras ? '🔓 Desbloqueado' : '🔒 Bloqueado (PIN: 1010)',
      () => {
        if (!State.unlockedExtras) {
          State.unlockParental('1010');
        } else {
          State.unlockedExtras = false;
        }
      }
    );

    // 4. MEMÓRIA & CACHE
    addSection('Dados & Cache');

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
    addSection('Sobre o Saimo TV');

    const platformLabel = Platform.isTizen
      ? 'Samsung Smart TV (Tizen Native)'
      : Platform.isWebOS
      ? 'LG Smart TV (webOS Native)'
      : 'Navegador Web / Simulador';

    addOption('sobre-plataforma', 'Sistema Operacional', platformLabel, () => {});
    addOption('sobre-versao', 'Versão Nativa', '2.0.0 Ultra-Fast (60 FPS)', () => {});
    addOption('sobre-resolucao', 'Resolução de Saída', '1920x1080 Full HD (Hardware Video Plane)', () => {});
  }
}
