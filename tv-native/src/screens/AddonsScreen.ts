/**
 * Tela de Addons (protocolo Stremio) e Debrid client-side para Smart TV (D-Pad).
 */

import { AddonRecord, DebridProviderId } from '../../../src/utils/addonProtocol';
import { DEBRID_PROVIDERS } from '../../../src/utils/debridProtocol';
import { buildQrSvg } from '../../../src/utils/qrCode';
import { Addons } from '../core/Addons';
import { SpatialNav } from '../core/SpatialNav';
import { State } from '../core/State';

function escHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getCompanionPairingUrl(): { url: string; temServidorLocal: boolean } {
  if (typeof window !== 'undefined') {
    const w = window as unknown as Record<string, unknown>;
    const customUrl = typeof w.__SAIMO_CONNECT_URL__ === 'string'
      ? w.__SAIMO_CONNECT_URL__
      : typeof w.__SAIMO_ADDONS_QR_URL__ === 'string'
        ? w.__SAIMO_ADDONS_QR_URL__
        : '';
    if (customUrl) {
      return { url: customUrl, temServidorLocal: true };
    }
    const loc = window.location;
    if (loc && loc.protocol && loc.protocol.indexOf('http') === 0 && loc.hostname && loc.hostname !== 'localhost') {
      return { url: `${loc.protocol}//${loc.hostname}:8999/addons`, temServidorLocal: true };
    }
  }
  return { url: 'http://192.168.1.100:8999/addons', temServidorLocal: false };
}

export class AddonsScreen {
  private element: HTMLElement;
  private urlInput!: HTMLInputElement;
  private avisoEl!: HTMLElement;
  private listaAddonsEl!: HTMLElement;
  private debKeyInput!: HTMLInputElement;
  private debAvisoEl!: HTMLElement;
  private debListaEl!: HTMLElement;
  private jsonInput!: HTMLInputElement;
  private qrBoxEl!: HTMLElement;
  private qrUrlEl!: HTMLElement;
  private qrNotaEl!: HTMLElement;
  private selectedProvider: DebridProviderId = 'realdebrid';
  private confirmRemoveAddonId: string | null = null;
  private ocupado = false;

