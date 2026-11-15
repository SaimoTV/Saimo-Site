/**
 * Horário de Brasília (UTC-3, sem horário de verão desde 2019) sem depender do
 * fuso do aparelho. TV e TV Box costumam vir em UTC: com a hora local, a agenda
 * de jogos mostrava tudo 3 h adiantado. Conta feita à mão (sem Intl.timeZone),
 * que também funciona nos navegadores antigos das TVs.
 */
const DESLOCAMENTO = -3 * 3600_000;
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const emBrasilia = (ms: number) => new Date(ms + DESLOCAMENTO);
const dois = (n: number) => (n < 10 ? '0' : '') + n;

/** "21:30" */
export function horaBr(ms: number): string {
  const d = emBrasilia(ms);
  return `${dois(d.getUTCHours())}:${dois(d.getUTCMinutes())}`;
}

/** Número do dia em Brasília: a diferença entre dois dá "hoje", "amanhã"... */
export function diaBr(ms: number): number {
  return Math.floor((ms + DESLOCAMENTO) / 86_400_000);
}

/** "sáb" */
export function semanaBr(ms: number): string {
  return SEMANA[emBrasilia(ms).getUTCDay()];
}
