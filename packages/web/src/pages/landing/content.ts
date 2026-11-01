/**
 * Conteúdo da landing: FONTE ÚNICA da copy e das regras citadas.
 *
 * Padrão dos sites da Biig (menu.ts / site.ts): trocar texto ou número não
 * encosta em componente. As regras abaixo espelham o backend; se mudarem lá,
 * mudam aqui. A landing antiga exibia números inventados ("+2.400 editores",
 * logos de Globoplay e Nubank, "entrega em 72h"); aqui só entra o que o
 * sistema realmente faz.
 */

/** api/src/lib/fees.ts → PLATFORM_FEE_RATE */
export const PLATFORM_FEE_RATE = 0.1
/** api/src/services/agreement.service.ts → AUTO_APPROVE_DAYS */
export const AUTO_APPROVE_DAYS = 7
/** api/src/services/subscription.service.ts → PREMIUM_MONTHLY_PRICE */
export const PREMIUM_MONTHLY_PRICE = 39.9

export const NAV = [
  { id: 'como-funciona', label: 'Como funciona' },
  { id: 'formatos', label: 'Formatos' },
  { id: 'editores', label: 'Editores' },
  { id: 'para-editores', label: 'Para editores' },
  { id: 'duvidas', label: 'Dúvidas' },
] as const

/** Faixa infinita logo abaixo do hero. Formatos, não marcas: não temos clientes famosos para citar. */
export const FORMATS_TICKER = [
  'Reels',
  'Shorts',
  'YouTube',
  'TikTok',
  'Podcast',
  'Cortes de live',
  'Vlog',
  'Corporativo',
  'Casamento',
  'Tutorial',
]

/**
 * Navegação por necessidade (padrão do site-clinica-ortopedia do acervo):
 * o criador chega com um problema, não com o nome de uma categoria.
 * `category` é o nome exato da categoria do seed.
 */
export const NEEDS = [
  {
    need: 'Gravei uma live de 3 horas e quero os melhores momentos',
    category: 'Podcast',
    detail: 'Cortes com legenda, prontos para postar.',
  },
  {
    need: 'Preciso de Reels que segurem a atenção nos 3 primeiros segundos',
    category: 'Reels',
    detail: 'Gancho, ritmo e legenda dinâmica no vertical.',
  },
  {
    need: 'Meu vlog tem 40 minutos de bruto e vira 12 no YouTube',
    category: 'YouTube',
    detail: 'Long-form com narrativa, trilha e thumbnail.',
  },
  {
    need: 'Quero entrar numa trend do TikTok antes que ela passe',
    category: 'TikTok',
    detail: 'Edição rápida, no formato que a trend pede.',
  },
  {
    need: 'A empresa precisa de um vídeo institucional que não pareça amador',
    category: 'Corporativo',
    detail: 'Cases, depoimentos e vídeo de apresentação.',
  },
  {
    need: 'Filmei um casamento e preciso do filme e do teaser',
    category: 'Wedding',
    detail: 'Cinematográfico, com cor e som tratados.',
  },
]

/** Painéis empilhados do "Como funciona" (padrão anim-paineis-empilhados-abas). Máximo 5. */
export const STEPS = [
  {
    tab: 'Pedido',
    title: 'Escolha o editor ou publique o que precisa',
    text: 'Filtre por formato e veja o portfólio antes de falar com alguém. Ou publique uma solicitação e receba propostas dos editores.',
    chip: 'Solicitação publicada',
  },
  {
    tab: 'Contrato',
    title: 'Escopo, prazo e valor por escrito',
    text: 'Cada pedido tem um contrato com aceite eletrônico das duas partes. Ninguém depende de print de conversa.',
    chip: 'Contrato aceito pelos dois',
  },
  {
    tab: 'Pagamento',
    title: 'Você paga, a CutMakers segura',
    text: 'O PIX fica retido na plataforma. O editor sabe que o dinheiro existe, e você sabe que ele só sai com a sua aprovação.',
    chip: 'PIX retido na plataforma',
  },
  {
    tab: 'Entrega',
    title: 'Versões, revisões e chat no mesmo lugar',
    text: 'O editor envia a entrega, você pede ajustes pontuais e cada versão fica guardada no pedido.',
    chip: 'Entrega v2 recebida',
  },
  {
    tab: 'Aprovação',
    title: 'Aprovou, liberou',
    text: `O pagamento vai para o editor quando você aprova. Sem resposta em ${AUTO_APPROVE_DAYS} dias, a entrega é aprovada sozinha. Discordou? Abra uma disputa e a equipe media.`,
    chip: 'Pagamento liberado',
  },
]

export const AUDIENCES = {
  creator: {
    tab: 'Sou criador',
    title: 'Você grava. O corte fica com quem entende.',
    points: [
      'Cadastro grátis, sem mensalidade',
      'Portfólio e avaliações antes de contratar',
      'Publique uma solicitação e receba propostas',
      'Pague só o valor combinado, sem taxa por cima',
      'Favoritos para voltar ao editor que acertou',
    ],
    cta: 'Encontrar editor',
  },
  editor: {
    tab: 'Sou editor',
    title: 'Edite sem correr atrás de pagamento.',
    points: [
      'O valor do pedido fica garantido antes de você começar',
      'Oportunidades: propostas para pedidos publicados pelos criadores',
      'Contrato com escopo, prazo e número de revisões',
      `Premium por R$ ${PREMIUM_MONTHLY_PRICE.toFixed(2).replace('.', ',')}/mês: destaque no feed e selo Premium`,
      `Taxa de ${PLATFORM_FEE_RATE * 100}% só sobre trabalho concluído`,
    ],
    cta: 'Criar perfil de editor',
  },
} as const

export const FAQ = [
  {
    q: 'E se eu não gostar da edição?',
    a: 'Você pede revisão direto no pedido, dizendo o que mudar. O contrato já traz as rodadas inclusas (duas, por padrão). Se não houver acordo, abra uma disputa: a equipe lê a conversa e as entregas e decide.',
  },
  {
    q: 'Quando o editor recebe?',
    a: `Quando o criador aprova a entrega. Se o criador não responder em ${AUTO_APPROVE_DAYS} dias corridos, a entrega é aprovada automaticamente, como diz o contrato.`,
  },
  {
    q: 'Quanto custa usar a CutMakers?',
    a: `Para o criador, nada além do valor combinado com o editor. Para o editor, ${PLATFORM_FEE_RATE * 100}% sobre cada trabalho concluído. O Premium do editor é opcional.`,
  },
  {
    q: 'Meu vídeo bruto passa por vocês?',
    a: 'Os arquivos vão direto do seu navegador para o armazenamento de mídia, sem passar pelo nosso servidor. O editor acessa pelo pedido.',
  },
  {
    q: 'Posso trabalhar sempre com o mesmo editor?',
    a: 'Pode. Salve nos favoritos e chame de novo a cada vídeo. Cada pedido tem o próprio contrato e pagamento.',
  },
]
