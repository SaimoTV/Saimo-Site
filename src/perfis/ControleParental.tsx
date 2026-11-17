/**
 * Controle parental, no fim dos Ajustes, discreto: libera ou bloqueia o
 * conteúdo adulto com a senha (padrão 0000) e troca a senha. No perfil Kids
 * não aparece: lá o conteúdo adulto nunca destranca.
 */
import { useState } from 'react';
import { useAdultMode } from '../contexts/adultoContexto';
import { conferirSenha, senhaEhPadrao, trocarSenha } from './parental';
import { ehKids } from './kids';

export function ControleParental() {
  const { isAdultUnlocked, unlockAdult, lockAdult } = useAdultMode();
  const [aberto, setAberto] = useState<'liberar' | 'trocar' | null>(null);
  const [senha, setSenha] = useState('');
  const [nova, setNova] = useState('');
  const [aviso, setAviso] = useState('');
  if (ehKids()) return null;

  const so4 = (v: string) => v.replace(/\D/g, '').slice(0, 4);
  const limpar = () => { setSenha(''); setNova(''); setAviso(''); };

  const liberar = () => {
    if (conferirSenha(senha)) { unlockAdult(); setAberto(null); limpar(); }
    else { setAviso('Senha errada.'); setSenha(''); }
  };
  const trocar = () => {
    if (!/^\d{4}$/.test(nova)) { setAviso('A senha nova tem 4 números.'); return; }
    if (trocarSenha(senha, nova)) { setAberto(null); limpar(); setAviso('Senha trocada.'); }
    else { setAviso('Senha atual errada.'); setSenha(''); }
  };

  return (
    <section className="ajustes-bloco ajustes-parental" id="controle-parental">
      <h2>Controle parental</h2>
      <p>
        Conteúdo adulto: <strong>{isAdultUnlocked ? 'liberado' : 'bloqueado'}</strong>.
        {senhaEhPadrao() ? ' Ainda com a senha de fábrica: troque-a aqui.' : ''}
      </p>
      {aberto === null ? (
        <div className="ajustes-botoes">
          {isAdultUnlocked
            ? <button className="ajustes-botao" onClick={() => { lockAdult(); setAviso(''); }}>Bloquear de novo</button>
            : <button className="ajustes-botao" onClick={() => { limpar(); setAberto('liberar'); }}>Liberar com a senha</button>}
          <button className="ajustes-botao" onClick={() => { limpar(); setAberto('trocar'); }}>Trocar a senha</button>
        </div>
      ) : (
        <div className="ajustes-parental-form">
          <input type="password" inputMode="numeric" maxLength={4} placeholder={aberto === 'trocar' ? 'Senha atual' : 'Senha'}
            value={senha} autoFocus onChange={(e) => { setSenha(so4(e.target.value)); setAviso(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') (aberto === 'liberar' ? liberar() : trocar()); }} />
          {aberto === 'trocar' && (
            <input type="password" inputMode="numeric" maxLength={4} placeholder="Senha nova"
              value={nova} onChange={(e) => { setNova(so4(e.target.value)); setAviso(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') trocar(); }} />
          )}
          <button className="ajustes-botao" onClick={aberto === 'liberar' ? liberar : trocar}>{aberto === 'liberar' ? 'Liberar' : 'Trocar'}</button>
          <button className="ajustes-botao" onClick={() => { setAberto(null); limpar(); }}>Cancelar</button>
        </div>
      )}
      {aviso && <p className="ajustes-parental-aviso">{aviso}</p>}
    </section>
  );
}
