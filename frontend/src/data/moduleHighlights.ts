/**
 * Destaques dos módulos temáticos
 *
 * Cada módulo abre com 4 destaques; 44 deles têm ficha curada (onde ver,
 * coordenadas e história). Os restantes recaem no texto do próprio módulo.
 *
 * Fonte: protótipo Claude Design (Portugal Vivo App.dc.html), MODULES + MODITEMS.
 */

import type { TFunction } from 'i18next';

export interface ModuleHighlight {
  emoji: string;
  name: string;
  meta: string;
}

export interface HighlightDetail {
  /** Onde ver — zona/localidade */
  where: string;
  lat: number;
  lng: number;
  /** Nota histórica redigida para o destaque */
  history: string;
}

/** Os 4 destaques de cada módulo, pela ordem em que aparecem. */
export const moduleHighlights: Record<string, ModuleHighlight[]> = {
  biodiversidade: [
    { emoji: '🐟', name: 'Sardinha-europeia', meta: 'Sardina pilchardus · costa atlântica' },
    { emoji: '🐬', name: 'Golfinho-comum', meta: 'Delphinus delphis · Sado e Algarve' },
    { emoji: '🌊', name: 'Cavalo-marinho', meta: 'Hippocampus guttulatus · Ria Formosa' },
    { emoji: '🐙', name: 'Polvo-comum', meta: 'Octopus vulgaris · litoral rochoso' },
  ],
  flora: [
    { emoji: '🌲', name: 'Dragoeiro', meta: 'Dracaena draco · Madeira e Porto Santo' },
    { emoji: '🌺', name: 'Massaroco', meta: 'Echium candicans · Madeira' },
    { emoji: '🌿', name: 'Esteva', meta: 'Cistus ladanifer · Alentejo interior' },
    { emoji: '🌸', name: 'Urze-da-madeira', meta: 'Erica maderensis · maciço montanhoso' },
  ],
  fauna: [
    { emoji: '🐆', name: 'Lince-ibérico', meta: 'Lynx pardinus · Vale do Guadiana' },
    { emoji: '🐺', name: 'Lobo-ibérico', meta: 'Canis lupus signatus · Trás-os-Montes' },
    { emoji: '🦅', name: 'Águia-de-Bonelli', meta: 'Aquila fasciata · vales do Tejo e Douro' },
    { emoji: '🦩', name: 'Flamingo-rosado', meta: 'Ria Formosa e estuário do Sado' },
  ],
  gastronomia: [
    { emoji: '🍲', name: 'Caldeirada à fragateira', meta: 'Peixe do dia · costa de Lisboa' },
    { emoji: '🦪', name: 'Percebes da Costa Vicentina', meta: 'Marisco · Alentejo e Algarve' },
    { emoji: '🥘', name: 'Cataplana de marisco', meta: 'Algarve' },
    { emoji: '🐟', name: 'Sardinha assada', meta: 'Santos Populares · Lisboa' },
  ],
  'cultura-maritima': [
    { emoji: '⛵', name: 'Arte Xávega', meta: 'Pesca tradicional · Praia de Mira' },
    { emoji: '🚣', name: 'Barcos moliceiros', meta: 'Ria de Aveiro' },
    { emoji: '🧵', name: 'Rendas de bilros', meta: 'Vila do Conde e Peniche' },
    { emoji: '🕯️', name: 'Procissões do mar', meta: 'N.ª Sr.ª dos Navegantes' },
  ],
  infraestrutura: [
    { emoji: '🛤️', name: 'Passadiços do Paiva', meta: 'Arouca · 8,7 km sobre o rio' },
    { emoji: '🚴', name: 'Ecopista do Dão', meta: '49 km · Viseu–Santa Comba Dão' },
    { emoji: '🌉', name: '516 Arouca', meta: 'Ponte suspensa · 516 m' },
    { emoji: '💧', name: 'Barragem do Alqueva', meta: 'Maior lago artificial da Europa' },
  ],
  economia: [
    { emoji: '🧀', name: 'Queijo Serra da Estrela DOP', meta: 'Produtores · Beira Interior' },
    { emoji: '🍷', name: 'Vinho do Porto', meta: 'Quintas do Douro' },
    { emoji: '🧺', name: 'Mercado do Bolhão', meta: 'Porto' },
    { emoji: '🏺', name: 'Olaria de Barcelos', meta: 'Ofícios e artesanato' },
  ],
  prehistoria: [
    { emoji: '🪨', name: 'Cromeleque dos Almendres', meta: 'Évora · c. 6000 a.C.' },
    { emoji: '🖼️', name: 'Gravuras do Côa', meta: 'Património Mundial UNESCO' },
    { emoji: '🔭', name: 'Dark Sky Alqueva', meta: '1.ª reserva Starlight do mundo' },
    { emoji: '🗿', name: 'Anta Grande do Zambujeiro', meta: 'Maior dólmen da Península' },
  ],
  costa: [
    { emoji: '🏖️', name: '443 praias Bandeira Azul', meta: 'Recorde nacional 2026' },
    { emoji: '🌊', name: 'Arriba Fóssil da Caparica', meta: 'Paisagem protegida' },
    { emoji: '🏄', name: 'Reserva Mundial de Surf', meta: 'Ericeira' },
    { emoji: '🏝️', name: 'Ilhas Barreira', meta: 'Ria Formosa · Algarve' },
  ],
  musica: [
    { emoji: '🎤', name: 'Fado', meta: 'Património Imaterial UNESCO · Lisboa e Coimbra' },
    { emoji: '🎶', name: 'Cante Alentejano', meta: 'UNESCO · coros do Baixo Alentejo' },
    { emoji: '🪕', name: 'Cavaquinho minhoto', meta: 'Instrumento tradicional' },
    { emoji: '🥁', name: 'Bombos de Lavacolhos', meta: 'Beira Baixa' },
  ],
  inclusivo: [
    { emoji: '🦽', name: 'Praias acessíveis', meta: 'Cadeira anfíbia e passadeira até à água' },
    { emoji: '🛤️', name: 'Passadiços em plataforma', meta: 'Percursos contínuos sem degraus' },
    { emoji: '🐕', name: 'Alojamento pet-friendly', meta: 'Rede nacional sinalizada' },
    { emoji: '👨‍👩‍👧', name: 'Rotas para famílias', meta: 'Percursos curtos com apoio' },
  ],
  'rotas-culturais': [
    { emoji: '🎻', name: 'Rota do Fado', meta: 'Lisboa · Alfama e Mouraria' },
    { emoji: '💃', name: 'Rota do Folclore', meta: 'Minho e Ribatejo' },
    { emoji: '🎉', name: 'Rota das Festas e Romarias', meta: '140 festas na base' },
    { emoji: '⚙️', name: 'Rota dos Moinhos', meta: 'Oeste' },
  ],
};

