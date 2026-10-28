#!/bin/bash
#
# Publica o site no Cloudflare Pages sem passar pelo GitHub (upload direto).
#
# ATENÇÃO: o site de verdade (saimo-tv.pages.dev) é um projeto ligado ao Git e publica sozinho
# a cada push na `main` de SaimoTV/Saimo-Site. Este script publica os endereços antigos
# (saimo-tv2 e saimo-tv-f2w), que ficam na mesma conta (Saimo.tv.gs): continuam servindo
# /api/* para apps velhos, e a página leva o usuário ao saimo-tv.pages.dev com os dados.
#
#   ./scripts/publicar_site.sh
#
# Faz o build (bun, por causa do bun.lock) e envia dist/ com a pasta functions/
# (Pages Functions: /api/* e os atalhos /tvbox, /celular, /mac, /windows).
# Autenticação: CLOUDFLARE_API_TOKEN (permissão "Cloudflare Pages: Edit") ou o
# `wrangler login` desta máquina. Passos da troca de GitHub: docs/TROCA-DO-SITE.md
set -euo pipefail
cd "$(dirname "$0")/.."

export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-e074091e48d179d86d956620fc8fa5f6}"
export XDG_CONFIG_HOME="${SAIMO_CF_CONFIG:-$HOME/Library/Application Support/SaimoTV/wrangler-novo}"
PROJETOS="${SAIMO_PROJETO_SITE:-saimo-tv saimo-tv2 saimo-tv-f2w}"

achar_wrangler() {
  if command -v wrangler >/dev/null 2>&1; then command -v wrangler; return; fi
  # Fora do terminal o PATH não tem o nvm: procura onde ele costuma deixar.
  local c
  for c in "$HOME"/.nvm/versions/node/*/bin/wrangler /opt/homebrew/bin/wrangler /usr/local/bin/wrangler; do
    [ -x "$c" ] && { echo "$c"; return; }
  done
  return 1
}

WRANGLER="$(achar_wrangler)" || { echo "wrangler não encontrado (npm i -g wrangler)" >&2; exit 1; }
# O wrangler vive no nvm: precisa do node dele no PATH.
export PATH="$(dirname "$WRANGLER"):$PATH"

if command -v bun >/dev/null 2>&1; then
  # copyfile: no disco externo o bun não consegue clonar/ligar os arquivos do cache.
  bun install --frozen-lockfile --backend=copyfile
  bun run build
else
  npm ci
  npm run build
fi

for PROJETO in $PROJETOS; do
  "$WRANGLER" pages deploy dist --project-name "$PROJETO" --branch main --commit-dirty=true < /dev/null
done
