import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PAGINAS_LEGAIS, SITE } from './config';
import { Cabecalho, Rodape } from './Moldura';
import './landing.css';
import './legal.css';

/* ───────────────────────────── moldura comum ───────────────────────────── */

interface SecaoDef { id: string; titulo: string; corpo: ReactNode }

function Contato() {
  return SITE.email
    ? <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
    : <>a página de <Link to="/suporte">Suporte</Link> (o contato oficial é publicado lá)</>;
}

function PaginaLegal({ titulo, resumo, secoes, destaque }: { titulo: string; resumo: string; secoes: SecaoDef[]; destaque?: ReactNode }) {
  useEffect(() => {
    document.title = `${titulo} — ${SITE.nomeCompleto}`;
    window.scrollTo(0, 0);
  }, [titulo]);
  return (
    <div className="legal">
      <Cabecalho />
      <main className="legal-miolo">
        <header className="legal-topo">
          <span className="eyebrow"><i /> {SITE.nomeCompleto}</span>
          <h1>{titulo}</h1>
          <p className="legal-resumo">{resumo}</p>
          <p className="legal-data">Última atualização: {SITE.atualizadoEm} · Versão {SITE.versaoDoTexto}</p>
        </header>
        {destaque}
        <div className="legal-corpo">
          <nav className="legal-indice" aria-label="Neste documento">
            <strong>Neste documento</strong>
            {secoes.map((s, i) => <a key={s.id} href={`#${s.id}`}>{i + 1}. {s.titulo}</a>)}
            <div className="legal-outros">
              <strong>Outras páginas</strong>
              {PAGINAS_LEGAIS.map((p) => <Link key={p.rota} to={p.rota}>{p.rotulo}</Link>)}
            </div>
          </nav>
          <article className="legal-texto">
            {secoes.map((s, i) => (
              <section key={s.id} id={s.id}>
                <h2><span>{i + 1}</span>{s.titulo}</h2>
                {s.corpo}
              </section>
            ))}
          </article>
        </div>
      </main>
      <Rodape />
    </div>
  );
}

function Destaque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <aside className="legal-destaque"><strong>{titulo}</strong>{children}</aside>;
}

/* ───────────────────────────── política de privacidade ───────────────────────────── */