/** Fichas curadas, indexadas pelo nome do destaque. */
export const highlightDetails: Record<string, HighlightDetail> = {
  'Sardinha-europeia': {
    where: 'Costa atlântica — Peniche, Matosinhos, Setúbal',
    lat: 39.3558, lng: -9.3811,
    history:
      'Sustentou conservas e comunidades inteiras: a sardinha ditou o calendário da faina e a economia de vilas do litoral desde o século XIX.',
  },
  'Golfinho-comum': {
    where: 'Estuário do Sado e costa algarvia',
    lat: 38.49, lng: -8.89,
    history:
      'A população residente do Sado é uma das poucas da Europa a viver dentro de um estuário, acompanhada cientificamente há décadas.',
  },
  'Cavalo-marinho': {
    where: 'Ria Formosa — Olhão e Faro',
    lat: 37.008, lng: -7.84,
    history:
      'A Ria Formosa chegou a ter uma das maiores populações do mundo; o declínio desde os anos 2000 tornou-a caso de estudo de conservação.',
  },
  'Polvo-comum': {
    where: 'Litoral rochoso — Algarve e Costa Vicentina',
    lat: 37.094, lng: -8.8,
    history:
      'A pesca com alcatruzes de barro, hoje substituídos por covos, é uma das artes mais antigas do litoral algarvio.',
  },
  'Dragoeiro': {
    where: 'Madeira e Porto Santo',
    lat: 32.6669, lng: -16.9241,
    history:
      'A resina “sangue-de-dragão” foi bem de exportação na Madeira quinhentista, usada em tinturaria e medicina.',
  },
  'Massaroco': {
    where: 'Madeira — Pico do Arieiro e Paul da Serra',
    lat: 32.7357, lng: -16.9283,
    history:
      'Endemismo madeirense que coloniza clareiras da laurissilva e floresce em torres azuis na primavera.',
  },
  'Esteva': {
    where: 'Alentejo interior e Beira Baixa',
    lat: 38.015, lng: -7.8632,
    history:
      'Do ládano da esteva sai um dos fixadores da perfumaria; a planta é pioneira na recuperação de solos pobres.',
  },
  'Urze-da-madeira': {
    where: 'Maciço montanhoso da Madeira',
    lat: 32.758, lng: -16.93,
    history:
      'Domina o urzal de altitude acima da laurissilva, habitat protegido pela Rede Natura 2000.',
  },
  'Lince-ibérico': {
    where: 'Vale do Guadiana — Mértola e Serpa',
    lat: 37.6413, lng: -7.6631,
    history:
      'Extinto em Portugal no final do século XX, regressou em 2015 num dos programas de reintrodução mais bem-sucedidos da Europa.',
  },
  'Lobo-ibérico': {
    where: 'Trás-os-Montes, Peneda-Gerês e Douro Internacional',
    lat: 41.73, lng: -8.16,
    history:
      'Protegido por lei desde 1988; quase toda a população portuguesa vive a norte do rio Douro.',
  },
  'Águia-de-Bonelli': {
    where: 'Vales do Tejo e Douro Internacional',
    lat: 41.07, lng: -6.81,
    history:
      'Recuperou de mínimos históricos com vigilância de ninhos e combate ao envenenamento ilegal.',
  },
  'Flamingo-rosado': {
    where: 'Ria Formosa e estuário do Sado',
    lat: 37.008, lng: -7.84,
    history:
      'As salinas abandonadas tornaram-se refúgio: a espécie passou de visitante rara a presença de todo o ano.',
  },
  'Caldeirada à fragateira': {
    where: 'Costa e estuário de Lisboa',
    lat: 38.7223, lng: -9.1393,
    history:
      'Nasceu a bordo das fragatas do Tejo, feita com o peixe que não se vendia — cozinha de necessidade tornada património.',
  },
  'Percebes da Costa Vicentina': {
    where: 'Costa Vicentina — de Odeceixe a Sagres',
    lat: 37.25, lng: -8.82,
    history:
      'Apanhados nas arribas batidas pelo mar, com licenças limitadas desde os anos 2000 para travar a sobre-exploração.',
  },
  'Cataplana de marisco': {
    where: 'Algarve',
    lat: 37.0194, lng: -7.9304,
    history:
      'A panela de cobre fechada tem raiz na cozinha árabe do Gharb al-Andalus: cozinha a vapor sem perder aroma.',
  },
  'Sardinha assada': {
    where: 'Lisboa e todo o litoral, no verão',
    lat: 38.7139, lng: -9.13,
    history:
      'Da faina para as ruas dos Santos Populares — o cheiro a sardinha assada é o marcador sazonal das cidades ribeirinhas.',
  },
  'Arte Xávega': {
    where: 'Praia de Mira, Torreira e Costa Nova',
    lat: 40.453, lng: -8.8,
    history:
      'Arrasto puxado para terra, antes por juntas de bois e hoje por tratores; sobrevive como património vivo da costa central.',
  },
  'Barcos moliceiros': {
    where: 'Ria de Aveiro',
    lat: 40.6405, lng: -8.6538,
    history:
      'Recolhiam moliço para fertilizar os campos; os painéis pintados na proa eram humor e crónica social da ria.',
  },
  'Rendas de bilros': {
    where: 'Vila do Conde e Peniche',
    lat: 41.352, lng: -8.746,
    history:
      'Ofício feminino de séculos junto ao mar, com escolas próprias que ainda formam rendilheiras.',
  },
  'Procissões do mar': {
    where: 'Todo o litoral, entre junho e setembro',
    lat: 38.6968, lng: -9.4215,
    history:
      'As comunidades de pesca levam a padroeira ao mar para bendizer a faina e recordar os que não voltaram.',
  },
  'Passadiços do Paiva': {
    where: 'Arouca — 8,7 km sobre o rio Paiva',
    lat: 40.933, lng: -8.24,
    history:
      'Inaugurados em 2015, transformaram um vale fechado num destino nacional e criaram um modelo copiado por dezenas de municípios.',
  },
  'Ecopista do Dão': {
    where: 'Viseu – Santa Comba Dão · 49 km',
    lat: 40.6566, lng: -7.9125,
    history:
      'Construída sobre a antiga linha ferroviária do Dão, desativada em 1988 e devolvida ao público como via ciclável.',
  },
  '516 Arouca': {
    where: 'Arouca — ponte suspensa de 516 m',
    lat: 40.986, lng: -8.29,
    history:
      'Aberta em 2021 sobre o desfiladeiro do Paiva; foi a maior ponte pedonal suspensa do mundo à data.',
  },
  'Barragem do Alqueva': {
    where: 'Alentejo — Moura, Portel e Reguengos',
    lat: 38.197, lng: -7.504,
    history:
      'O enchimento a partir de 2002 criou o maior lago artificial da Europa e mudou a agricultura alentejana.',
  },
  'Queijo Serra da Estrela DOP': {
    where: 'Beira Interior — Seia, Gouveia, Celorico',
    lat: 40.418, lng: -7.7,
    history:
      'Feito com leite cru de ovelha bordaleira e coalho de cardo, em produção sazonal de inverno.',
  },
  'Vinho do Porto': {
    where: 'Douro — Régua, Pinhão e Vila Nova de Gaia',
    lat: 41.1912, lng: -7.5445,
    history:
      'Nasce na primeira região demarcada do mundo (1756) e envelhece nas caves de Gaia desde o comércio inglês do século XVIII.',
  },
  'Mercado do Bolhão': {
    where: 'Porto — Rua Formosa',
    lat: 41.1496, lng: -8.606,
    history:
      'Aberto em 1914 e reabilitado até 2022, mantém bancas de família que atravessaram gerações.',
  },
  'Olaria de Barcelos': {
    where: 'Barcelos e Galegos',
    lat: 41.5388, lng: -8.6151,
    history:
      'Da louça utilitária ao Galo de Barcelos: a figuração de Rosa Ramalho levou a olaria minhota aos museus.',
  },
  'Cromeleque dos Almendres': {
    where: 'Évora — Nossa Senhora de Guadalupe',
    lat: 38.557, lng: -8.062,
    history:
      'Cerca de 95 menires erguidos desde c. 6000 a.C., com alinhamentos solares — o maior recinto megalítico da Península.',
  },
  'Gravuras do Côa': {
    where: 'Vila Nova de Foz Côa',
    lat: 41.083, lng: -7.113,
    history:
      'Descobertas em 1994 durante a construção de uma barragem que foi travada; Património Mundial em 1998.',
  },
  'Dark Sky Alqueva': {
    where: 'Alentejo — Monsaraz, Reguengos e Mourão',
    lat: 38.4437, lng: -7.3806,
    history:
      'Primeiro destino do mundo certificado Starlight (2011), com iluminação pública adaptada em vários concelhos.',
  },
  'Anta Grande do Zambujeiro': {
    where: 'Valverde, Évora',
    lat: 38.53, lng: -8.063,
    history:
      'Câmara megalítica com esteios de 8 m, escavada nos anos 1960 — o maior dólmen da Península Ibérica.',
  },
  '443 praias Bandeira Azul': {
    where: 'Todo o país',
    lat: 38.6968, lng: -9.4215,
    history:
      'Portugal adere ao programa em 1987 e tornou-se referência europeia em galardões por quilómetro de costa.',
  },
  'Arriba Fóssil da Caparica': {
    where: 'Almada e Sesimbra',
    lat: 38.585, lng: -9.21,
    history:
      'Paisagem protegida desde 1984: 13 km de arriba que registam milhões de anos de sedimentos.',
  },
  'Reserva Mundial de Surf': {
    where: 'Ericeira — de Ribeira d’Ilhas a São Lourenço',
    lat: 38.993, lng: -9.418,
    history:
      'Primeira reserva mundial de surf da Europa (2011), com sete ondas de classe mundial em 4 km de costa.',
  },
  'Ilhas Barreira': {
    where: 'Ria Formosa — Culatra, Armona e Tavira',
    lat: 36.993, lng: -7.84,
    history:
      'Cordão de ilhas em movimento que protege a ria e sustenta comunidades de mariscadores como a Culatra.',
  },
  'Fado': {
    where: 'Lisboa — Alfama e Mouraria · Coimbra',
    lat: 38.7115, lng: -9.13,
    history:
      'Nasceu nos bairros portuários de Lisboa no século XIX; Património Imaterial da Humanidade desde 2011.',
  },
  'Cante Alentejano': {
    where: 'Baixo Alentejo — Serpa, Cuba e Aljustrel',
    lat: 37.941, lng: -7.596,
    history:
      'Canto coral sem instrumentos, das ceifas e das minas; reconhecido pela UNESCO em 2014.',
  },
  'Cavaquinho minhoto': {
    where: 'Minho — Braga, Guimarães e Amarante',
    lat: 41.5454, lng: -8.4265,
    history:
      'Parente do machete madeirense que os emigrantes levaram ao Havaí, onde deu origem ao ukulele.',
  },
  'Bombos de Lavacolhos': {
    where: 'Fundão — Lavacolhos, Beira Baixa',
    lat: 40.12, lng: -7.58,
    history:
      'Grupos de bombos que marcam romarias e ciclos agrícolas com toques transmitidos oralmente.',
  },
  'Rota do Fado': {
    where: 'Lisboa — Alfama, Mouraria e Bairro Alto',
    lat: 38.712, lng: -9.129,
    history:
      'Liga casas de fado, museus e ruas onde o género se fixou depois de sair das tabernas.',
  },
  'Rota do Folclore': {
    where: 'Minho e Ribatejo',
    lat: 41.4425, lng: -8.2918,
    history:
      'Ranchos e trajes que codificaram a identidade regional a partir do século XIX.',
  },
  'Rota das Festas e Romarias': {
    where: 'Todo o país',
    lat: 41.6932, lng: -8.8329,
    history:
      'Do Entrudo transmontano às romarias de agosto: o calendário festivo é o verdadeiro mapa cultural português.',
  },
  'Rota dos Moinhos': {
    where: 'Oeste — Óbidos, Bombarral e Peniche',
    lat: 39.3606, lng: -9.157,
    history:
      'Moinhos de vento e azenhas que moíam o cereal da região até à eletrificação do século XX.',
  },
};

