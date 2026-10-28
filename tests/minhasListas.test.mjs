import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { chaveDoNome, ehRestrito, lerM3u } from '../src/utils/leitorM3u.ts';

const dados = (nome) => readFileSync(new URL(`./dados/${nome}`, import.meta.url), 'utf8');

test('o arquivo de casos difíceis dá exatamente o gabarito', () => {
  assert.deepEqual(lerM3u(dados('edge.m3u')), JSON.parse(dados('edge.golden.json')));
});

// A lista pública real (iptv-org) não vai para o git: aponte para ela com M3U_BR e M3U_BR_GABARITO.
test('lista pública real dá exatamente o gabarito', { skip: !process.env.M3U_BR || !existsSync(process.env.M3U_BR) }, () => {
  const lidos = lerM3u(readFileSync(process.env.M3U_BR, 'utf8'));
  const gabarito = JSON.parse(readFileSync(process.env.M3U_BR_GABARITO, 'utf8'));
  assert.equal(lidos.length, 398);
  assert.deepEqual(lidos, gabarito);
});

test('texto estranho nunca lança e dá lista vazia', () => {
  assert.deepEqual(lerM3u(''), []);
  assert.deepEqual(lerM3u('   \n\n'), []);
  assert.deepEqual(lerM3u('<html><body>404</body></html>'), []);
  assert.deepEqual(lerM3u('\u0000\u0001\u0002�'.repeat(500)), []);
  const enorme = '#EXTINF:-1 tvg-name="' + 'x'.repeat(1_000_000) + '",Nome\nhttps://a.exemplo.com/x.m3u8';
  assert.equal(lerM3u(enorme).length, 1);
});

test('sem cabeçalho #EXTM3U e só com o endereço também vale', () => {
  const r = lerM3u('#EXTINF:-1,Um\nhttps://a.exemplo.com/um.m3u8\nhttps://a.exemplo.com/dois.m3u8');
  assert.deepEqual(r.map((c) => c.nome), ['Um', 'Canal 2']);
});

test('limite de 20 mil canais', () => {
  let t = '#EXTM3U\n';
  for (let i = 0; i < 20050; i++) t += `#EXTINF:-1,Canal numero ${i}\nhttps://a.exemplo.com/${i}.m3u8\n`;
  assert.equal(lerM3u(t).length, 20000);
});

test('a chave do nome ignora acento, caixa e sinais', () => {
  assert.equal(chaveDoNome('Sportv Ação!'), 'sportvacao');
  assert.equal(chaveDoNome('GLOBO'), chaveDoNome('globo'));
});

test('adulto é restrito, mas Adult Swim não', () => {
  assert.equal(ehRestrito({ nome: 'Canal X', grupo: 'Adult' }), true);
  assert.equal(ehRestrito({ nome: 'Filmes XXX', grupo: null }), true);
  assert.equal(ehRestrito({ nome: 'Hentai TV', grupo: 'Animes' }), true);
  assert.equal(ehRestrito({ nome: 'Canal +18', grupo: null }), true);
  assert.equal(ehRestrito({ nome: 'Adulto Mix', grupo: null }), true);
  assert.equal(ehRestrito({ nome: 'Adult Swim', grupo: 'Entertainment' }), false);
  assert.equal(ehRestrito({ nome: 'Adult Swim Brasil', grupo: null }), false);
  assert.equal(ehRestrito({ nome: 'Globo', grupo: 'Abertos' }), false);
  assert.equal(ehRestrito({ nome: 'Sexta Maluca', grupo: null }), false);
});
