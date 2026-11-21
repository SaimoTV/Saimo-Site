#!/usr/bin/env node
/**
 * Gera src/data/mapaMundi.json: os contornos dos países já projetados (Natural
 * Earth 1, 1000 × 500) como caminhos SVG, e o centro de cada país para as
 * bolinhas do mapa de canais (`/grade`, visão Mapa).
 *
 * Roda só quando os contornos precisarem mudar: o site lê o JSON pronto e não
 * leva biblioteca de mapa nenhuma. As dependências ficam fora do projeto:
 *
 *   mkdir /tmp/mapa && cd /tmp/mapa && npm init -y
 *   npm install d3-geo@3.1.1 topojson-client@3.1.0 world-atlas@2.0.2 i18n-iso-countries@7.14.0
 *   node scripts/gerar_mapa_mundi.mjs /tmp/mapa
 *
 * Contornos: Natural Earth 1:110m (domínio público), via world-atlas. Os centros
 * vêm do 1:50m, que tem os países pequenos (Malta, Singapura, Hong Kong…) que
 * somem no 1:110m.
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const pasta = process.argv[2];
if (!pasta) {
  console.error('Uso: node scripts/gerar_mapa_mundi.mjs <pasta com node_modules das dependências>');
  process.exit(1);
}
const require = createRequire(path.join(path.resolve(pasta), 'package.json'));
const { geoNaturalEarth1, geoPath, geoArea } = require('d3-geo');
const { feature } = require('topojson-client');
const paises = require('i18n-iso-countries');

const LARGURA = 1000;
const ALTURA = 500;

/** Código de duas letras pelo id numérico (ISO 3166-1) ou, sem id, pelo nome. */
function codigoDe(f) {
  const porNumero = f.id ? paises.numericToAlpha2(f.id) : undefined;
  if (porNumero) return porNumero;
  const nome = f.properties?.name;
  if (nome === 'Kosovo') return 'XK';
  if (nome === 'N. Cyprus') return 'CY';
  if (nome === 'Somaliland') return 'SO';
  return nome ? paises.getAlpha2Code(nome, 'en') : undefined;
}

const t110 = require('world-atlas/countries-110m.json');
const t50 = require('world-atlas/countries-50m.json');
const g110 = feature(t110, t110.objects.countries).features.filter((f) => f.properties?.name !== 'Antarctica');
const g50 = feature(t50, t50.objects.countries).features.filter((f) => f.properties?.name !== 'Antarctica');

const projecao = geoNaturalEarth1().fitExtent([[4, 4], [LARGURA - 4, ALTURA - 4]], { type: 'FeatureCollection', features: g110 });
const caminho = geoPath(projecao).digits(1);

/** Centro do maior pedaço do país: a França fica na Europa, não entre ela e a Guiana. */
function centro(f) {
  const g = f.geometry;
  let maior = g;
  if (g.type === 'MultiPolygon') {
    let area = -1;
    for (const coords of g.coordinates) {
      const parte = { type: 'Polygon', coordinates: coords };
      const a = geoArea(parte);
      if (a > area) { area = a; maior = parte; }
    }
  }
  const [x, y] = geoPath(projecao).centroid(maior);
  return Number.isFinite(x) ? [Math.round(x * 10) / 10, Math.round(y * 10) / 10] : null;
}

const contornos = [];
for (const f of g110) {
  const c = codigoDe(f);
  const d = caminho(f);
  if (d) contornos.push({ c: c ?? '', d });
}

const centros = {};
for (const f of g50) {
  const c = codigoDe(f);
  if (!c || centros[c]) continue;
  const p = centro(f);
  if (p) centros[c] = p;
}

// Territórios que o Natural Earth junta ao país (França, Holanda) mas que as
// listas marcam à parte: posição à mão, em longitude e latitude.
const AVULSOS = { BQ: [-68.26, 12.18], GP: [-61.55, 16.25], MQ: [-61.02, 14.64], GF: [-53.1, 3.93], RE: [55.53, -21.12], YT: [45.17, -12.82] };
for (const [c, lonLat] of Object.entries(AVULSOS)) {
  if (centros[c]) continue;
  const [x, y] = projecao(lonLat);
  centros[c] = [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

const saida = { largura: LARGURA, altura: ALTURA, contornos, centros };
const destino = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'mapaMundi.json');
writeFileSync(destino, JSON.stringify(saida));
console.log(`${contornos.length} contornos, ${Object.keys(centros).length} centros → ${destino}`);