export function getHighlight(module: string, name: string): ModuleHighlight | undefined {
  return moduleHighlights[module]?.find((h) => h.name === name);
}

export function getHighlightDetail(name: string): HighlightDetail | undefined {
  return highlightDetails[name];
}

/**
 * Nome e meta de um destaque na língua da interface. As traduções vivem em
 * `i18n/areas/moduleContent.json`, indexadas pelo slug do módulo e pelo nome
 * português (que continua a ser o identificador usado nas rotas).
 */
export function localizeHighlight(
  module: string,
  highlight: ModuleHighlight,
  t: TFunction,
): Pick<ModuleHighlight, 'name' | 'meta'> {
  const base = `moduleContent.highlights.${module}.${highlight.name}`;
  return {
    name: t(`${base}.name`, { defaultValue: highlight.name }),
    meta: t(`${base}.meta`, { defaultValue: highlight.meta }),
  };
}

/** Ficha curada (onde ver e história) na língua da interface, indexada pelo nome. */
export function localizeHighlightDetail(
  name: string,
  detail: HighlightDetail,
  t: TFunction,
): Pick<HighlightDetail, 'where' | 'history'> {
  const base = `moduleContent.highlightDetails.${name}`;
  return {
    where: t(`${base}.where`, { defaultValue: detail.where }),
    history: t(`${base}.history`, { defaultValue: detail.history }),
  };
}
