# Saimo TV — Web

<p align="center">
  Saimo TV: <a href="https://github.com/SaimoTV/SaimoTV-Android">TV Box</a> · <a href="https://github.com/SaimoTV/Saimo-Cell-V2">Celular</a> · <a href="https://github.com/SaimoTV/SaimoWin">Windows</a> · <a href="https://github.com/SaimoTV/SaimoPlayer">Mac</a> · <a href="https://github.com/SaimoTV/SaimoCatalogos">Catálogo</a> · <b>Site</b> · <a href="https://github.com/SaimoTV/saimo-downloads">Downloads</a>
</p>

Canais ao vivo, guia de programação, filmes e séries direto no navegador:
**<https://saimo-tv.pages.dev>**. Versão atual: **2.5.1**.

O site não embute lista nenhuma (nem de canais, nem de filmes, nem tabelas do guia)
nem endereço de lista. Na primeira visita a tela mostra "Bem-vindo ao Saimo!" com
**Adicionar lista** (Ajustes > Minhas listas: link **M3U** ou **servidor + usuário +
senha**, que são opcionais; `src/utils/xtream.ts`, compartilhado com as TVs Samsung e
LG) e **Endereços do Saimo** (Ajustes > Listas, formato do Saimo; sem padrão). O que a
pessoa já tinha gravado continua. O relay `/api/stream` lê o catálogo de apoio da variável
`CATALOGO_FILMES` do projeto no Cloudflare Pages (sem ela, não consulta catálogo).
**Páginas institucionais** (`src/landing/`): a raiz `/` é sempre a apresentação do
projeto, e o app no navegador fica em **`/home`** ("Abrir no navegador"; o PWA abre em
`/home`). Só a TV (pacote ou navegador da TV) e o app instalado abrem direto no app em
`/`. A apresentação também responde em `/sobre`. O topo dela é uma réplica da
interface real (`TelaDoApp.tsx`: Início, Ao vivo e On Demand, com lista de
demonstração), mais `/formato` (formato de lista do Saimo), `/privacidade`, `/termos`, `/conteudo`, `/exclusao-de-dados` e `/suporte`. O e-mail de
contato e o responsável legal ficam em `src/landing/config.ts`. A aba iPhone de `/app`
avisa que o app para iPhone vem em breve. A aba Linux oferece o AppImage (x86_64, ou ARM quando o
navegador se anuncia ARM) e, embaixo, o `.deb` e os pacotes de ARM. Os links de download e os
atalhos `/tvbox`, `/celular`, `/mac`, `/windows`, `/linux`, `/linux-arm`, `/samsung` e `/lg` saem dos anexos da última
release de [`SaimoTV/saimo-downloads`](https://github.com/SaimoTV/saimo-downloads/releases/latest),
lidos na hora; o [`versao.json`](https://github.com/SaimoTV/saimo-downloads/releases/latest/download/versao.json) só informa a versão. Desde a 2.8.0 o endereço de fábrica de quem nunca escolheu fica gravado (`localStorage` no site, `Storage.guardarLinksDeFabrica` na TV).

---

## O que tem

- **TV ao vivo com Zero Delay (Normal e Ultra):** Sincronização em tempo real na borda da transmissão sem congelamentos, suporte nativo a HLS (`hls.js`), MPEG-TS (`mpegts.js`) e DASH, com chaveamento automático de fontes reservas se uma oscilar.
- **Áudio Inteligente:** Normalização dinâmica de volume para equalizar canais baixos e altos sem estourar o som.
- **Saimo Connect:** Controle do player via celular pela rede local.
- **Guia de programação (EPG):** Grade completa com linha do "agora", sinopse do programa e botão para assistir (tecla **G** abre e fecha).
- **Filmes e séries On Demand:** Catálogo com capas, sinopse, temporadas, episódios e favoritos.
- **Troca de fonte nas TVs Samsung/LG** (2.7.1): o vigia do Ao vivo mede o andamento do fluxo novo a partir do primeiro tempo que ele informa (o player do Tizen guardava o tempo do canal anterior e trocava de fonte com o canal tocando); erro do `<video>` com o hls.js no comando é ignorado (ele mesmo se recupera); fonte que já tocou e cai é reaberta uma vez antes de trocar.
- **Filtros do On Demand** (site e TVs Samsung/LG): ano, idade (classificação indicativa), nota mínima e ordem (mais populares, mais bem avaliados, mais novos, A–Z) junto do gênero, sobre a seção inteira. No site, o botão "Filtrar" abre a grade com os filtros; na TV, a barra de filtros abre um seletor navegável pelo controle. Dados do `detalhes.txt` do catálogo.
- **Continuidade inteligente:** O episódio seguinte lembra a fonte preferida anterior (mesmo servidor, mesma faixa de áudio dublado/legendado).
- **Busca universal:** Pesquisa rápida em todo o acervo (filmes, séries, animes e novelas).
- **Pular abertura e créditos:** Integração automática com tempos do TheIntroDB.
- **Legendas sincronizadas:** Suporte a legendas integradas e OpenSubtitles com ajuste de delay em tempo real.
- **Chromecast:** Transmissão direta para aparelhos Google TV e Chromecast na rede.
- **Modo PWA:** Instalável como aplicativo nativo no Chrome/Edge/Safari mobile com suporte a atalhos.
- **Responsivo para Celular:** Layout otimizado para toque, rotação automática em tela cheia e controle gestual.
- **Smart TVs:** Compatibilidade com navegadores de Smart TVs e geração dos pacotes empacotados Samsung Tizen (`.wgt`) e LG webOS (`.ipk`).

---

## Estrutura do Projeto

| Pasta | Descrição |
|---|---|
| `src/components` | Telas e componentes: player ao vivo, VOD, guia EPG, barra de canais, modals |
| `src/services` | Serviços de catálogo, EPG, áudio inteligente, legendas, telemetria e conectividade |
| `src/hooks` | Hooks React para Media Session, atalhos, vigia de playback e tela cheia |
| `src/utils` | Utilitários de Zero Delay, HLS, MPEG-TS, normalização de links e formatos |
| `functions/` | Cloudflare Pages Functions para proxy CORS (`/api/*`) e atalhos de download |
| `public/` | Ícones, manifest PWA, service worker, abertura e regras de redirecionamento |
| `tv/` | Estrutura e carregador para Smart TVs Samsung (Tizen) e LG (webOS) |

---

## Fontes sem endereço à mostra

- As listas de fontes (canais e filmes) mostram só "Fonte N", o nome da fonte
  (ex.: "Temporada 3") e a qualidade; nunca o servidor nem o endereço.
- Fonte `/api/stream` é resolvida ao abrir o título, porque o destino muda a cada
  pedido e pode ser HLS; o player precisa do endereço final para escolher como tocar.
- Copiar link, compartilhar, abrir em player externo e abrir em nova aba só
  aparecem para fonte **http** (que o site não toca); https nunca sai do site
  (`castService.getAvailableMethods(url)` e trava em `castService.cast`).
- Extensão FlowPick (sniffer de HLS/MP4): `src/plataforma/bloqueioExtensoes.ts`
  detecta as marcas dela (`script[data-m3u8-injected]`, `window.__flowpickPageHook`,
  mensagens `FLOWPICK_*`). Detectada, todo vídeo/rádio para e nada mais carrega,
  sem aviso na tela.

## Minhas listas

Em Ajustes, a pessoa cola o link de uma lista `.m3u` comum (ou escolhe um arquivo) e os canais entram na categoria "Minhas listas". A lista fica só no navegador (metadados no localStorage, canais lidos no IndexedDB) e é atualizada sozinha após 12 h. Canais de grupo adulto só aparecem depois do desbloqueio.

- Leitor: `src/utils/leitorM3u.ts` (idêntico nos cinco clientes; testado contra gabarito em `tests/minhasListas.test.mjs`).
- Download e armazenamento: `src/services/minhasListas.ts`. Tenta direto; se o servidor não liberar CORS, usa `/api/proxy?raw=1` (`functions/api/proxy.ts`).
- Tela: `src/telas/MinhasListas.tsx`.

## Custo do proxy

Cada pedido a `/api/proxy` é uma invocação paga das Pages Functions (o plano de
US$ 5 inclui 10 milhões por mês). Para gastar menos:

- `src/utils/segmentoDireto.ts`: segmentos https que vieram pelo proxy são
  pedidos direto à origem; se falhar (CORS, 403, demora, resposta que não é
  vídeo) o mesmo pedido volta ao proxy na hora e o servidor fica lembrado por 6 h.
  Ficam sempre no proxy: segmento http, fonte com `referer`/`agente` e os CDNs
  cujo corpo o proxy conserta (TikTok).
- O player mostra "Este canal toca mais leve no app grátis" quando o canal passa
  pelo proxy (some por 7 dias ao fechar): os apps tocam direto, sem proxy.
- Telemetria e contagem de online estão desligadas (`/telemetria.json` com 0%).
- Espelhos `saimo-tv2` e `saimo-tv-f2w` (mesma conta): `scripts/publicar_site.sh`.

---

## Desenvolvimento Local

Com [Bun](https://bun.sh) (ou npm):

```bash
bun install
bun run dev        # Inicia o servidor local em http://localhost:5173
bun run build      # Gera o build de produção em dist/
bun run lint       # Validação de código e tipos
```

---

## Smart TVs (Samsung Tizen e LG webOS)

O código da web é empacotado para Smart TVs através do script:

```bash
./scripts/montar_tv.sh
```

Gera `build/tv/SaimoTV-Samsung.wgt` e `build/tv/SaimoTV-LG.ipk`.
O pacote contém o carregador leve (`tv/comum/carregador.js`) que busca a versão atualizada do site ao abrir.
