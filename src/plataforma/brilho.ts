/**
 * Brilho do app (0 a 100; 100 é o normal): um véu preto por cima da página, não
 * o brilho da tela. Em 0 a tela fica preta; qualquer tecla, botão do controle ou
 * clique traz o brilho de volta, devagar (1,5 s): quem não vê nada não acharia o
 * ajuste. O mesmo arquivo serve o site e as TVs Samsung/LG (tv-native).
 */
const CHAVE = 'saimo-brilho'
export const BRILHO_ESCURO = 5
const ouvintes = new Set<(v: number) => void>()
let veu: HTMLDivElement | null = null
let voltando = false

export function brilho(): number {
  const v = Number(localStorage.getItem(CHAVE) ?? '100')
  return Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 100
}

function aplicar(v: number, duracaoMs = 200) {
  if (!veu) return
  veu.style.transition = `opacity ${duracaoMs}ms linear`
  veu.style.opacity = String(1 - v / 100)
  veu.style.visibility = v >= 100 && duracaoMs <= 200 ? 'hidden' : 'visible'
  if (v >= 100) window.setTimeout(() => { if (veu && brilho() >= 100) veu.style.visibility = 'hidden' }, duracaoMs + 30)
}

export function definirBrilho(valor: number) {
  const v = Math.max(0, Math.min(100, Math.round(valor)))
  localStorage.setItem(CHAVE, String(v))
  voltando = false
  aplicar(v)
  ouvintes.forEach((f) => f(v))
}

export function aoMudarBrilho(f: (v: number) => void): () => void {
  ouvintes.add(f)
  return () => { ouvintes.delete(f) }
}

function voltarAoNormal() {
  voltando = true
  localStorage.setItem(CHAVE, '100')
  aplicar(100, 1500)
  ouvintes.forEach((f) => f(100))
  window.setTimeout(() => { voltando = false }, 1600)
}

/** No escuro, a tecla ou o clique só servem para acender: não chegam ao app. */
function engolir(e: Event) {
  if (brilho() > BRILHO_ESCURO || voltando) return
  e.preventDefault()
  e.stopImmediatePropagation()
  if (e.type === 'keydown' || e.type === 'pointerdown') voltarAoNormal()
}

export function iniciarBrilho() {
  if (veu || typeof document === 'undefined') return
  veu = document.createElement('div')
  veu.setAttribute('aria-hidden', 'true')
  Object.assign(veu.style, {
    position: 'fixed', inset: '0', background: '#000', zIndex: '2147483647',
    pointerEvents: 'none', opacity: '0', visibility: 'hidden',
  })
  document.body.appendChild(veu)
  aplicar(brilho())
  for (const tipo of ['keydown', 'keyup', 'keypress', 'pointerdown', 'pointerup', 'click']) {
    window.addEventListener(tipo, engolir, { capture: true })
  }
}