  constructor() {
    this.element = document.createElement('div');
    this.element.id = 'addons-screen';
    this.element.className = 'tv-screen tv-minhas tv-addons tv-screen-scroll tv-scroll-v hidden';

    const providersHtml = DEBRID_PROVIDERS.map(
      (p) =>
        `<div id="ad-prov-${p.id}" class="tv-btn nav-focusable tv-addons-prov" data-nav="true" data-prov="${p.id}">${escHtml(p.name)}</div>`
    ).join('');

    this.element.innerHTML = `
      <div class="tv-addons-header">
        <div>
          <div class="tv-minhas-titulo">Addons &amp; Debrid</div>
          <div class="tv-minhas-ajuda">Protocolo Stremio (manifest.json HTTP) e Debrid client-side. Começa vazio; nenhum addon pré-instalado. Plugins JS (Nuvio) não são executados neste app.</div>
        </div>
        <div id="ad-voltar" class="tv-btn nav-focusable" data-nav="true">Voltar para Ajustes</div>
      </div>

      <div class="tv-addons-top-grid">
        <div class="tv-addons-panel">
          <div class="tv-minhas-titulo tv-minhas-sub" style="margin-top:0">Instalar Addon Stremio</div>
          <div class="tv-minhas-ajuda">Aperte OK no campo para digitar a URL (https://... ou stremio://...) pelo teclado da TV.</div>
          <input id="ad-url" class="tv-campo nav-focusable tv-addons-campo" data-nav="true" type="text" placeholder="https://seu-addon.exemplo/manifest.json" />
          <div class="tv-addons-shortcuts">
            <div class="tv-btn nav-focusable tv-addons-chip" data-nav="true" data-insert="https://">+ https://</div>
            <div class="tv-btn nav-focusable tv-addons-chip" data-nav="true" data-insert="stremio://">+ stremio://</div>
            <div class="tv-btn nav-focusable tv-addons-chip" data-nav="true" data-insert="/manifest.json">+ /manifest.json</div>
          </div>
          <div id="ad-instalar" class="tv-btn nav-focusable tv-addons-primary" data-nav="true">Instalar Addon</div>
          <div id="ad-aviso" class="tv-minhas-aviso"></div>
        </div>

        <div class="tv-addons-qr-card">
          <div class="tv-addons-qr-titulo">Enviar URL / Connect</div>
          <div id="ad-qr-box" class="tv-addons-qr-svg"></div>
          <div id="ad-qr-url" class="tv-addons-qr-url"></div>
          <div id="ad-qr-nota" class="tv-addons-qr-nota"></div>
        </div>
      </div>

      <div class="tv-minhas-titulo tv-minhas-sub">Addons Instalados</div>
      <div id="ad-lista" class="tv-minhas-lista"></div>

      <div class="tv-minhas-titulo tv-minhas-sub">Debrid Client-Side (Torrents on-demand)</div>
      <div class="tv-minhas-ajuda">Resolução direta no aparelho (TorBox, Real-Debrid, AllDebrid, Premiumize) sem enviar API key ao servidor do Saimo.</div>
      <div class="tv-addons-prov-row">${providersHtml}</div>
      <input id="ad-deb-key" class="tv-campo nav-focusable tv-addons-campo" data-nav="true" type="password" placeholder="Cole sua API Key do provedor selecionado" />
      <div class="tv-addons-btn-row">
        <div id="ad-deb-salvar" class="tv-btn nav-focusable" data-nav="true">Salvar API Key</div>
        <div id="ad-deb-testar" class="tv-btn nav-focusable" data-nav="true">Testar Conexão</div>
        <div id="ad-deb-remover" class="tv-btn nav-focusable" data-nav="true">Remover Provedor</div>
      </div>
      <div id="ad-deb-aviso" class="tv-minhas-aviso"></div>
      <div id="ad-deb-lista" class="tv-minhas-lista"></div>

      <div class="tv-minhas-titulo tv-minhas-sub">Sincronização Connect ({t:"dados"})</div>
      <div class="tv-minhas-ajuda">Cole o payload JSON exportado do Connect/Web para importar seus addons e contas autorizadas nesta TV.</div>
      <input id="ad-json" class="tv-campo nav-focusable tv-addons-campo" data-nav="true" type="text" placeholder='{"t":"dados","addons":[...]}' />
      <div class="tv-addons-btn-row" style="margin-bottom:48px">
        <div id="ad-json-aplicar" class="tv-btn nav-focusable" data-nav="true">Aplicar JSON Connect</div>
        <div id="ad-json-exportar" class="tv-btn nav-focusable" data-nav="true">Ver JSON Atual</div>
      </div>
    `;

    this.urlInput = this.element.querySelector<HTMLInputElement>('#ad-url')!;
    this.avisoEl = this.element.querySelector<HTMLElement>('#ad-aviso')!;
    this.listaAddonsEl = this.element.querySelector<HTMLElement>('#ad-lista')!;
    this.debKeyInput = this.element.querySelector<HTMLInputElement>('#ad-deb-key')!;
    this.debAvisoEl = this.element.querySelector<HTMLElement>('#ad-deb-aviso')!;
    this.debListaEl = this.element.querySelector<HTMLElement>('#ad-deb-lista')!;
    this.jsonInput = this.element.querySelector<HTMLInputElement>('#ad-json')!;
    this.qrBoxEl = this.element.querySelector<HTMLElement>('#ad-qr-box')!;
    this.qrUrlEl = this.element.querySelector<HTMLElement>('#ad-qr-url')!;
    this.qrNotaEl = this.element.querySelector<HTMLElement>('#ad-qr-nota')!;

    this.bindEvents();
    State.on('addons-changed', () => {
      if (!this.element.classList.contains('hidden')) {
        this.renderAddonsList();
        this.renderDebridList();
      }
    });
  }

