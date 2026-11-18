/**
 * Ajustes > Conta Saimo na TV da Samsung e da LG. Sem conta: o QR (e o código
 * curto) para entrar pelo celular, que já está logado; a TV pergunta ao
 * servidor a cada 5 s e pede outro código quando vence. Com conta: e-mail,
 * última sincronização, sincronizar agora e sair.
 */
import { SpatialNav } from '../core/SpatialNav';
import { buildQrSvg } from '../../../src/utils/qrCode';
import { conferirAprovacao, estadoConta, pedirCodigoDaTv, sair, sincronizar } from '../../../src/conta/conta';

function esc(t: string): string {
  return t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function haQuanto(ms: number): string {
  if (!ms) return 'ainda não sincronizou';
  const min = Math.floor((Date.now() - ms) / 60000);
  if (min < 1) return 'sincronizado agora';
  if (min < 60) return `sincronizado há ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `sincronizado há ${h} h` : `sincronizado há ${Math.floor(h / 24)} d`;
}

export function resumoDaConta(): string {
  const e = estadoConta();
  if (!e.token) return 'Entrar pelo celular (QR)';
  return `${e.email ?? 'Conta Saimo'} · ${e.erro ?? haQuanto(e.sincronizadaEm)}`;
}

const espera = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

/** A caixa da conta. `fechar` volta para a lista de ajustes. */
export function caixaDaConta(fechar: () => void): HTMLElement {
  const caixa = document.createElement('div');
  caixa.className = 'tv-conta';
  const e = estadoConta();

  if (e.token) {
    caixa.classList.add('logada');
    caixa.innerHTML = `
      <div class="tv-perfis-titulo">Conta Saimo</div>
      <div class="tv-perfis-sub">${esc(e.email ?? '')}</div>
      <div class="tv-perfis-sub tv-conta-situacao">${esc(e.erro ?? haQuanto(e.sincronizadaEm))}</div>
      <div class="tv-perfis-acoes">
        <div class="tv-btn nav-focusable" data-nav="true" data-acao="sincronizar">Sincronizar agora</div>
        <div class="tv-btn nav-focusable" data-nav="true" data-acao="sair">Sair da conta</div>
        <div class="tv-btn nav-focusable" data-nav="true" data-acao="voltar">Voltar</div>
      </div>
      <div class="tv-perfis-sub tv-conta-dica">Perfis, onde parou, favoritos, listas e addons. Sair mantém os dados nesta TV.</div>`;
    const situacao = caixa.querySelector<HTMLElement>('.tv-conta-situacao')!;
    caixa.querySelector('[data-acao="sincronizar"]')!.addEventListener('click', () => {
      situacao.textContent = 'sincronizando…';
      void sincronizar(true).then(() => { const s = estadoConta(); situacao.textContent = s.erro ?? haQuanto(s.sincronizadaEm); });
    });
    caixa.querySelector('[data-acao="sair"]')!.addEventListener('click', () => { void sair().then(fechar); });
    caixa.querySelector('[data-acao="voltar"]')!.addEventListener('click', fechar);
    setTimeout(() => { const b = caixa.querySelector<HTMLElement>('.tv-btn'); if (b) SpatialNav.focus(b); }, 50);
    return caixa;
  }

  caixa.innerHTML = `
    <div class="tv-conta-qr"></div>
    <div class="tv-conta-texto">
      <div class="tv-perfis-titulo">Entrar na Conta Saimo</div>
      <div class="tv-perfis-sub">No celular com o Saimo e a sua conta, leia o QR com a câmera. Ou abra Ajustes &gt; Conta Saimo &gt; Entrar numa TV e digite o código:</div>
      <div class="tv-conta-codigo">…</div>
      <div class="tv-perfis-sub tv-conta-situacao">Pedindo um código…</div>
      <div class="tv-perfis-acoes"><div class="tv-btn nav-focusable" data-nav="true" data-acao="voltar">Voltar</div></div>
      <div class="tv-perfis-sub tv-conta-dica">Sem conta, tudo continua só nesta TV.</div>
    </div>`;
  const qr = caixa.querySelector<HTMLElement>('.tv-conta-qr')!;
  const codigo = caixa.querySelector<HTMLElement>('.tv-conta-codigo')!;
  const situacao = caixa.querySelector<HTMLElement>('.tv-conta-situacao')!;
  caixa.querySelector('[data-acao="voltar"]')!.addEventListener('click', fechar);
  setTimeout(() => { const b = caixa.querySelector<HTMLElement>('.tv-btn'); if (b) SpatialNav.focus(b); }, 50);

  // Pergunta enquanto a caixa estiver na tela; fechou, para sozinho.
  const aberta = () => caixa.isConnected;
  void (async () => {
    await espera(30);
    while (aberta()) {
      let pedido;
      try {
        pedido = await pedirCodigoDaTv();
      } catch (err) {
        situacao.textContent = err instanceof Error ? err.message : 'Sem conexão: tentando de novo…';
        await espera(10_000);
        continue;
      }
      if (!aberta()) return;
      codigo.textContent = pedido.codigo;
      qr.innerHTML = buildQrSvg(pedido.url, 300);
      situacao.textContent = 'Esperando o celular…';
      while (aberta() && Date.now() < pedido.expiraEm) {
        await espera(pedido.intervaloMs);
        if (!aberta()) return;
        let r: boolean | null = false;
        try { r = await conferirAprovacao(pedido); } catch { r = false; }
        if (r === true) {
          situacao.textContent = 'Pronto! Sincronizando…';
          await espera(1500);
          if (aberta()) fechar();
          return;
        }
        if (r === null) break;
      }
    }
  })();
  return caixa;
}
