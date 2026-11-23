/**
 * Ajustes > Conta Saimo na TV da Samsung e da LG. Sem conta: o QR (e o código
 * curto) para entrar pelo celular, que já está logado; a TV pergunta ao
 * servidor a cada 5 s e pede outro código quando vence. Com conta: e-mail,
 * última sincronização, sincronizar agora e sair.
 */
import { SpatialNav } from '../core/SpatialNav';
import { buildQrSvg } from '../../../src/utils/qrCode';
import { cadastrar, conferirAprovacao, definirSenha, entrarComSenha, estadoConta, pedirCodigo, pedirCodigoDaTv, sair, sincronizar } from '../../../src/conta/conta';

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
      <div class="tv-perfis-acoes">
        <div class="tv-btn nav-focusable" data-nav="true" data-acao="senha">E-mail e senha</div>
        <div class="tv-btn nav-focusable" data-nav="true" data-acao="voltar">Voltar</div>
      </div>
      <div class="tv-perfis-sub tv-conta-dica">Sem conta, tudo continua só nesta TV.</div>
    </div>`;
  const qr = caixa.querySelector<HTMLElement>('.tv-conta-qr')!;
  const codigo = caixa.querySelector<HTMLElement>('.tv-conta-codigo')!;
  const situacao = caixa.querySelector<HTMLElement>('.tv-conta-situacao')!;
  caixa.querySelector('[data-acao="voltar"]')!.addEventListener('click', fechar);
  caixa.querySelector('[data-acao="senha"]')!.addEventListener('click', () => {
    // Troca a caixa do QR pela do e-mail e senha (a do QR para de perguntar sozinha ao sair da tela).
    const senha = caixaDeSenha(fechar, () => senha.replaceWith(caixaDaConta(fechar)));
    caixa.replaceWith(senha);
  });
  setTimeout(() => { const b = caixa.querySelector<HTMLElement>('.tv-btn'); if (b) SpatialNav.focus(b); }, 50);

  // Pergunta enquanto a caixa estiver na tela; fechou, para sozinho. Um código
  // por rodada: venceu, para de perguntar e oferece um novo (cada pergunta é cobrada).
  const aberta = () => caixa.isConnected;
  const acoes = caixa.querySelector<HTMLElement>('.tv-perfis-acoes')!;
  const rodada = async () => {
    caixa.querySelector('[data-acao="novo"]')?.remove();
    situacao.textContent = 'Pedindo um código…';
    let pedido;
    for (let tentativa = 0; aberta() && !pedido; tentativa++) {
      try {
        pedido = await pedirCodigoDaTv();
      } catch (err) {
        if (tentativa >= 2) break;
        situacao.textContent = err instanceof Error ? err.message : 'Sem conexão: tentando de novo…';
        await espera(10_000);
      }
    }
    if (!aberta()) return;
    if (pedido) {
      codigo.textContent = pedido.codigo;
      qr.innerHTML = buildQrSvg(pedido.url, 300);
      situacao.textContent = 'Esperando o celular…';
      while (aberta() && Date.now() < pedido.expiraEm) {
        await espera(pedido.intervaloMs);
        if (!aberta()) return;
        if (document.visibilityState === 'hidden') continue;
        let r: boolean | null;
        try { r = await conferirAprovacao(pedido); } catch { r = false; }
        if (r === true) {
          situacao.textContent = 'Pronto! Sincronizando…';
          await espera(1500);
          if (aberta()) fechar();
          return;
        }
        if (r === null) break;
      }
      if (!aberta()) return;
    }
    qr.innerHTML = '';
    codigo.textContent = '';
    situacao.textContent = pedido ? 'O código venceu.' : 'Sem conexão agora.';
    const novo = document.createElement('div');
    novo.className = 'tv-btn nav-focusable';
    novo.dataset.nav = 'true';
    novo.dataset.acao = 'novo';
    novo.textContent = 'Gerar novo código';
    novo.addEventListener('click', () => { void rodada(); });
    acoes.prepend(novo);
    if (caixa.contains(document.activeElement) || !document.activeElement || document.activeElement === document.body) SpatialNav.focus(novo);
  };
  void (async () => { await espera(30); await rodada(); })();
  return caixa;
}

/**
 * Entrar com e-mail e senha pelo controle. Criar ou trocar a senha fica no
 * celular ou no site, onde chega o código do e-mail.
 */
function caixaDeSenha(fechar: () => void, voltarAoQr?: () => void): HTMLElement {
  const caixa = document.createElement('div');
  caixa.className = 'tv-conta logada';
  caixa.innerHTML = `
    <div class="tv-perfis-titulo">Entrar na Conta Saimo</div>
    <div class="tv-perfis-sub">Entre com o e-mail e a senha da sua conta, ou crie uma conta agora (senha com 8 ou mais).</div>
    <input class="tv-campo tv-conta-campo nav-focusable" data-nav="true" type="email" autocomplete="username" placeholder="Seu e-mail" />
    <input class="tv-campo tv-conta-campo nav-focusable" data-nav="true" type="password" autocomplete="current-password" placeholder="Senha" />
    <div class="tv-perfis-aviso"></div>
    <div class="tv-perfis-acoes">
      <div class="tv-btn nav-focusable" data-nav="true" data-acao="entrar">Entrar</div>
      <div class="tv-btn nav-focusable" data-nav="true" data-acao="criar">Criar conta</div>
      <div class="tv-btn nav-focusable" data-nav="true" data-acao="esqueci">Esqueci a senha</div>
      <div class="tv-btn nav-focusable" data-nav="true" data-acao="voltar">${voltarAoQr ? 'Voltar ao QR code' : 'Voltar'}</div>
    </div>`;
  const [email, senha] = Array.from(caixa.querySelectorAll<HTMLInputElement>('input'));
  const aviso = caixa.querySelector<HTMLElement>('.tv-perfis-aviso')!;
  let ocupado = false;
  const entrar = (criar = false) => {
    if (ocupado) return;
    const e = email.value.trim();
    if (!e.includes('@') || !senha.value) { aviso.textContent = 'Digite o e-mail e a senha'; return; }
    if (criar && senha.value.length < 8) { aviso.textContent = 'A senha precisa ter 8 ou mais caracteres'; return; }
    ocupado = true;
    aviso.textContent = criar ? 'Criando a conta…' : 'Entrando…';
    (criar ? cadastrar(e, senha.value) : entrarComSenha(e, senha.value))
      .then(() => fechar())
      .catch((err) => { aviso.textContent = err instanceof Error ? err.message : 'Não deu certo'; senha.value = ''; })
      .finally(() => { ocupado = false; });
  };
  [email, senha].forEach((c) => {
    c.addEventListener('click', () => window.setTimeout(() => c.focus(), 30));
    c.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && c === senha) entrar(); });
  });
  caixa.querySelector('[data-acao="entrar"]')!.addEventListener('click', () => entrar());
  caixa.querySelector('[data-acao="criar"]')!.addEventListener('click', () => entrar(true));
  caixa.querySelector('[data-acao="voltar"]')!.addEventListener('click', voltarAoQr || fechar);
  caixa.querySelector('[data-acao="esqueci"]')!.addEventListener('click', () => {
    const rec = caixaRecuperar(fechar, email.value.trim(), () => rec.replaceWith(caixaDeSenha(fechar, voltarAoQr)));
    caixa.replaceWith(rec);
  });
  setTimeout(() => SpatialNav.focus(email), 50);
  return caixa;
}

/** Esqueci a senha: o código de 6 números chega no e-mail; com ele se escolhe uma senha nova. */
function caixaRecuperar(fechar: () => void, emailInicial: string, voltar: () => void): HTMLElement {
  const caixa = document.createElement('div');
  caixa.className = 'tv-conta logada';
  caixa.innerHTML = `
    <div class="tv-perfis-titulo">Esqueci a senha</div>
    <div class="tv-perfis-sub">Digite o e-mail da conta: enviamos um código de 6 números (veja também o spam). Com ele você escolhe uma senha nova.</div>
    <input class="tv-campo tv-conta-campo nav-focusable" data-nav="true" type="email" placeholder="Seu e-mail" />
    <input class="tv-campo tv-conta-campo nav-focusable" data-nav="true" type="text" inputmode="numeric" placeholder="Código do e-mail" style="display:none" />
    <input class="tv-campo tv-conta-campo nav-focusable" data-nav="true" type="password" placeholder="Senha nova (8 ou mais)" style="display:none" />
    <div class="tv-perfis-aviso"></div>
    <div class="tv-perfis-acoes">
      <div class="tv-btn nav-focusable" data-nav="true" data-acao="enviar">Enviar código</div>
      <div class="tv-btn nav-focusable" data-nav="true" data-acao="salvar" style="display:none">Salvar senha</div>
      <div class="tv-btn nav-focusable" data-nav="true" data-acao="voltar">Voltar</div>
    </div>`;
  const [email, codigo, senha] = Array.from(caixa.querySelectorAll<HTMLInputElement>('input'));
  const aviso = caixa.querySelector<HTMLElement>('.tv-perfis-aviso')!;
  const enviar = caixa.querySelector<HTMLElement>('[data-acao="enviar"]')!;
  const salvar = caixa.querySelector<HTMLElement>('[data-acao="salvar"]')!;
  email.value = emailInicial;
  let ocupado = false;
  [email, codigo, senha].forEach((c) => c.addEventListener('click', () => window.setTimeout(() => c.focus(), 30)));
  enviar.addEventListener('click', () => {
    if (ocupado) return;
    if (!email.value.includes('@')) { aviso.textContent = 'Digite o e-mail da conta'; return; }
    ocupado = true; aviso.textContent = 'Enviando…';
    pedirCodigo(email.value)
      .then(() => {
        aviso.textContent = 'Enviamos o código: digite abaixo e escolha a senha nova.';
        codigo.style.display = senha.style.display = salvar.style.display = '';
        enviar.textContent = 'Enviar de novo';
        SpatialNav.focus(codigo);
      })
      .catch((err) => { aviso.textContent = err instanceof Error ? err.message : 'Não deu certo'; })
      .finally(() => { ocupado = false; });
  });
  salvar.addEventListener('click', () => {
    if (ocupado) return;
    if (codigo.value.trim().length < 6) { aviso.textContent = 'Digite o código de 6 números'; return; }
    if (senha.value.length < 8) { aviso.textContent = 'A senha precisa ter 8 ou mais caracteres'; return; }
    ocupado = true; aviso.textContent = 'Salvando…';
    definirSenha(email.value, codigo.value, senha.value)
      .then(() => fechar())
      .catch((err) => { aviso.textContent = err instanceof Error ? err.message : 'Não deu certo'; })
      .finally(() => { ocupado = false; });
  });
  caixa.querySelector('[data-acao="voltar"]')!.addEventListener('click', voltar);
  setTimeout(() => SpatialNav.focus(email.value ? enviar : email), 50);
  return caixa;
}