  private bindEvents(): void {
    this.element.querySelector('#ad-voltar')?.addEventListener('click', () => {
      State.setScreen('settings');
    });

    this.element.querySelector('#ad-instalar')?.addEventListener('click', () => {
      this.handleInstall();
    });

    this.element.querySelectorAll<HTMLElement>('.tv-addons-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const piece = chip.getAttribute('data-insert') || '';
        const current = this.urlInput.value || '';
        if (piece === '/manifest.json') {
          if (current.indexOf('/manifest.json') === -1) {
            this.urlInput.value = current.replace(/\/+$/, '') + piece;
          }
        } else if (current.indexOf(piece) !== 0) {
          this.urlInput.value = piece + current;
        }
        SpatialNav.focus(this.urlInput);
      });
    });

    this.element.querySelectorAll<HTMLElement>('.tv-addons-prov').forEach((btn) => {
      btn.addEventListener('click', () => {
        const prov = (btn.getAttribute('data-prov') || 'realdebrid') as DebridProviderId;
        this.selectProvider(prov);
      });
    });

    this.element.querySelector('#ad-deb-salvar')?.addEventListener('click', () => {
      const key = this.debKeyInput.value.trim();
      if (!key) {
        this.debAvisoEl.textContent = 'Informe uma API Key antes de salvar.';
        return;
      }
      Addons.saveDebrid({
        provider: this.selectedProvider,
        apiKey: key,
        enabled: true,
        syncWithConnect: false,
        updatedAt: Date.now(),
      });
      this.debAvisoEl.textContent = 'Chave Debrid salva localmente nesta TV.';
      this.renderDebridList();
    });

    this.element.querySelector('#ad-deb-testar')?.addEventListener('click', () => {
      this.handleTestDebrid();
    });

    this.element.querySelector('#ad-deb-remover')?.addEventListener('click', () => {
      Addons.removeDebrid(this.selectedProvider);
      this.debKeyInput.value = '';
      this.debAvisoEl.textContent = 'Provedor removido.';
      this.renderDebridList();
    });

    this.element.querySelector('#ad-json-aplicar')?.addEventListener('click', () => {
      this.handleApplyJson();
    });

    this.element.querySelector('#ad-json-exportar')?.addEventListener('click', () => {
      const payload = Addons.exportDados();
      this.jsonInput.value = JSON.stringify(payload);
      this.avisoEl.textContent = `JSON atual pronto no campo abaixo (${payload.addons ? payload.addons.length : 0} addon(s)).`;
    });

    // Workaround IME Smart TV igual MinhasListasScreen
    this.element.querySelectorAll<HTMLInputElement>('input').forEach((campo) => {
      campo.addEventListener('click', () => {
        const ativo = document.activeElement as HTMLElement | null;
        if (ativo && ativo !== campo && ativo.tagName === 'INPUT') ativo.blur();
        window.setTimeout(() => {
          campo.focus();
          try {
            const len = campo.value.length;
            campo.setSelectionRange(len, len);
          } catch {
            /* input sem seleção */
          }
        }, 30);
      });
    });
  }

  private selectProvider(prov: DebridProviderId): void {
    this.selectedProvider = prov;
    this.element.querySelectorAll<HTMLElement>('.tv-addons-prov').forEach((el) => {
      el.classList.toggle('active', el.getAttribute('data-prov') === prov);
    });
    const existing = Addons.getDebridAccounts().find((a) => a.provider === prov);
    this.debKeyInput.value = existing ? existing.apiKey : '';
    this.debAvisoEl.textContent = '';
  }

  private async handleInstall(): Promise<void> {
    if (this.ocupado) return;
    const raw = this.urlInput.value.trim();
    if (!raw) {
      this.avisoEl.textContent = 'Digite a URL de um manifest.json Stremio.';
      return;
    }
    this.ocupado = true;
    this.avisoEl.textContent = 'Buscando e validando manifest.json...';
    try {
      const res = await Addons.install(raw);
      if (!res.ok) {
        this.avisoEl.textContent = res.erro || 'Falha ao instalar addon.';
      } else {
        this.urlInput.value = '';
        this.avisoEl.textContent = res.atualizado
          ? `Addon "${res.addon?.name}" atualizado.`
          : `Addon "${res.addon?.name}" instalado!`;
        this.renderAddonsList();
      }
    } finally {
      this.ocupado = false;
    }
  }

  private async handleTestDebrid(): Promise<void> {
    const key = this.debKeyInput.value.trim();
    if (!key) {
      this.debAvisoEl.textContent = 'Digite ou salve uma API Key para testar.';
      return;
    }
    this.debAvisoEl.textContent = 'Validando conta no provedor Debrid...';
    const res = await Addons.testDebrid(this.selectedProvider, key);
    if (res.ok) {
      this.debAvisoEl.textContent = res.username
        ? `Conectado como ${res.username}${res.premium ? ' (Premium)' : ''}.`
        : 'Conexão válida!';
    } else {
      this.debAvisoEl.textContent = res.erro || 'Não foi possível validar a chave.';
    }
  }

  private handleApplyJson(): void {
    const raw = this.jsonInput.value.trim();
    if (!raw) {
      this.avisoEl.textContent = 'Cole o JSON Connect ({t:"dados", addons:[...]}) antes de aplicar.';
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      const res = Addons.applyDados(parsed);
      this.renderAddonsList();
      this.renderDebridList();
      this.avisoEl.textContent = `Connect aplicado: ${res.changedAddons} addon(s) e ${res.changedDebrid} conta(s) Debrid atualizados.`;
    } catch {
      this.avisoEl.textContent = 'JSON inválido. Verifique a colagem.';
    }
  }

  private renderQr(): void {
    const info = getCompanionPairingUrl();
    const svg = buildQrSvg(info.url, 220);
    this.qrBoxEl.innerHTML = svg;
    this.qrUrlEl.textContent = info.url;
    this.qrNotaEl.textContent = info.temServidorLocal
      ? 'Escaneie no celular ou abra pelo navegador na mesma rede.'
      : 'WebOS/Tizen puros não abrem socket TCP :8999 sem servidor local; digite a URL pelo controle ou cole o JSON {t:"dados"} do Connect abaixo.';
  }

  private renderAddonsList(): void {
    const list = Addons.list();
    this.listaAddonsEl.innerHTML = '';

    if (list.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'tv-minhas-vazio';
      empty.textContent = 'Nenhum addon instalado ainda. Instale uma URL Stremio acima para liberar catálogos e fontes.';
      this.listaAddonsEl.appendChild(empty);
      return;
    }

    list.forEach((addon: AddonRecord) => {
      const row = document.createElement('div');
      row.className = 'tv-minhas-item';

      const resourcesStr = Array.isArray(addon.manifest.resources)
        ? addon.manifest.resources
            .map((r) => (typeof r === 'string' ? r : r.name))
            .filter(Boolean)
            .join(', ')
        : '';

      const info = document.createElement('div');
      info.className = 't';
      info.innerHTML = `
        <b>${escHtml(addon.name)} (v${escHtml(addon.version)})</b>
        <span>${escHtml(resourcesStr || 'stremio')}  ·  ${addon.enabled ? 'Ativo' : 'Desativado'}</span>
      `;
      row.appendChild(info);

      const addBtn = (text: string, onClick: () => void) => {
        const b = document.createElement('div');
        b.className = 'tv-btn nav-focusable';
        b.setAttribute('data-nav', 'true');
        b.textContent = text;
        b.addEventListener('click', onClick);
        row.appendChild(b);
      };

      addBtn('Testar', async () => {
        this.avisoEl.textContent = `Testando ${addon.name}...`;
        const res = await Addons.test(addon);
        this.avisoEl.textContent = res.ok
          ? `${addon.name}: OK (${res.latencyMs ?? 0}ms)`
          : `${addon.name}: ${res.erro || 'falhou'}`;
      });

      addBtn(addon.enabled ? 'Desativar' : 'Ativar', () => {
        this.confirmRemoveAddonId = null;
        Addons.toggle(addon.id);
        this.renderAddonsList();
      });

      const remLabel = this.confirmRemoveAddonId === addon.id ? 'Confirmar?' : 'Remover';
      addBtn(remLabel, () => {
        if (this.confirmRemoveAddonId !== addon.id) {
          this.confirmRemoveAddonId = addon.id;
          this.renderAddonsList();
          return;
        }
        this.confirmRemoveAddonId = null;
        Addons.remove(addon.id);
        this.avisoEl.textContent = `Addon "${addon.name}" removido.`;
        this.renderAddonsList();
      });

      this.listaAddonsEl.appendChild(row);
    });
  }

  private renderDebridList(): void {
    const accounts = Addons.getDebridAccounts();
    this.debListaEl.innerHTML = '';
    if (accounts.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'tv-minhas-vazio';
      empty.textContent = 'Nenhuma conta Debrid configurada.';
      this.debListaEl.appendChild(empty);
      return;
    }

    accounts.forEach((acc) => {
      const prov = DEBRID_PROVIDERS.find((p) => p.id === acc.provider);
      const row = document.createElement('div');
      row.className = 'tv-minhas-item';
      row.innerHTML = `
        <div class="t">
          <b>${escHtml(prov ? prov.name : acc.provider)}</b>
          <span>Chave configurada localmente${acc.enabled ? '  ·  Ativa' : '  ·  Desativada'}</span>
        </div>
      `;
      this.debListaEl.appendChild(row);
    });
  }

  getElement(): HTMLElement {
    return this.element;
  }

  enter(): void {
    this.element.classList.remove('hidden');
    this.confirmRemoveAddonId = null;
    this.avisoEl.textContent = '';
    this.debAvisoEl.textContent = '';
    this.selectProvider(this.selectedProvider);
    this.renderQr();
    this.renderAddonsList();
    this.renderDebridList();
    SpatialNav.focus(this.urlInput);
  }

  leave(): void {
    this.element.classList.add('hidden');
  }
}
