/**
 * ChuvaApoiadores.tsx
 *
 * Componente que renderiza um fundo animado com nomes de apoiadores subindo a tela.
 * Totalmente acelerado por GPU (CSS translate3d e opacity no Compositor Thread).
 * Fundo dinâmico, orgânico e com início pseudo-aleatório a cada refresh.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  type Apoiador,
  calcularEstiloApoiador,
  carregarApoiadores,
  sortearApoiador,
  maiorValor,
  APOIADORES_SEMENTE,
} from '../services/apoiadores';
import './ChuvaApoiadores.css';

interface SlotProps {
  slotId: number;
  totalSlots: number;
  lista: Apoiador[];
  initialDelay: number;
  driftDirection: 'Left' | 'Right';
  baseLeft: number;
}

function SlotApoiador({
  slotId,
  lista,
  initialDelay,
  driftDirection,
  baseLeft,
}: SlotProps) {
  const [ciclo, setCiclo] = useState(0);
  const [apoiador, setApoiador] = useState<Apoiador>(() => sortearApoiador(lista));

  const [jitterX, setJitterX] = useState(() => (Math.random() * 4 - 2)); // -2% a +2%
  const [velocidadeOffset, setVelocidadeOffset] = useState(() => (Math.random() * 2 - 1));

  const maior = useMemo(() => maiorValor(lista), [lista]);
  const estilo = useMemo(() => calcularEstiloApoiador(apoiador, maior), [apoiador, maior]);

  const posicaoLeft = useMemo(() => {
    return Math.max(2, Math.min(94, baseLeft + jitterX));
  }, [baseLeft, jitterX]);

  const aoTerminarAnimacao = () => {
    setApoiador(sortearApoiador(lista));
    setJitterX(Math.random() * 4 - 2);
    setVelocidadeOffset(Math.random() * 2 - 1);
    setCiclo((c) => c + 1);
  };

  const delayCss = ciclo === 0 ? `${initialDelay}s` : `${Math.random() * 1.5}s`;
  const duracaoFinal = Math.max(12, estilo.durationSeconds + velocidadeOffset);

  const animacaoNome = driftDirection === 'Left' ? 'subirApoiadorDriftLeft' : 'subirApoiadorDriftRight';

  return (
    <span
      key={`slot-${slotId}-c${ciclo}`}
      className="chuva-item"
      onAnimationEnd={aoTerminarAnimacao}
      style={{
        left: `${posicaoLeft}%`,
        fontSize: estilo.fontSize,
        fontWeight: estilo.fontWeight,
        color: estilo.color,
        textShadow: estilo.textShadow,
        animationName: animacaoNome,
        animationDuration: `${duracaoFinal.toFixed(1)}s`,
        animationDelay: delayCss,
        ['--target-opacity' as any]: estilo.opacity,
        ['--fs' as any]: estilo.fontSize,
      }}
    >
      {apoiador.nome}
      {estilo.intensity >= 0.75 && (
        <span
          className="chuva-estrela"
          title={`Apoiador Premium: R$ ${apoiador.valor}`}
        >
          ★
        </span>
      )}
    </span>
  );
}

export function ChuvaApoiadores() {
  const [lista, setLista] = useState<Apoiador[]>(APOIADORES_SEMENTE);
  const [pausada, setPausada] = useState(false);

  useEffect(() => {
    let ativo = true;
    carregarApoiadores().then((res) => {
      if (ativo && res && res.length > 0) {
        setLista(res);
      }
    });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    const tratarVisibilidade = () => {
      setPausada(document.hidden);
    };
    document.addEventListener('visibilitychange', tratarVisibilidade);
    return () => {
      document.removeEventListener('visibilitychange', tratarVisibilidade);
    };
  }, []);

  // 24 faixas no desktop, 12 no mobile
  const totalSlots = typeof window !== 'undefined' && window.innerWidth < 680 ? 12 : 24;

  const slotsConfig = useMemo(() => {
    const margemEsquerda = 3;
    const larguraUtil = 92;
    const passoFaixa = larguraUtil / Math.max(1, totalSlots - 1);

    const delays: number[] = [];
    const stepDelay = 22 / totalSlots;
    for (let i = 0; i < totalSlots; i++) {
      const baseD = -(i * stepDelay + 0.5);
      const randomJitter = (Math.random() - 0.5) * stepDelay * 1.5;
      delays.push(parseFloat((baseD + randomJitter).toFixed(1)));
    }

    for (let i = delays.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [delays[i], delays[j]] = [delays[j], delays[i]];
    }

    return Array.from({ length: totalSlots }, (_, i) => {
      const baseLeft = margemEsquerda + i * passoFaixa + (Math.random() * 2 - 1);
      const driftDirection = i % 2 === 0 ? 'Left' : 'Right';
      return {
        slotId: i,
        baseLeft,
        initialDelay: delays[i],
        driftDirection: driftDirection as 'Left' | 'Right',
      };
    });
  }, [totalSlots]);

  return (
    <div
      className={`chuva-apoiadores-container ${pausada ? 'pausada' : ''}`}
      aria-hidden="true"
    >
      {slotsConfig.map((slot) => (
        <SlotApoiador
          key={slot.slotId}
          slotId={slot.slotId}
          totalSlots={totalSlots}
          lista={lista}
          initialDelay={slot.initialDelay}
          driftDirection={slot.driftDirection}
          baseLeft={slot.baseLeft}
        />
      ))}
    </div>
  );
}
