/**
 * Primeira tela para quem ainda não entrou numa conta: à esquerda entrar ou
 * criar a conta, à direita seguir sem login. A conta é opcional.
 *
 * Quem escolhe "sem login" não vê esta tela de novo (a escolha fica guardada);
 * a Conta Saimo continua sendo a primeira opção em Ajustes.
 */
import { useState } from 'react';
import { useConta } from './ContaSaimo';
import { EntrarComQrOuEmail } from './EntrarComQr';
import './boasvindas.css';

const CHAVE = 'saimo-boas-vindas-feito';

const jaEscolheuSemLogin = (): boolean => {
  try { return localStorage.getItem(CHAVE) === '1'; } catch { return false; }
};

export function BoasVindas() {
  const conta = useConta();
  const [fechada, setFechada] = useState(jaEscolheuSemLogin);
  if (conta.token || fechada) return null;

  const semLogin = () => {
    try { localStorage.setItem(CHAVE, '1'); } catch { /* vale só nesta visita */ }
    setFechada(true);
  };

  return (
    <div className="boasvindas-fundo" data-testid="boas-vindas" role="dialog" aria-label="Bem-vindo ao Saimo TV">
      <div className="boasvindas-caixa">
        <section className="boasvindas-lado boasvindas-conta">
          <h1>Entrar ou criar conta</h1>
          <p className="boasvindas-porque">Por que criar uma conta?</p>
          <ul>
            <li>Seus perfis, favoritos, listas e addons ficam guardados e voltam em qualquer aparelho.</li>
            <li>Você continua de onde parou no celular, na TV e no computador.</li>
            <li>Se trocar de aparelho ou reinstalar o app, não perde nada.</li>
          </ul>
          <EntrarComQrOuEmail />
        </section>
        <section className="boasvindas-lado boasvindas-sem">
          <h1>Entrar sem login</h1>
          <p>
            <strong>A conta não é obrigatória.</strong> Dá para usar o Saimo TV inteiro sem entrar:
            tudo fica guardado só neste aparelho.
          </p>
          <p>Você pode criar a conta quando quiser, em Ajustes &gt; Conta Saimo.</p>
          <button className="ajustes-botao destaque boasvindas-botao" onClick={semLogin} data-testid="boas-vindas-sem-login" autoFocus>
            Entrar sem login
          </button>
        </section>
      </div>
    </div>
  );
}
