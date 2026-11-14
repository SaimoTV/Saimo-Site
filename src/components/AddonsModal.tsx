/**
 * Modal de gerenciamento de Addons (protocolo Stremio), Debrid cliente-direto e sync `{t: "dados"}`.
 * Começa 100% vazio; nenhuma requisição de vídeo ou API Debrid passa pelo servidor do Saimo.
 */

import { useEffect, useState } from 'react';
import {
  aplicarDadosConnect,
  exportConnectDadosPayload,
  installAddonFromUrl,
  removeAddon,
  testAddon,
  toggleAddon,
  useAddons,
  type AddonRecord,
} from '../services/addons';
import {
  DEBRID_PROVIDERS,
  removeDebridAccount,
  saveDebridAccount,
  testDebridAccount,
  useDebridAccounts,
  type DebridProviderId,
} from '../services/debrid';
import { normalizeManifestResources } from '../utils/addonProtocol';
import './AddonsModal.css';

type Aba = 'addons' | 'debrid' | 'connect';

const ROTULO_RECURSO: Record<string, string> = {
  catalog: 'Catálogo',
  meta: 'Metadados',
  stream: 'Streams',
  subtitles: 'Legendas',
};

interface Props {
  aberta: boolean;
  aoFechar: () => void;
  abaInicial?: Aba;
}

