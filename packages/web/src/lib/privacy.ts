/**
 * Política de Privacidade da CutMakers — página pública em /privacidade.
 * Descreve os dados que o sistema realmente coleta e os operadores que os tratam. Se algo mudar no
 * produto (novo provedor, novo dado coletado), atualize aqui e a data abaixo.
 */

export const PRIVACY_VERSION = '1.0'
export const PRIVACY_UPDATED_AT = '27 de outubro de 2026'

/** E-mail público de contato para pedidos de titulares (LGPD). Vazio = a página aponta outro canal. */
export const CONTACT_EMAIL = ''

export const PRIVACY_POLICY = `POLÍTICA DE PRIVACIDADE — CutMakers (v${PRIVACY_VERSION})
Atualizada em ${PRIVACY_UPDATED_AT}

Esta política explica quais dados pessoais a CutMakers trata, para quê, com quem compartilha e quais são os seus direitos, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD).

1. QUEM SOMOS. A CutMakers é uma plataforma de intermediação que conecta criadores de conteúdo a editores de vídeo freelancers. Para os dados tratados nesta plataforma, a CutMakers atua como controladora.

2. DADOS QUE COLETAMOS.
a) Cadastro: nome, e-mail, senha (guardada apenas como hash, nunca em texto) e o perfil escolhido (criador ou editor).
b) Login com Google: nome, e-mail verificado e foto do seu perfil Google, recebidos mediante o seu consentimento no login. Não recebemos a sua senha do Google nem acessamos outros dados da conta.
c) Perfil: foto, biografia, categorias, portfólio (vídeos, miniaturas, títulos e preços) e demais informações que você publicar.
d) Pedidos: briefing, arquivos enviados, entregas, revisões, mensagens do chat, propostas, contratos aceitos eletronicamente e avaliações.
e) Pagamentos: valor, status e identificadores das cobranças. Para gerar um PIX, dados do pagador (nome, e-mail e, quando exigido pelo gateway, CPF e telefone) são enviados à processadora de pagamentos. Não armazenamos número de cartão.
f) Registros técnicos e de segurança: endereço IP, data e hora de acesso e trilha de auditoria de ações relevantes (pagamentos, disputas, ações administrativas).
g) Armazenamento no navegador: guardamos no seu navegador (localStorage) o token de sessão e preferências de interface. Não usamos cookies de publicidade nem de rastreamento.

3. PARA QUE USAMOS (BASES LEGAIS).
- Executar o contrato e prestar o serviço: criar a conta, intermediar pedidos, custodiar e liberar pagamentos, mediar disputas (LGPD, art. 7º, V).
- Cumprir obrigações legais e regulatórias: guarda de registros e obrigações fiscais e financeiras (art. 7º, II).
- Legítimo interesse: segurança da plataforma, prevenção a fraude e abuso, melhoria do serviço (art. 7º, IX).
- Consentimento: login com Google e comunicações opcionais; você pode revogar quando quiser (art. 7º, I).

4. COM QUEM COMPARTILHAMOS. Não vendemos dados pessoais. Compartilhamos apenas o necessário com:
- A outra parte do pedido (criador ou editor): nome, foto, avaliações e o conteúdo do pedido.
- Operadores que prestam serviço à CutMakers: hospedagem e banco de dados (Supabase e servidor próprio), armazenamento de arquivos e vídeos (Cloudinary), processamento de pagamentos (AbacatePay) e autenticação (Google).
- Autoridades, quando houver obrigação legal ou ordem judicial.
Alguns desses operadores podem processar dados fora do Brasil; nesse caso, adotamos as salvaguardas previstas na LGPD.

5. PERFIL PÚBLICO. Nome, foto, biografia, categorias, portfólio e avaliações de editores são exibidos publicamente na plataforma. Não publique nada que não queira tornar público.

6. POR QUANTO TEMPO GUARDAMOS. Mantemos os dados enquanto a conta estiver ativa. Pedidos, pagamentos, contratos e a trilha de auditoria são registros financeiros e jurídicos e podem ser retidos pelo prazo exigido em lei, mesmo após o encerramento da conta. Passado esse prazo, os dados são excluídos ou anonimizados.

7. SEGURANÇA. Usamos conexão criptografada (HTTPS), senhas com hash, controle de acesso por perfil, validação do segredo das notificações de pagamento e registro de ações sensíveis. Nenhum sistema é totalmente imune a incidentes; em caso de incidente que possa causar risco relevante, comunicaremos você e a ANPD, nos termos da lei.

8. SEUS DIREITOS (LGPD, art. 18). Você pode solicitar: confirmação de que tratamos seus dados; acesso; correção; anonimização, bloqueio ou eliminação de dados desnecessários; portabilidade; informação sobre compartilhamento; e revogação do consentimento. Também pode se opor a tratamentos feitos com base em legítimo interesse. Alguns dados não podem ser eliminados de imediato quando precisamos cumprir obrigação legal ou proteger as partes em uma disputa.

9. COMO EXERCER SEUS DIREITOS. {{CONTATO}} Responderemos no prazo previsto em lei. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).

10. MENORES DE IDADE. A plataforma é destinada a maiores de 18 anos. Se identificarmos conta de menor sem a autorização dos responsáveis, ela poderá ser encerrada.

11. ALTERAÇÕES. Podemos atualizar esta política. A versão vigente e a data de atualização ficam sempre nesta página; mudanças relevantes serão avisadas na plataforma.`
