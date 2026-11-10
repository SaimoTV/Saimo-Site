/**
 * Dados que as páginas institucionais mostram. Edite aqui, num lugar só.
 *
 * O e-mail de contato e o responsável legal precisam ser os reais antes de
 * enviar o app às lojas: a Apple e o Google exigem um contato de suporte e uma
 * política de privacidade com contato.
 */
export const SITE = {
  nome: 'Saimo',
  nomeCompleto: 'Saimo TV',
  /** Pessoa ou empresa responsável pelo aplicativo (aparece nos Termos e na Privacidade). */
  responsavel: 'Saimo',
  /** E-mail de suporte e privacidade. Vazio = a página manda usar o canal de suporte do app. */
  email: 'saimo.tv.gs@gmail.com',
  endereco: 'https://saimo-tv.pages.dev',
  /** Última revisão dos textos legais. */
  atualizadoEm: '10 de novembro de 2026',
  versaoDoTexto: '1.0',
} as const;

export const PAGINAS_LEGAIS = [
  { rota: '/privacidade', rotulo: 'Política de Privacidade' },
  { rota: '/termos', rotulo: 'Termos de Uso' },
  { rota: '/conteudo', rotulo: 'Conteúdo e Direitos Autorais' },
  { rota: '/exclusao-de-dados', rotulo: 'Exclusão de dados' },
  { rota: '/suporte', rotulo: 'Suporte e perguntas frequentes' },
] as const;
