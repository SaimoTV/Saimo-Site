// Antes de tudo: os dados de perfil (favoritos, progresso) leem do perfil ativo.
import './perfis/instalar'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/dpad-navigation.css'
import './styles/tv-4k.css'
import App from './App.tsx'
import { iniciar as iniciarTelemetria } from './services/telemetria'
import { migrarUmaVez } from './services/listas'
import { iniciarTv } from './plataforma/tv'
import { vigiarExtensoes } from './plataforma/bloqueioExtensoes'
import { iniciarBrilho } from './plataforma/brilho'
import { iniciarConta } from './conta/conta'
import { adaptadorDoSite } from './conta/site'
import { mostrarFalha, ProtecaoDeFalha } from './plataforma/falha'

try {
  // Antes de qualquer tela: esquece o que as versões anteriores guardaram de listas.
  migrarUmaVez()
  // Antes de tudo: extensão que captura os endereços (FlowPick) bloqueia o site.
  vigiarExtensoes()
  iniciarTv()
  iniciarBrilho()
  iniciarTelemetria()
  // Conta Saimo (opcional): sem login, não faz nada.
  iniciarConta(adaptadorDoSite)
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ProtecaoDeFalha>
        <App />
      </ProtecaoDeFalha>
    </StrictMode>,
  )
} catch (erro) {
  // Quebrou antes de desenhar: em vez de tela preta, o erro e como sair dele.
  mostrarFalha(erro)
}

// Casca do app em cache e o site instalável como app (só no site publicado:
// no app de desktop e em desenvolvimento, nada de service worker).
if ('serviceWorker' in navigator && import.meta.env.PROD && !import.meta.env.VITE_TV && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
