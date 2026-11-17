/** Pede o código de 4 dígitos do perfil Kids (sair dele, editar, abrir os Ajustes). */
import { useEffect, useRef, useState } from 'react';
import { conferirCodigo, type Perfil } from './perfis';

export function PedirCodigo({ perfil, motivo, aoConfirmar, aoCancelar }: {
  perfil: Perfil;
  motivo: string;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}) {
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => { campo.current?.focus(); }, []);

  const enviar = (valor = codigo) => {
    if (valor.length !== 4) return;
    if (conferirCodigo(perfil, valor)) { aoConfirmar(); return; }
    setErro(true);
    setCodigo('');
    campo.current?.focus();
  };

  return (
    <div className="perfis-caixa perfis-codigo">
      <h1 id="perfis-titulo">Código do perfil {perfil.nome}</h1>
      <p className="perfis-sub">{motivo}</p>
      <input
        ref={campo}
        className="perfis-codigo-campo"
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={4}
        placeholder="••••"
        value={codigo}
        data-focusable="true"
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 4);
          setCodigo(v);
          setErro(false);
          if (v.length === 4) enviar(v);
        }}
        onKeyDown={(e) => { if (e.key === 'Enter') enviar(); }}
      />
      <p className="perfis-aviso" role="alert">{erro ? 'Código errado. Tente de novo.' : ''}</p>
      <div className="perfis-acoes">
        <button type="button" className="perfis-botao principal" data-focusable="true" disabled={codigo.length !== 4} onClick={() => enviar()}>Confirmar</button>
        <button type="button" className="perfis-botao" data-focusable="true" onClick={aoCancelar}>Cancelar</button>
      </div>
    </div>
  );
}
