#!/usr/bin/env python3
"""Gera tv-native/src/styles/sem-gap.css: margens no lugar do `gap` dos flex.

TVs com Chromium antigo (LG webOS 4.x = Chrome 53; flex `gap` só no Chrome 84)
ignoram o `gap` e deixam botões e cartões colados. O polyfills.ts põe a classe
`sem-gap` no <html> quando o navegador não entende flex gap; estas regras só
valem com ela. Rodar de novo quando mudar um `gap` no tv.css ou tv-box.css.
"""
import re, pathlib
base = pathlib.Path(__file__).resolve().parent.parent / 'tv-native/src/styles'
regras = {}
for nome in ['tv.css', 'tv-box.css']:  # na ordem do main.ts: a última vence
    texto = re.sub(r'/\*.*?\*/', '', (base / nome).read_text(), flags=re.S)
    for m in re.finditer(r'([^{}@]+)\{([^{}]*)\}', texto):
        sel, corpo = m.group(1).strip(), m.group(2)
        g = re.search(r'(?<![-\w])gap\s*:\s*([^;]+)', corpo)
        if not g or 'flex' not in corpo and sel not in regras:
            continue
        valor = g.group(1).strip().split()
        linha, coluna = valor[0], valor[-1]
        coluna_dir = re.search(r'flex-direction\s*:\s*column', corpo) is not None
        quebra = re.search(r'flex-wrap\s*:\s*wrap', corpo) is not None
        ant = regras.get(sel, {})
        regras[sel] = {'linha': linha, 'coluna': coluna,
                       'col': coluna_dir or ant.get('col', False), 'wrap': quebra or ant.get('wrap', False)}
saida = ['/* Gerado por scripts/gerar_sem_gap.py: não editar à mão. */']
for sel, r in regras.items():
    alvos = ', '.join(f'.sem-gap {s.strip()} > *' for s in sel.split(','))
    seguintes = ', '.join(f'.sem-gap {s.strip()} > * + *' for s in sel.split(','))
    if r['wrap']:
        saida.append(f'{alvos} {{ margin-right: {r["coluna"]}; margin-bottom: {r["linha"]}; }}')
    elif r['col']:
        saida.append(f'{seguintes} {{ margin-top: {r["linha"]}; }}')
    else:
        saida.append(f'{seguintes} {{ margin-left: {r["coluna"]}; }}')
(base / 'sem-gap.css').write_text('\n'.join(saida) + '\n')
print(len(regras), 'regras')
