/**
 * doacaoService.ts
 *
 * Gerencia eventos e links relacionados às doações do Saimo TV.
 */

export const LINK_DOACAO = 'https://deflow.exchange/pt/qr/saimo-tv';
export const EVENTO_ABRIR_DOACAO = 'saimo-abrir-modal-doacao';

/**
 * Abre o modal de doações a partir de qualquer ponto do aplicativo
 * (como o botão 'Apoiar o projeto' na tela de Ajustes).
 */
export function abrirModalDoacao(): void {
  window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_DOACAO));
}
