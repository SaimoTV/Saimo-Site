#!/bin/bash
#
# Monta os pacotes nativos do Saimo TV para Samsung (Tizen) e LG (webOS).
# 100% nativo, zero carregador remoto, zero dependência externa em runtime.
#
set -euo pipefail
cd "$(dirname "$0")/.."

VERSAO="$(python3 -c "import json;print(json.load(open('package.json'))['version'])")"
SAIDA="build/tv"
rm -rf "$SAIDA"; mkdir -p "$SAIDA"

echo "==> Compilando motor nativo Smart TV (tv-native)..."
(
  cd tv-native
  if [ ! -d "node_modules" ]; then
    npm install --silent
  fi
  npm run build
)

preparar() { # preparar pasta
  local pasta="$1"
  mkdir -p "$pasta"
  cp tv-native/dist/index.html "$pasta/"
  cp tv-native/dist/saimo-tv.js "$pasta/"
  # Transforma o script em defer comum para compatibilidade universal com TVs antigas (Chrome 53+) e modernas
  sed -i '' 's/type="module" crossorigin/defer/g' "$pasta/index.html" || sed -i 's/type="module" crossorigin/defer/g' "$pasta/index.html"
  if [ -d "public/icons" ]; then
    cp -R public/icons "$pasta/"
  fi
  if [ -f "public/favicon.png" ]; then
    cp public/favicon.png "$pasta/"
  fi
}

echo "==> Samsung (Tizen Nativo)"
T="$SAIDA/tizen"; preparar "$T"
sed "s/%VERSAO%/$VERSAO/" tv/tizen/config.xml > "$T/config.xml"
cp tv/tizen/icon.png "$T/"
if command -v tizen >/dev/null && [ -n "${SAIMO_TIZEN_PERFIL:-}" ]; then
  tizen package -t wgt -s "$SAIMO_TIZEN_PERFIL" -o "$SAIDA" -- "$T" >/dev/null
  mv "$SAIDA"/SaimoTV.wgt "$SAIDA/SaimoTV-Samsung.wgt"
  echo "    assinado com o perfil $SAIMO_TIZEN_PERFIL"
else
  ( cd "$T" && zip -qr "../SaimoTV-Samsung.wgt" . -x '.*' )
  echo "    Pacote Tizen (.wgt) gerado com sucesso."
fi

echo "==> LG (webOS Nativo)"
W="$SAIDA/webos"; preparar "$W"
sed "s/%VERSAO%/$VERSAO/" tv/webos/appinfo.json > "$W/appinfo.json"
cp tv/webos/icon.png tv/webos/largeIcon.png "$W/"
npx --yes -p @webosose/ares-cli ares-package "$W" -o "$SAIDA" --no-minify >/dev/null
mv "$SAIDA"/br.com.saimo.tv_*_all.ipk "$SAIDA/SaimoTV-LG.ipk"
echo "    Pacote webOS (.ipk) gerado com sucesso."

echo ""
echo "==> Pacotes Nativos Prontos em $SAIDA:"
ls -lh "$SAIDA"/*.wgt "$SAIDA"/*.ipk | awk '{print "  " $5 " " $9}'
