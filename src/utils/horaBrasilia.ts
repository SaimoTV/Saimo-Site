/**
 * Hora dos eventos no fuso de quem assiste (Acre, Amazonas, Noronha… cada um vê
 * a sua). Exceção: aparelho em UTC (muita TV e TV Box vem assim, sem ninguém
 * ter escolhido) usa Brasília (UTC-3, sem horário de verão desde 2019); antes,
 * com a hora local crua, a agenda dessas TVs ficava 3 h adiantada. Conta feita
 * à mão (sem Intl.timeZone), que funciona nos navegadores antigos das TVs.
 */
function deslocamento(ms: number): number {
  const minutos = -new Date(ms).getTimezoneOffset();
  return (minutos === 0 ? -180 : minutos) * 60_000;
}
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const emBrasilia = (ms: number) => new Date(ms + deslocamento(ms));
const dois = (n: number) => (n < 10 ? '0' : '') + n;

/** "21:30" */
export function horaBr(ms: number): string {
  const d = emBrasilia(ms);
  return `${dois(d.getUTCHours())}:${dois(d.getUTCMinutes())}`;
}

/** Número do dia (no fuso de quem assiste): a diferença entre dois dá "hoje", "amanhã"... */
export function diaBr(ms: number): number {
  return Math.floor((ms + deslocamento(ms)) / 86_400_000);
}

/** "sáb" */
export function semanaBr(ms: number): string {
  return SEMANA[emBrasilia(ms).getUTCDay()];
}