export function Privacidade() {
  const secoes: SecaoDef[] = [
    {
      id: 'quem', titulo: 'Quem somos e a quem este texto se aplica',
      corpo: (
        <>
          <p>Esta Política de Privacidade explica como o <strong>{SITE.nomeCompleto}</strong> (o “Saimo”, o “aplicativo” ou “nós”) trata informações quando você usa os nossos aplicativos
            (Android, Android TV e TV Box, Samsung Tizen, LG webOS, Roku, Mac, Windows e, em breve, iPhone e iPad) e o site <strong>{SITE.endereco.replace('https://', '')}</strong>.</p>
          <p>O responsável pelo aplicativo é <strong>{SITE.responsavel}</strong>. Para qualquer assunto sobre privacidade, fale conosco por <Contato />.</p>
          <p>O Saimo é um <strong>reprodutor de mídia</strong>: ele não fornece conteúdo e foi desenhado para coletar o mínimo possível sobre você. Esta política vale para as versões 3.0 e posteriores.</p>
        </>
      ),
    },
    {
      id: 'nao-coletamos', titulo: 'O que nós NÃO coletamos',
      corpo: (
        <>
          <p>Não existe conta, cadastro ou login no Saimo. Por isso, <strong>nós não coletamos nem recebemos</strong>:</p>
          <ul>
            <li>nome, e-mail, telefone, endereço, documentos ou qualquer dado de cadastro;</li>
            <li>localização, contatos, fotos, arquivos pessoais, microfone ou câmera;</li>
            <li>identificadores de publicidade e dados para anúncios (o Saimo não exibe anúncios);</li>
            <li>dados de uso, de análise (analytics), de comportamento ou de navegação dentro do aplicativo;</li>
            <li>o conteúdo que você assiste, os canais que você abre ou as listas que você adiciona;</li>
            <li>relatórios de falha enviados automaticamente.</li>
          </ul>
          <p>O aplicativo não inclui SDKs de publicidade, de análise ou de rastreamento de terceiros.</p>
        </>
      ),
    },
    {
      id: 'no-aparelho', titulo: 'O que fica guardado no seu aparelho',
      corpo: (
        <>
          <p>Para funcionar, o aplicativo guarda informações <strong>somente no armazenamento local do seu aparelho</strong> (e, no site, no armazenamento do seu navegador). Elas não são enviadas a nós:</p>
          <ul>
            <li><strong>Listas que você adicionou</strong>: os links (M3U), os endereços de servidor e, quando a sua lista exige, o usuário e a senha dela. Essas credenciais ficam guardadas localmente e são usadas apenas para falar com o servidor que <em>você</em> indicou;</li>
            <li>favoritos, histórico recente e o ponto em que você parou de assistir (“continuar assistindo”);</li>
            <li>preferências (idioma de áudio e legenda, tamanho da legenda, tela inicial, etc.);</li>
            <li>o código do controle parental, se você o criar;</li>
            <li>cópias temporárias (cache) de listas, imagens e programação, para abrir mais rápido.</li>
          </ul>
          <p>Você controla esses dados: eles saem do aparelho quando você remove a lista, limpa os dados do aplicativo ou o desinstala. Veja <Link to="/exclusao-de-dados">Exclusão de dados</Link>.</p>
        </>
      ),
    },
    {
      id: 'internet', titulo: 'Como o aplicativo usa a internet (e quem pode ver o seu IP)',
      corpo: (
        <>
          <p>Ao se conectar a qualquer servidor, o seu endereço IP e as informações técnicas normais de uma conexão (como o tipo de aparelho) ficam visíveis para <strong>esse servidor</strong>. O Saimo se conecta a:</p>
          <ul>
            <li><strong>O servidor da sua lista.</strong> É o provedor que <em>você</em> escolheu. É ele que entrega os canais, filmes e séries. Ele tem a sua própria política de privacidade, sobre a qual não temos controle;</li>
            <li><strong>The Movie Database (TMDB)</strong>, para obter capas, sinopses, elenco e notas de filmes e séries. Esse serviço é de terceiros e recebe o seu IP quando as imagens são carregadas;</li>
            <li><strong>Serviços públicos de placar e agenda esportiva</strong>, para a tela de Jogos;</li>
            <li><strong>GitHub</strong>, para avisar sobre versões novas e baixar a atualização, nos aplicativos instalados fora das lojas;</li>
            <li><strong>Cloudflare</strong>, que hospeda este site e funções de apoio do site, e cujo serviço de DNS seguro (1.1.1.1) pode ser usado pelo aplicativo Android para resolver nomes de servidores. O DNS vê os nomes de domínio consultados, não o conteúdo;</li>
            <li><strong>Página de doação (Deflow)</strong>, se você decidir apoiar o projeto. A doação acontece fora do aplicativo, numa página de terceiros, com política própria. O Saimo não recebe os seus dados de pagamento.</li>
          </ul>
          <p>No <strong>site</strong>, alguns pedidos de vídeo ou de lista podem passar por uma função de repasse (proxy) do próprio site, apenas para contornar restrições do navegador. Ela repassa o conteúdo e <strong>não armazena</strong> o que você assiste nem o endereço da sua lista.</p>
        </>
      ),
    },
    {
      id: 'connect', titulo: 'Saimo Connect (entre os seus aparelhos)',
      corpo: (
        <>
          <p>O Saimo Connect liga os seus aparelhos <strong>dentro da mesma rede local (Wi-Fi)</strong>. Com ele, o celular vira controle remoto da TV, digita textos por você e sincroniza favoritos, progresso e listas entre os seus aparelhos.</p>
          <ul>
            <li>A comunicação acontece diretamente entre os aparelhos, na sua rede. <strong>Não existe servidor Saimo no meio</strong> e nada é enviado para a internet por causa dele;</li>
            <li>Por isso o aplicativo pode pedir permissão de “rede local” (iOS e Android) para encontrar os seus outros aparelhos;</li>
            <li>Use o Saimo Connect apenas em redes em que você confia. Qualquer aparelho com o Saimo na mesma rede pode tentar se conectar, e você aprova o pareamento.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'telemetria', titulo: 'Diagnósticos, análise e anúncios',
      corpo: (
        <>
          <p>O Saimo <strong>não envia dados de uso, de análise nem relatórios de falha</strong>. Também não exibe anúncios nem usa publicidade segmentada.</p>
          <p>Versões antigas de alguns aplicativos podiam enviar, para uma pequena amostra de aparelhos, dados técnicos anônimos (um identificador aleatório, a versão do aplicativo, o modelo do aparelho e erros). Esse recurso <strong>foi desativado</strong> e não existe nas versões atuais.</p>
        </>
      ),
    },
    {
      id: 'cookies', titulo: 'Armazenamento do site, cookies e cache',
      corpo: (
        <>
          <p>O site usa o <strong>armazenamento local do navegador</strong> (localStorage, IndexedDB e cache do navegador) para lembrar as suas preferências, favoritos, progresso e listas, e para abrir mais rápido. <strong>Não usamos cookies de rastreamento nem de publicidade.</strong></p>
          <p>Você pode limpar tudo a qualquer momento nas configurações do navegador (“limpar dados do site”).</p>
        </>
      ),
    },
    {
      id: 'compartilhamento', titulo: 'Compartilhamento e venda de dados',
      corpo: (
        <>
          <p>Como não coletamos dados pessoais, <strong>não temos o que vender, alugar ou compartilhar</strong>, e não o fazemos. Os serviços de terceiros citados na seção 4 recebem apenas o que uma conexão de internet comum já expõe (como o IP) quando você os usa, sob as políticas deles.</p>
        </>
      ),
    },
    {
      id: 'seguranca', titulo: 'Segurança',
      corpo: (
        <>
          <p>Mantemos as suas informações no seu aparelho, e isso reduz a superfície de risco. Mesmo assim, recomendamos: manter o aparelho bloqueado com senha ou biometria; não compartilhar o link ou as credenciais da sua lista; usar apenas redes Wi-Fi de confiança com o Saimo Connect; e atualizar o aplicativo.</p>
          <p>Nenhum sistema é 100% seguro, e o Saimo não se responsabiliza por incidentes nos servidores de listas de terceiros.</p>
        </>
      ),
    },
    {
      id: 'criancas', titulo: 'Crianças e controle parental',
      corpo: (
        <>
          <p>O Saimo não é direcionado a crianças menores de 13 anos e não coleta dados de ninguém, inclusive de crianças. O aplicativo oferece um <strong>controle parental local</strong>: seções restritas ficam protegidas por um código que só você define, guardado no aparelho.</p>
          <p>O conteúdo exibido vem da lista do usuário. Responsáveis devem avaliar o que é adequado às crianças da casa.</p>
        </>
      ),
    },
    {
      id: 'direitos', titulo: 'Seus direitos (LGPD)',
      corpo: (
        <>
          <p>De acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018), você pode pedir: confirmação do tratamento; acesso; correção; anonimização, bloqueio ou eliminação; portabilidade; informação sobre compartilhamento; e revogação de consentimento.</p>
          <p>Como os seus dados ficam no seu aparelho, <strong>você já exerce esses direitos diretamente</strong> pelo aplicativo (editando, removendo listas e favoritos) ou limpando os dados. Se tiver qualquer dúvida ou pedido, escreva para <Contato />, e responderemos em prazo razoável.</p>
          <p>Você também pode registrar reclamações junto à Autoridade Nacional de Proteção de Dados (ANPD).</p>
        </>
      ),
    },
    {
      id: 'internacional', titulo: 'Transferência internacional',
      corpo: <p>Alguns serviços de terceiros usados pelo aplicativo (como Cloudflare, GitHub e TMDB) operam em outros países. Ao se conectar a eles, o seu IP pode ser tratado fora do Brasil, conforme as políticas desses serviços.</p>,
    },
    {
      id: 'lojas', titulo: 'Resumo para as lojas de aplicativos',
      corpo: (
        <>
          <p>Para atender às declarações da App Store e do Google Play:</p>
          <table className="legal-tabela">
            <thead><tr><th>Item</th><th>Declaração</th></tr></thead>
            <tbody>
              <tr><td>Coleta de dados do usuário</td><td>Nenhum dado é coletado pelo desenvolvedor.</td></tr>
              <tr><td>Rastreamento (tracking)</td><td>Nenhum. Sem publicidade, sem identificadores de anúncio.</td></tr>
              <tr><td>Dados vinculados à identidade</td><td>Nenhum.</td></tr>
              <tr><td>Compartilhamento com terceiros</td><td>Nenhum dado pessoal é compartilhado.</td></tr>
              <tr><td>Conta ou login</td><td>Não existe.</td></tr>
              <tr><td>Compras no aplicativo</td><td>Nenhuma. O apoio ao projeto é voluntário e acontece fora do aplicativo.</td></tr>
              <tr><td>Criptografia em trânsito</td><td>HTTPS quando o servidor da lista do usuário oferece. Listas em HTTP simples dependem do provedor.</td></tr>
              <tr><td>Exclusão de dados</td><td>Pelo próprio aplicativo ou desinstalando. Veja Exclusão de dados.</td></tr>
            </tbody>
          </table>
          <h3>Permissões usadas</h3>
          <ul>
            <li><strong>Internet / estado da rede</strong>: reproduzir vídeo e baixar listas e metadados;</li>
            <li><strong>Rede local</strong>: Saimo Connect (encontrar os seus aparelhos na mesma rede);</li>
            <li><strong>Notificações e serviço em primeiro plano</strong> (Android): controles de rádio e vídeo em segundo plano e progresso de downloads para assistir offline;</li>
            <li><strong>Arquivos e mídia</strong> (Android, Windows, Mac): somente para você escolher um arquivo de lista (.m3u) ou salvar um download. O aplicativo não lê as suas fotos nem arquivos pessoais por conta própria;</li>
            <li><strong>Impedir que a tela apague</strong>: manter a tela ligada durante a reprodução.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'mudancas', titulo: 'Mudanças nesta política e contato',
      corpo: (
        <>
          <p>Podemos atualizar esta política para refletir mudanças no aplicativo ou na lei. A data no topo mostra a última revisão, e mudanças relevantes serão avisadas no aplicativo ou nesta página.</p>
          <p>Dúvidas ou pedidos: <Contato />.</p>
        </>
      ),
    },
  ];
  return (
    <PaginaLegal
      titulo="Política de Privacidade"
      resumo="Em poucas palavras: sem conta, sem anúncios, sem rastreamento. O que você adiciona e assiste fica no seu aparelho."
      secoes={secoes}
      destaque={
        <Destaque titulo="Resumo rápido">
          <ul>
            <li>O Saimo <b>não pede cadastro</b> e <b>não coleta dados pessoais</b>.</li>
            <li>Favoritos, progresso e listas ficam <b>só no seu aparelho</b>.</li>
            <li>Sem anúncios, sem rastreadores e sem envio de dados de uso.</li>
            <li>O app se conecta ao servidor da <b>sua</b> lista. Esse provedor tem a política dele.</li>
          </ul>
        </Destaque>
      }
    />
  );
}

/* ───────────────────────────── termos de uso ───────────────────────────── */

export function Termos() {
  const secoes: SecaoDef[] = [
    { id: 'aceite', titulo: 'Aceitação',
      corpo: <p>Ao instalar ou usar o {SITE.nomeCompleto}, você concorda com estes Termos de Uso e com a <Link to="/privacidade">Política de Privacidade</Link>. Se não concordar, não use o aplicativo.</p> },
    { id: 'o-que-e', titulo: 'O que é o Saimo',
      corpo: (
        <>
          <p>O Saimo é um <strong>aplicativo reprodutor de mídia</strong> e um ecossistema de ferramentas (aplicativos, site e Saimo Connect) que organiza e reproduz conteúdo a partir de fontes que <strong>o próprio usuário informa</strong>, como listas M3U e contas com servidor, usuário e senha fornecidas por terceiros.</p>
          <p><strong>O Saimo não fornece, não hospeda, não vende, não distribui e não é afiliado a nenhum canal, filme, série, rádio ou provedor de conteúdo.</strong> O aplicativo é instalado sem conteúdo.</p>
        </>
      ) },
    { id: 'licenca', titulo: 'Licença de uso',
      corpo: <p>Concedemos a você uma licença pessoal, gratuita, não exclusiva, intransferível e revogável para instalar e usar o Saimo nos seus aparelhos, para uso pessoal e não comercial. Você não pode copiar, modificar, descompilar (exceto quando a lei permitir), revender ou redistribuir o aplicativo, nem remover avisos de propriedade.</p> },
    { id: 'conteudo-do-usuario', titulo: 'O conteúdo é de responsabilidade do usuário',
      corpo: (
        <>
          <p>Você é <strong>integralmente responsável</strong> pelas listas, servidores, credenciais e conteúdos que adiciona e reproduz, e por ter o direito de acessá-los. Ao usar o Saimo, você declara que:</p>
          <ul>
            <li>só adiciona fontes às quais tem direito de acesso (por exemplo, assinaturas suas, conteúdo próprio, conteúdo de domínio público, licenciado ou liberado pelo titular dos direitos);</li>
            <li>não usará o Saimo para acessar, reproduzir ou distribuir conteúdo obtido de forma ilegal ou em violação de direitos autorais ou de termos de serviço de terceiros;</li>
            <li>respeitará as leis do seu país e os direitos de terceiros.</li>
          </ul>
        </>
      ) },
    { id: 'proibicoes', titulo: 'Usos proibidos',
      corpo: (
        <>
          <p>É proibido usar o Saimo para: violar direitos autorais ou de propriedade intelectual; distribuir, revender ou compartilhar listas ou acessos de forma ilícita; contornar proteções técnicas ou restrições de acesso de forma ilegal; praticar fraude, assédio ou qualquer atividade ilegal; prejudicar a segurança ou o funcionamento do aplicativo ou de redes de terceiros; ou expor crianças a conteúdo inadequado.</p>
          <p>Podemos limitar ou encerrar o suporte a quem violar estes Termos.</p>
        </>
      ) },
    { id: 'terceiros', titulo: 'Serviços e conteúdos de terceiros',
      corpo: <p>O Saimo pode exibir informações de serviços de terceiros (como capas e sinopses do TMDB e placares esportivos), que pertencem aos seus donos e seguem os termos deles. Nomes de marcas e logotipos citados pertencem aos seus respectivos proprietários e são usados apenas para identificação. O Saimo não tem relação com eles. O Saimo usa o TMDB, mas não é endossado nem certificado por ele.</p> },
    { id: 'disponibilidade', titulo: 'Disponibilidade, atualizações e garantias',
      corpo: (
        <>
          <p>O aplicativo é fornecido <strong>“como está”</strong>. Não garantimos que ele funcionará sem interrupções ou erros, nem que a sua lista ou o seu provedor estarão disponíveis. A qualidade, a disponibilidade e a legalidade do conteúdo dependem exclusivamente da fonte que você adicionou.</p>
          <p>Podemos lançar atualizações, mudar ou descontinuar recursos, a qualquer momento.</p>
        </>
      ) },
    { id: 'limitacao', titulo: 'Limitação de responsabilidade',
      corpo: <p>Na máxima extensão permitida pela lei, o Saimo e o seu responsável não respondem por danos indiretos, perda de dados, interrupções, ou por qualquer consequência do conteúdo que você acessa por meio de fontes de terceiros. Nada nestes Termos limita direitos que a lei do consumidor garante e que não podem ser afastados.</p> },
    { id: 'propriedade', titulo: 'Propriedade intelectual',
      corpo: <p>O nome “Saimo”, o logotipo, o design e o código do aplicativo pertencem ao seu responsável e são protegidos por lei. Estes Termos não transferem nenhum desses direitos a você, além da licença de uso acima.</p> },
    { id: 'violacao', titulo: 'Denúncia de violação de direitos autorais',
      corpo: (
        <>
          <p>Respeitamos a propriedade intelectual. Se você é titular de direitos e acredita que o Saimo está sendo usado para violar os seus direitos, envie um aviso por <Contato /> com: (i) a sua identificação e contato; (ii) a descrição da obra protegida; (iii) onde a suposta violação aparece; e (iv) uma declaração de boa-fé de que o uso não é autorizado.</p>
          <p>Importante: o Saimo não hospeda conteúdo, então não temos como remover um conteúdo de um servidor de terceiros, mas analisaremos cada pedido legítimo e tomaremos as medidas que estiverem ao nosso alcance. Veja também <Link to="/conteudo">Conteúdo e Direitos Autorais</Link>.</p>
        </>
      ) },
    { id: 'lei', titulo: 'Lei aplicável e foro',
      corpo: <p>Estes Termos são regidos pelas leis do Brasil. Para consumidores, fica eleito o foro do domicílio do usuário. Para os demais casos, o foro da comarca do responsável pelo aplicativo, salvo disposição legal em contrário.</p> },
    { id: 'mudancas', titulo: 'Mudanças e contato',
      corpo: <p>Podemos atualizar estes Termos. A data no topo indica a última revisão, e o uso continuado após a mudança indica concordância. Dúvidas: <Contato />.</p> },
  ];
  return (
    <PaginaLegal
      titulo="Termos de Uso"
      resumo="As regras para usar o Saimo: um reprodutor de mídia onde você coloca a sua própria lista e responde pelo que assiste."
      secoes={secoes}
      destaque={<Destaque titulo="Em resumo"><ul>
        <li>O Saimo é um <b>player</b>. Ele <b>não traz conteúdo</b>, e você usa a <b>sua</b> lista.</li>
        <li>Use só conteúdo que você tem <b>direito de assistir</b>.</li>
        <li>É proibido usar o Saimo para pirataria.</li>
      </ul></Destaque>}
    />
  );
}

/* ───────────────────────────── conteúdo e direitos autorais ───────────────────────────── */

export function Conteudo() {
  const secoes: SecaoDef[] = [
    { id: 'posicao', titulo: 'Nossa posição',
      corpo: (
        <>
          <p>O Saimo é um <strong>reprodutor</strong>, comparável a um reprodutor de mídia ou a um navegador: ele abre o que o usuário aponta. <strong>O Saimo não contém, não hospeda, não indexa, não vende e não distribui canais, filmes, séries, músicas ou qualquer conteúdo protegido.</strong></p>
          <p>Nenhuma lista de canais ou de títulos vem com o aplicativo. A tela inicial é vazia até que o usuário adicione, por conta própria, uma fonte que tem direito de usar.</p>
        </>
      ) },
    { id: 'fontes', titulo: 'De onde vem o conteúdo',
      corpo: (
        <>
          <p>O que aparece no Saimo vem de fontes que o usuário informa, por exemplo:</p>
          <ul>
            <li>uma assinatura de IPTV ou de TV por internet que o usuário contratou legalmente;</li>
            <li>listas de canais abertos e gratuitos, e de conteúdo licenciado ou de domínio público;</li>
            <li>arquivos e servidores do próprio usuário (a sua videoteca, por exemplo);</li>
            <li>rádios e transmissões públicas.</li>
          </ul>
          <p>A forma de usar, e a legalidade do que se acessa, é responsabilidade de quem usa. O Saimo não verifica, valida nem endossa as fontes.</p>
        </>
      ) },
    { id: 'direitos', titulo: 'Respeito aos direitos autorais',
      corpo: <p>Acreditamos que criadores e emissoras devem ser remunerados pelo seu trabalho. Pedimos que você use o Saimo apenas com conteúdo que tem direito de assistir, e os nossos <Link to="/termos">Termos de Uso</Link> proíbem o uso para violar direitos autorais.</p> },
    { id: 'marcas', titulo: 'Marcas e imagens de terceiros',
      corpo: <p>Capas, sinopses e imagens exibidas dentro do aplicativo são obtidas de serviços de terceiros (como o TMDB) ou da própria fonte do usuário e pertencem aos seus respectivos titulares. As demonstrações neste site usam apenas formas e cores genéricas, sem marcas ou obras de terceiros.</p> },
    { id: 'titulares', titulo: 'Você é titular de direitos?',
      corpo: <p>Se acredita que o Saimo está sendo usado de forma que viole os seus direitos, siga o procedimento da seção “Denúncia de violação” dos <Link to="/termos">Termos de Uso</Link> e fale conosco por <Contato />. Leremos cada pedido com atenção.</p> },
  ];
  return (
    <PaginaLegal
      titulo="Conteúdo e Direitos Autorais"
      resumo="O Saimo é um reprodutor: não fornece conteúdo. Aqui explicamos de onde vem o que você assiste e como lidamos com direitos autorais."
      secoes={secoes}
      destaque={<Destaque titulo="O ponto principal"><p>O aplicativo vem <b>vazio</b>. Você adiciona a <b>sua</b> lista e responde por ela. Nós não hospedamos nada.</p></Destaque>}
    />
  );
}

/* ───────────────────────────── exclusão de dados ───────────────────────────── */

export function Exclusao() {
  const secoes: SecaoDef[] = [
    { id: 'resumo', titulo: 'Onde estão os seus dados',
      corpo: <p>Todos os dados do Saimo (listas, favoritos, progresso, preferências e código parental) ficam <strong>no seu aparelho</strong>. Nós não mantemos uma conta nem uma cópia no nosso lado. Por isso, <strong>excluir os dados é uma ação sua, no aparelho</strong>, e é definitiva.</p> },
    { id: 'no-app', titulo: 'Dentro do aplicativo',
      corpo: (
        <ul>
          <li><strong>Listas</strong>: Ajustes › Minhas listas › escolha a lista › Remover. Isso apaga o link, as credenciais e os canais dela;</li>
          <li><strong>Favoritos e progresso</strong>: remova favoritos pela própria tela; o progresso de cada título é apagado ao terminar de assistir ou ao limpar os dados do aplicativo;</li>
          <li><strong>Endereços do Saimo</strong>: Ajustes › Listas › deixe o campo em branco e salve.</li>
        </ul>
      ) },
    { id: 'tudo', titulo: 'Apagar tudo de uma vez',
      corpo: (
        <table className="legal-tabela">
          <thead><tr><th>Plataforma</th><th>Como</th></tr></thead>
          <tbody>
            <tr><td>Android e Android TV</td><td>Configurações › Apps › Saimo › Armazenamento › Limpar dados (ou desinstalar).</td></tr>
            <tr><td>Samsung e LG</td><td>Remova o aplicativo da TV e instale de novo (isso apaga os dados locais).</td></tr>
            <tr><td>Roku</td><td>Remova o canal Saimo da TV.</td></tr>
            <tr><td>Mac</td><td>Arraste o Saimo para o Lixo e apague a pasta <code>~/Library/Application Support/SaimoTV</code>.</td></tr>
            <tr><td>Windows</td><td>Apague a pasta do aplicativo e a pasta <code>%APPDATA%\SaimoTV</code>.</td></tr>
            <tr><td>iPhone e iPad (em breve)</td><td>Remova o app (isso apaga os dados locais).</td></tr>
            <tr><td>Site</td><td>Configurações do navegador › Privacidade › Limpar dados do site.</td></tr>
          </tbody>
        </table>
      ) },
    { id: 'terceiros', titulo: 'Dados em serviços de terceiros',
      corpo: <p>Se você tem conta no seu provedor de lista, ou se fez uma doação por um serviço de pagamento, esses dados ficam com eles. Para apagá-los, fale diretamente com o provedor ou o serviço. Nós não temos acesso a eles.</p> },
    { id: 'pedido', titulo: 'Pedido de exclusão ou dúvidas',
      corpo: <p>Se quiser confirmar que não guardamos nada sobre você, ou tiver qualquer pedido relacionado à LGPD, escreva para <Contato />.</p> },
  ];
  return (
    <PaginaLegal
      titulo="Exclusão de dados"
      resumo="Como apagar os dados do Saimo. Eles ficam no seu aparelho, então a exclusão é feita por você, em poucos passos."
      secoes={secoes}
    />
  );
}

/* ───────────────────────────── suporte ───────────────────────────── */

const FAQ_SUPORTE: [string, ReactNode][] = [
  ['O app abriu vazio. O que eu faço?', <>É assim mesmo: o Saimo não traz conteúdo. Toque em “Adicionar lista” e cole o link da sua lista M3U (só isso já basta). Se o seu provedor entregou servidor, usuário e senha, preencha também.</>],
  ['Qual a diferença entre M3U e “usuário e senha”?', <>M3U é um link (ou arquivo) com a relação dos canais. Alguns provedores entregam, em vez disso, servidor + usuário + senha (formato Xtream). O Saimo aceita os dois. Usuário e senha são opcionais: use só se a sua lista pedir.</>],
  ['Digitar o link na TV é difícil. Tem jeito mais fácil?', <>Tem: o <b>Saimo Connect</b>. Abra o Saimo no celular, na mesma rede Wi-Fi da TV, e use o celular para digitar o link, que aparece na TV.</>],
  ['Um canal não abre ou fica travando.', <>Confira se a sua lista e o seu provedor estão funcionando. O Saimo troca para a fonte reserva do canal sozinho quando a lista traz mais de uma. Se o problema for só num canal, ele provavelmente está fora do ar no provedor.</>],
  ['“Usuário ou senha incorretos”.', <>Confira o servidor, o usuário e a senha exatamente como o provedor enviou (letras maiúsculas e minúsculas importam). Se a conta venceu, o Saimo avisa “Essa conta venceu”.</>],
  ['Onde ficam as minhas listas?', <>Só no seu aparelho. Veja <Link to="/privacidade">Política de Privacidade</Link>.</>],
  ['Como atualizo o aplicativo?', <>O Saimo avisa quando há versão nova. Nos aparelhos instalados fora das lojas, o aviso leva ao download; nas lojas, a atualização vem pela própria loja.</>],
  ['O Saimo vende ou dá acesso a canais?', <>Não. O Saimo é só o reprodutor. Veja <Link to="/conteudo">Conteúdo e Direitos Autorais</Link>.</>],
  ['Tem app para iPhone?', <>Está a caminho da App Store. Enquanto isso, abra o site no Safari e toque em Compartilhar › Adicionar à Tela de Início.</>],
];

export function Suporte() {
  const secoes: SecaoDef[] = [
    { id: 'contato', titulo: 'Fale com a gente',
      corpo: (
        <>
          <p>{SITE.email
            ? <>Escreva para <a href={`mailto:${SITE.email}`}>{SITE.email}</a>. Informe o aparelho (TV, celular, computador), a versão do Saimo e, se puder, o que aconteceu. <strong>Não envie senhas nem o link da sua lista.</strong></>
            : <>O canal oficial de contato será publicado aqui. Enquanto isso, use as respostas abaixo, que resolvem a maior parte dos casos. <strong>Nunca compartilhe senhas nem o link da sua lista com ninguém.</strong></>}
          </p>
        </>
      ) },
    { id: 'faq', titulo: 'Perguntas frequentes',
      corpo: (
        <div className="legal-faq">
          {FAQ_SUPORTE.map(([p, r]) => (
            <details key={p}>
              <summary>{p}</summary>
              <p>{r}</p>
            </details>
          ))}
        </div>
      ) },
    { id: 'requisitos', titulo: 'Requisitos',
      corpo: (
        <ul>
          <li><strong>Android / TV Box</strong>: Android 5.0 ou mais novo (celular: Android 7.0 ou mais novo);</li>
          <li><strong>Samsung</strong>: TVs Tizen de 2020 em diante; <strong>LG</strong>: TVs webOS;</li>
          <li><strong>Roku</strong>: TVs e aparelhos Roku;</li>
          <li><strong>Mac</strong>: macOS 15 ou mais novo, com chip Apple; <strong>Windows</strong>: 10 ou 11, 64 bits;</li>
          <li><strong>iPhone e iPad</strong>: em breve.</li>
        </ul>
      ) },
    { id: 'legal', titulo: 'Documentos',
      corpo: <ul>{PAGINAS_LEGAIS.filter((p) => p.rota !== '/suporte').map((p) => <li key={p.rota}><Link to={p.rota}>{p.rotulo}</Link></li>)}</ul> },
  ];
  return (
    <PaginaLegal
      titulo="Suporte e perguntas frequentes"
      resumo="Respostas rápidas para as dúvidas mais comuns e como falar com a gente."
      secoes={secoes}
    />
  );
}