export function AddonsModal({ aberta, aoFechar, abaInicial = 'addons' }: Props) {
  const addons = useAddons();
  const debridAccounts = useDebridAccounts();
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [urlInput, setUrlInput] = useState('');
  const [instalando, setInstalando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'erro' | 'ok'; texto: string } | null>(null);
  const [testandoId, setTestandoId] = useState<string | null>(null);
  const [chaves, setChaves] = useState<Record<DebridProviderId, string>>({
    torbox: '',
    realdebrid: '',
    alldebrid: '',
    premiumize: '',
  });
  const [syncOpts, setSyncOpts] = useState<Record<DebridProviderId, boolean>>({
    torbox: false,
    realdebrid: false,
    alldebrid: false,
    premiumize: false,
  });
  const [testandoDebrid, setTestandoDebrid] = useState<DebridProviderId | null>(null);
  const [jsonImport, setJsonImport] = useState('');

  useEffect(() => {
    if (!aberta) return;
    setAba(abaInicial);
    setAviso(null);
    const nextChaves: Record<DebridProviderId, string> = {
      torbox: '',
      realdebrid: '',
      alldebrid: '',
      premiumize: '',
    };
    const nextSync: Record<DebridProviderId, boolean> = {
      torbox: false,
      realdebrid: false,
      alldebrid: false,
      premiumize: false,
    };
    for (const acc of debridAccounts) {
      nextChaves[acc.provider] = acc.apiKey;
      nextSync[acc.provider] = Boolean(acc.syncWithConnect);
    }
    setChaves(nextChaves);
    setSyncOpts(nextSync);
  }, [aberta, abaInicial, debridAccounts]);

  useEffect(() => {
    if (!aberta) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        aoFechar();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberta, aoFechar]);

  if (!aberta) return null;

  const instalar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || instalando) return;
    setInstalando(true);
    setAviso(null);
    const res = await installAddonFromUrl(urlInput);
    setInstalando(false);
    if (!res.ok) {
      setAviso({ tipo: 'erro', texto: res.error || 'Não foi possível instalar o addon.' });
      return;
    }
    setUrlInput('');
    setAviso({
      tipo: 'ok',
      texto: `Addon "${res.addon?.manifest.name}" v${res.addon?.manifest.version} instalado!`,
    });
  };

  const testarUm = async (addon: AddonRecord) => {
    setTestandoId(addon.id);
    setAviso(null);
    const res = await testAddon(addon);
    setTestandoId(null);
    if (res.ok) {
      setAviso({
        tipo: 'ok',
        texto: `${addon.manifest.name}: online (${res.latencyMs ?? 0} ms).`,
      });
    } else {
      setAviso({
        tipo: 'erro',
        texto: `${addon.manifest.name}: ${res.error || 'falha no teste.'}`,
      });
    }
  };

  const salvarDebrid = (provider: DebridProviderId, enabledOverride?: boolean) => {
    const key = chaves[provider].trim();
    if (!key) {
      removeDebridAccount(provider);
      setAviso({ tipo: 'ok', texto: 'Chave removida.' });
      return;
    }
    const atual = debridAccounts.find((a) => a.provider === provider);
    saveDebridAccount({
      provider,
      apiKey: key,
      enabled: enabledOverride !== undefined ? enabledOverride : (atual ? atual.enabled : true),
      syncWithConnect: syncOpts[provider],
    });
    setAviso({ tipo: 'ok', texto: 'Configuração Debrid salva neste aparelho.' });
  };

  const testarDebrid = async (provider: DebridProviderId) => {
    const key = chaves[provider].trim();
    if (!key) {
      setAviso({ tipo: 'erro', texto: 'Informe a chave de API antes de testar.' });
      return;
    }
    setTestandoDebrid(provider);
    setAviso(null);
    const res = await testDebridAccount(provider, key);
    setTestandoDebrid(null);
    if (res.ok) {
      saveDebridAccount({
        provider,
        apiKey: key,
        enabled: true,
        syncWithConnect: syncOpts[provider],
      });
      setAviso({ tipo: 'ok', texto: `Conta validada: ${res.label}` });
    } else {
      setAviso({ tipo: 'erro', texto: res.error || 'Chave rejeitada pelo provedor.' });
    }
  };

  const copiarDadosConnect = async () => {
    const payload = JSON.stringify(exportConnectDadosPayload(), null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      setAviso({
        tipo: 'ok',
        texto: 'JSON { "t": "dados" } copiado (apenas chaves Debrid marcadas para sync foram incluídas).',
      });
    } catch {
      setJsonImport(payload);
      setAviso({ tipo: 'ok', texto: 'JSON gerado abaixo para você copiar.' });
    }
  };

  const importarDadosConnect = () => {
    if (!jsonImport.trim()) {
      setAviso({ tipo: 'erro', texto: 'Cole o JSON recebido pelo Saimo Connect.' });
      return;
    }
    try {
      const parsed = JSON.parse(jsonImport);
      const res = aplicarDadosConnect(parsed);
      setAviso({
        tipo: 'ok',
        texto: `Sincronização aplicada: ${res.addonsUpdated} addon(s) e ${res.debridUpdated} conta(s) Debrid atualizados.`,
      });
    } catch {
      setAviso({ tipo: 'erro', texto: 'JSON inválido. Verifique o conteúdo colado.' });
    }
  };

  return (
    <div
      className="addons-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Gerenciar Addons e Debrid"
      onClick={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
    >
      <div className="addons-modal">
        <div className="addons-modal-topo">
          <h2>Addons &amp; Debrid (Protocolo Stremio)</h2>
          <button type="button" className="addons-modal-fechar" onClick={aoFechar} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="addons-abas" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'addons'}
            className={`addons-aba${aba === 'addons' ? ' ativa' : ''}`}
            onClick={() => { setAba('addons'); setAviso(null); }}
          >
            Addons ({addons.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'debrid'}
            className={`addons-aba${aba === 'debrid' ? ' ativa' : ''}`}
            onClick={() => { setAba('debrid'); setAviso(null); }}
          >
            Debrid ({debridAccounts.filter((d) => d.enabled).length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'connect'}
            className={`addons-aba${aba === 'connect' ? ' ativa' : ''}`}
            onClick={() => { setAba('connect'); setAviso(null); }}
          >
            Sincronizar (Connect)
          </button>
        </div>

        <div className="addons-corpo">
          {aviso && (
            <div className={`addons-aviso ${aviso.tipo}`} role="status">
              {aviso.texto}
            </div>
          )}

          {aba === 'addons' && (
            <>
              <p className="addons-nota">
                Cole a URL de um manifesto Stremio (<code>https://.../manifest.json</code> ou{' '}
                <code>stremio://...</code>). As chamadas são feitas diretamente do seu aparelho para o
                addon, sem passar pelos servidores do Saimo.
              </p>

              <form className="addons-form-linha" onSubmit={instalar}>
                <input
                  type="text"
                  className="addons-input"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://exemplo.com/manifest.json ou stremio://..."
                  disabled={instalando}
                />
                <button type="submit" className="addons-btn principal" disabled={instalando}>
                  {instalando ? 'Instalando…' : 'Instalar addon'}
                </button>
              </form>

              {addons.length === 0 ? (
                <div className="addons-vazio">
                  <strong>Nenhum addon instalado.</strong>
                  <br />
                  O Saimo começa 100% vazio de fontes de terceiros. Instale um addon compatível com o
                  protocolo Stremio acima para buscar streams, catálogos e legendas extras.
                </div>
              ) : (
                <div className="addons-lista">
                  {addons.map((addon) => {
                    const recs = normalizeManifestResources(addon.manifest);
                    return (
                      <div key={addon.id} className={`addons-card${addon.enabled ? '' : ' desativado'}`}>
                        <div className="addons-card-topo">
                          <div>
                            <div className="addons-card-titulo">
                              <span>{addon.manifest.name}</span>
                              <span className="addons-tag verde">v{addon.manifest.version}</span>
                              {!addon.enabled && <span className="addons-tag aviso">Desativado</span>}
                              {addon.manifest.behaviorHints?.configurationRequired && (
                                <span className="addons-tag aviso">Requer config no link</span>
                              )}
                            </div>
                            {addon.manifest.description && (
                              <p className="addons-card-desc">{addon.manifest.description}</p>
                            )}
                            <div className="addons-card-url">{addon.manifestUrl}</div>
                          </div>
                        </div>

                        <div className="addons-tags">
                          {recs.map((r) => (
                            <span key={r.name} className="addons-tag">
                              {ROTULO_RECURSO[r.name] || r.name}
                            </span>
                          ))}
                          {addon.manifest.catalogs.length > 0 && (
                            <span className="addons-tag verde">
                              {addon.manifest.catalogs.length} catálogo(s)
                            </span>
                          )}
                        </div>

                        <div className="addons-acoes">
                          <button
                            type="button"
                            className="addons-btn"
                            disabled={testandoId === addon.id}
                            onClick={() => void testarUm(addon)}
                          >
                            {testandoId === addon.id ? 'Testando…' : 'Testar'}
                          </button>
                          <button
                            type="button"
                            className="addons-btn"
                            onClick={() => toggleAddon(addon.id)}
                          >
                            {addon.enabled ? 'Desativar' : 'Ativar'}
                          </button>
                          <button
                            type="button"
                            className="addons-btn perigo"
                            onClick={() => removeAddon(addon.id)}
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {aba === 'debrid' && (
            <>
              <p className="addons-nota">
                Configure chaves Debrid para resolver torrents (<code>infoHash</code>) diretamente do seu
                aparelho sem P2P local. Na Web, provedores sem cabeçalho CORS (como Real-Debrid/AllDebrid)
                funcionam melhor no aplicativo nativo de TV/desktop ou via TorBox.
              </p>

              <div className="addons-lista">
                {DEBRID_PROVIDERS.map((prov) => {
                  const saved = debridAccounts.find((a) => a.provider === prov.id);
                  return (
                    <div key={prov.id} className="addons-card">
                      <div className="addons-card-topo">
                        <div>
                          <div className="addons-card-titulo">
                            <span>{prov.name}</span>
                            {prov.browserCorsFriendly ? (
                              <span className="addons-tag verde">CORS compatível</span>
                            ) : (
                              <span className="addons-tag aviso">Melhor no app nativo</span>
                            )}
                            {saved?.enabled && <span className="addons-tag verde">Ativo</span>}
                          </div>
                          <p className="addons-card-desc">{prov.note}</p>
                        </div>
                      </div>

                      <div className="addons-form-linha">
                        <input
                          type="password"
                          className="addons-input"
                          value={chaves[prov.id]}
                          onChange={(e) => setChaves((prev) => ({ ...prev, [prov.id]: e.target.value }))}
                          placeholder={`Cole sua API Key do ${prov.name}`}
                          autoComplete="off"
                        />
                        <button
                          type="button"
                          className="addons-btn principal"
                          onClick={() => salvarDebrid(prov.id, true)}
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          className="addons-btn"
                          disabled={testandoDebrid === prov.id}
                          onClick={() => void testarDebrid(prov.id)}
                        >
                          {testandoDebrid === prov.id ? 'Testando…' : 'Testar'}
                        </button>
                        {saved && (
                          <button
                            type="button"
                            className="addons-btn perigo"
                            onClick={() => {
                              removeDebridAccount(prov.id);
                              setChaves((p) => ({ ...p, [prov.id]: '' }));
                            }}
                          >
                            Remover
                          </button>
                        )}
                      </div>

                      <label className="addons-check">
                        <input
                          type="checkbox"
                          checked={syncOpts[prov.id]}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSyncOpts((p) => ({ ...p, [prov.id]: checked }));
                            if (saved) {
                              saveDebridAccount({ ...saved, syncWithConnect: checked });
                            }
                          }}
                        />
                        <span>Incluir esta chave ao exportar/enviar para outra TV (opt-in)</span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {aba === 'connect' && (
            <>
              <p className="addons-nota">
                Exporte seus addons no formato <code>{'{ "t": "dados" }'}</code> do Saimo Connect ou cole
                aqui um pacote vindo de outro aparelho. Chaves Debrid só entram se você marcar a opção
                opt-in na aba Debrid.
              </p>

              <div className="addons-acoes">
                <button type="button" className="addons-btn principal" onClick={() => void copiarDadosConnect()}>
                  Copiar JSON de sincronização
                </button>
              </div>

              <textarea
                className="addons-textarea"
                value={jsonImport}
                onChange={(e) => setJsonImport(e.target.value)}
                placeholder='{ "t": "dados", "addons": [ ... ] }'
              />

              <div className="addons-acoes">
                <button type="button" className="addons-btn" onClick={importarDadosConnect}>
                  Aplicar JSON neste aparelho
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
