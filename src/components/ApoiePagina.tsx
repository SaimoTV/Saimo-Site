/**
 * ApoiePagina.tsx
 *
 * A página /apoie: o mesmo conteúdo do modal de doação (Pix direto), numa página
 * própria para mandar o endereço a alguém. Não aparece em menu nenhum.
 */

import { useEffect } from 'react';
import { DoacaoConteudo } from './DoacaoConteudo';
import './ApoiePagina.css';

export function ApoiePagina() {
  useEffect(() => {
    document.title = 'Apoie o Saimo TV';
  }, []);

  return (
    <main className="apoie-pagina">
      <div className="saimo-doacao-card apoie-pagina-card">
        <DoacaoConteudo tituloId="apoie-titulo" />
      </div>
    </main>
  );
}
