/**
 * doacaoService.ts
 *
 * Gerencia eventos e o Pix relacionados às doações do Saimo TV.
 */

/** Pix "copia e cola" (BR Code estático) do desenvolvedor: a doação é direta, sem intermediário. */
export const PIX_COPIA_E_COLA =
  '00020126580014br.gov.bcb.pix0136950460d4-51c5-49ba-bf71-b720b60cde435204000053039865802BR5925GABRIEL SAIMO FERREIRA ES60085500019962070503***6304F442';
export const PIX_FAVORECIDO = 'Gabriel Saimo Ferreira';
export const TEXTO_PIX_DIRETO =
  'Agora o Pix é direto: o valor vai direto para o desenvolvedor, Gabriel Saimo Ferreira, sem intermediário. Aponte a câmera do celular para o QR code ou copie o código Pix e cole no app do seu banco.';
export const EVENTO_ABRIR_DOACAO = 'saimo-abrir-modal-doacao';

/**
 * Abre o modal de doações a partir de qualquer ponto do aplicativo
 * (como o botão 'Apoiar o projeto' na tela de Ajustes).
 */
export function abrirModalDoacao(): void {
  window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_DOACAO));
}
