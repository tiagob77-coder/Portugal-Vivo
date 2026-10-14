import type React from 'react';
import type { MaterialIcons } from '@expo/vector-icons';
import type { Href } from 'expo-router';
import type { TFunction } from 'i18next';

/**
 * Narrativas dos módulos temáticos — história, marcos e ligações cruzadas
 *
 * Os módulos são o diferenciador editorial do Portugal Vivo: cada um abre com
 * uma leitura própria do território, uma linha do tempo com os marcos que
 * explicam o presente, e ligações para os módulos vizinhos.
 *
 * Fonte: protótipo Claude Design (Portugal Vivo App.dc.html), secção MODEXTRA.
 */

/** Nome válido de ícone MaterialIcons */
export type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

export interface ModuleMilestone {
  /** Ano ou período ("1756", "Séc. XV", "Hoje") */
  year: string;
  title: string;
  desc: string;
}

export interface ModuleNarrative {
  /** Nome apresentado ao utilizador */
  label: string;
  /** Rota expo-router do módulo */
  route: Href;
  /** Ícone MaterialIcons */
  icon: MaterialIconName;
  /** Texto de abertura — a leitura do módulo */
  story: string;
  /** Slugs de 3 módulos cruzados por tema */
  links: string[];
  /** Marcos da linha do tempo, por ordem cronológica */
  milestones: ModuleMilestone[];
  /** Categorias da base para filtrar a Enciclopédia a partir do módulo */
  categories: string[];
}

export const moduleNarratives: Record<string, ModuleNarrative> = {
  biodiversidade: {
    label: 'Biodiversidade Marinha',
    route: '/biodiversidade',
    icon: 'waves',
    story:
      'A costa portuguesa junta águas frias de afloramento e correntes subtropicais — uma das maiores diversidades marinhas da Europa, protegida por uma rede de áreas marinhas que começou nas ilhas.',
    links: ['costa', 'cultura-maritima', 'gastronomia'],
    milestones: [
      { year: '1981', title: 'Reserva Natural das Berlengas', desc: 'Primeiro grande reforço de proteção marinha no litoral continental.' },
      { year: '1987', title: 'Parque Natural da Ria Formosa', desc: 'Sistema lagunar com ilhas-barreira e berçário de espécies costeiras.' },
      { year: '1998', title: 'Parque Marinho Luiz Saldanha', desc: 'Arrábida — primeiro parque marinho em águas continentais portuguesas.' },
      { year: '2021', title: 'Selvagens', desc: 'Área marinha totalmente protegida de referência no Atlântico Norte.' },
    ],
    categories: ['Natureza Especializada', 'Praias Bandeira Azul'],
  },
  flora: {
    label: 'Flora Endémica',
    route: '/flora',
    icon: 'local-florist',
    story:
      'Do Atlântico à montanha, Portugal guarda floras que não existem em mais nenhum lugar — relíquias do Terciário nas ilhas e endemismos ibéricos no continente.',
    links: ['fauna', 'infraestrutura', 'prehistoria'],
    milestones: [
      { year: 'Séc. XV', title: 'Laurissilva descrita', desc: 'Os primeiros colonos da Madeira encontram uma floresta de louros com milhões de anos.' },
      { year: '1976', title: 'Parque Natural da Serra da Estrela', desc: 'Proteção da flora de altitude do continente.' },
      { year: '1999', title: 'Laurissilva — UNESCO', desc: 'Património Mundial Natural; maior mancha de laurissilva do mundo.' },
    ],
    categories: ['Natureza Especializada', 'Aventura e Natureza'],
  },
  fauna: {
    label: 'Fauna & Habitats',
    route: '/fauna',
    icon: 'pets',
    story:
      'A fauna ibérica sobreviveu nos vazios do interior. Hoje o lobo e o lince são o termómetro do estado dos habitats — e as zonas húmidas são escala obrigatória das rotas migratórias atlânticas.',
    links: ['flora', 'infraestrutura', 'costa'],
    milestones: [
      { year: '1988', title: 'Lobo-ibérico protegido', desc: 'Lei de proteção total da espécie em Portugal.' },
      { year: '2015', title: 'Regresso do lince-ibérico', desc: 'Primeiras libertações no Vale do Guadiana.' },
      { year: 'Todo o ano', title: 'Rotas migratórias', desc: 'Ria Formosa, Sado e Tejo como paragem do corredor atlântico.' },
    ],
    categories: ['Natureza Especializada', 'Aventura e Natureza'],
  },
  gastronomia: {
    label: 'Gastronomia Costeira',
    route: '/gastronomia',
    icon: 'restaurant',
    story:
      'A cozinha do litoral nasceu do que a maré dava: peixe humilde, marisco de rocha e caldos de partilha. Cada técnica — assar, cataplanar, escabechar — conta uma rota de comércio.',
    links: ['economia', 'cultura-maritima', 'costa'],
    milestones: [
      { year: 'Herança árabe', title: 'Cataplana', desc: 'Cozinha em vapor fechado, assinatura do Algarve.' },
      { year: 'Séc. XIX', title: 'Sardinha assada', desc: 'Da faina para a rua — hoje símbolo dos Santos Populares.' },
      { year: 'Hoje', title: 'Percebes regulados', desc: 'Apanha licenciada na Costa Vicentina para travar a sobre-exploração.' },
    ],
    categories: ['Restaurantes e Gastronomia', 'Tabernas Históricas', 'Produtores DOP e Locais'],
  },
  'cultura-maritima': {
    label: 'Cultura Marítima',
    route: '/cultura-maritima',
    icon: 'sailing',
    story:
      'Antes das estradas havia o mar e a ria. As artes de pesca, os barcos e as procissiões do mar são o arquivo vivo dessa economia — e continuam a acontecer nas mesmas praias.',
    links: ['biodiversidade', 'gastronomia', 'musica'],
    milestones: [
      { year: 'Tradição', title: 'Arte Xávega', desc: 'Arrasto puxado para terra na costa central — hoje demonstração e património.' },
      { year: 'Ria de Aveiro', title: 'Moliceiros', desc: 'Barcos de colheita de moliço, decorados com painéis narrativos.' },
      { year: 'Anual', title: 'Procissiões do mar', desc: 'Festas de N.ª Sr.ª dos Navegantes ao longo de todo o litoral.' },
    ],
    categories: ['Faróis', 'Pérolas de Portugal'],
  },
  infraestrutura: {
    label: 'Infraestrutura Natural',
    route: '/infraestrutura',
    icon: 'account-tree',
    story:
      'A engenharia pública virou atração: passadiços, ecopistas e pontes suspensas abriram paisagens que antes só os locais conheciam — e mudaram a economia de vales inteiros.',
    links: ['flora', 'fauna', 'economia'],
    milestones: [
      { year: '2002', title: 'Alqueva enche', desc: 'Maior lago artificial da Europa; redesenha o Alentejo.' },
      { year: '2015', title: 'Passadiços do Paiva', desc: '8,7 km sobre o rio; modelo replicado em todo o país.' },
      { year: '2021', title: '516 Arouca', desc: 'Ponte pedonal suspensa de 516 m sobre o Paiva.' },
    ],
    categories: ['Ecovias e Passadiços', 'Barragens e Albufeiras', 'Moinhos e Azenhas'],
  },
  economia: {
    label: 'Economia Local',
    route: '/economia',
    icon: 'storefront',
    story:
      'A economia local é feita de denominações, mercados e ofícios. O Douro inventou a ideia moderna de região demarcada — e o mapa DOP continua a ser o melhor guia de sabores.',
    links: ['gastronomia', 'infraestrutura', 'rotas-culturais'],
    milestones: [
      { year: '1756', title: 'Região Demarcada do Douro', desc: 'A primeira região vinícola demarcada e regulada do mundo.' },
      { year: 'Séc. XX', title: 'Mercados municipais', desc: 'Bolhão, Ribeira e Livramento fixam o comércio de proximidade.' },
      { year: '2022', title: 'Bolhão reabre', desc: 'Reabilitação devolve o mercado histórico ao Porto.' },
    ],
    categories: ['Produtores DOP e Locais', 'Agroturismo e Enoturismo'],
  },
  prehistoria: {
    label: 'Pré-História & Astronomia',
    route: '/prehistoria',
    icon: 'auto-awesome',
    story:
      'O sul de Portugal tem uma das maiores concentrações megalíticas da Europa — e, por cima, o céu mais escuro do continente. Pedra e estrelas contam a mesma história de orientação.',
    links: ['flora', 'rotas-culturais', 'economia'],
    milestones: [
      { year: 'c. 6000 a.C.', title: 'Cromeleque dos Almendres', desc: 'Recinto megalítico alinhado com os solstícios, perto de Évora.' },
      { year: '1994', title: 'Descoberta do Côa', desc: 'Gravuras paleolíticas ao ar livre; UNESCO em 1998.' },
      { year: '2011', title: 'Dark Sky Alqueva', desc: 'Primeiro destino do mundo certificado Starlight.' },
    ],
    categories: ['Arqueologia, Geologia e Mineral'],
  },
  costa: {
    label: 'Costa & Litoral',
    route: '/costa',
    icon: 'beach-access',
    story:
      '1 800 km de costa em quatro realidades: arribas, dunas, estuários e ilhas-barreira. A Bandeira Azul e as reservas de surf transformaram a orla em infraestrutura de lazer regulada.',
    links: ['biodiversidade', 'cultura-maritima', 'gastronomia'],
    milestones: [
      { year: '1984', title: 'Arriba Fóssil da Caparica', desc: 'Paisagem protegida — arquivo geológico à vista.' },
      { year: '1987', title: 'Bandeira Azul', desc: 'Portugal adere ao programa; hoje líder europeu por praia.' },
      { year: '2011', title: 'Reserva Mundial de Surf', desc: 'Ericeira — a primeira da Europa.' },
    ],
    categories: ['Praias Bandeira Azul', 'Praias Fluviais', 'Surf'],
  },
  musica: {
    label: 'Música Tradicional',
    route: '/musica',
    icon: 'music-note',
    story:
      'Duas músicas portuguesas são Património Imaterial da Humanidade. Entre o fado urbano e o cante coletivo do Alentejo cabe todo um país — e instrumentos que viajaram o mundo.',
    links: ['rotas-culturais', 'cultura-maritima', 'economia'],
    milestones: [
      { year: '2011', title: 'Fado — UNESCO', desc: 'Património Imaterial; Lisboa e Coimbra como escolas distintas.' },
      { year: '2014', title: 'Cante Alentejano — UNESCO', desc: 'Canto polifónico sem instrumentos, de raiz coletiva.' },
      { year: 'Emigração', title: 'Do cavaquinho ao ukulele', desc: 'O machete madeirense chega ao Havaí com os emigrantes.' },
    ],
    categories: ['Pérolas de Portugal'],
  },
  'rotas-culturais': {
    label: 'Rotas Culturais',
    route: '/rotas-culturais',
    icon: 'route',
    story:
      'As festas são o calendário real do país. Ligadas em rota, revelam continuidades — máscaras de inverno, romarias de verão, ciclos agrícolas — que nenhum monumento isolado mostra.',
    links: ['musica', 'prehistoria', 'economia'],
    milestones: [
      { year: 'Raiz medieval', title: 'Tabuleiros de Tomar', desc: 'Cortejo de pão e flores, de quatro em quatro anos.' },
      { year: 'Séc. XVIII', title: 'Sr.ª da Agonia', desc: 'Viana do Castelo — romaria, traje e ouro do Minho.' },
      { year: '2019', title: 'Caretos de Podence — UNESCO', desc: 'Máscaras de entrudo de Trás-os-Montes.' },
    ],
    categories: ['Pérolas de Portugal', 'Arte Urbana e Intervenção'],
  },
  inclusivo: {
    label: 'Turismo Inclusivo',
    route: '/inclusivo',
    icon: 'accessible',
    story:
      'Acessibilidade não é um equipamento, é uma cadeia: chegar, estacionar, entrar, usar e sair. O Portugal Vivo trata a informação de apoio como dado verificável — praia a praia, percurso a percurso.',
    links: ['costa', 'infraestrutura', 'economia'],
    milestones: [
      { year: '2005', title: 'Praia Acessível — Praia para Todos', desc: 'Programa nacional que criou passadeiras, apoio balnear e cadeira anfíbia em praias vigiadas.' },
      { year: '2017', title: 'Rede de percursos acessíveis', desc: 'Passadiços e ecovias em plataforma contínua passam a ser projetados sem degraus.' },
      { year: 'Hoje', title: '443 praias Bandeira Azul', desc: 'Uma parte crescente com apoio verificado a mobilidade reduzida na época balnear.' },
    ],
    categories: ['Ecovias e Passadiços', 'Praias Bandeira Azul'],
  },
};

/** Slugs dos módulos, pela ordem em que aparecem na grelha do Viver. */
export const MODULE_SLUGS = Object.keys(moduleNarratives);

export function getModuleNarrative(slug: string): ModuleNarrative | undefined {
  return moduleNarratives[slug];
}

/** Os 3 módulos cruzados de um módulo, já resolvidos. */
export function getLinkedModules(slug: string): (ModuleNarrative & { slug: string })[] {
  const narrative = moduleNarratives[slug];
  if (!narrative) return [];
  return narrative.links
    .map((s) => (moduleNarratives[s] ? { ...moduleNarratives[s], slug: s } : null))
    .filter((m): m is ModuleNarrative & { slug: string } => m !== null);
}

/**
 * Texto editorial de um módulo na língua da interface. As traduções vivem em
 * `i18n/areas/moduleContent.json`, indexadas pelo slug (e pela posição do marco);
 * o português continua a ser o texto deste ficheiro.
 */
export function localizeModuleNarrative(
  slug: string,
  narrative: ModuleNarrative,
  t: TFunction,
): Pick<ModuleNarrative, 'label' | 'story' | 'milestones'> {
  const base = `moduleContent.modules.${slug}`;
  return {
    label: t(`${base}.label`, { defaultValue: narrative.label }),
    story: t(`${base}.story`, { defaultValue: narrative.story }),
    milestones: narrative.milestones.map((m, i) => ({
      year: t(`${base}.milestones.${i}.year`, { defaultValue: m.year }),
      title: t(`${base}.milestones.${i}.title`, { defaultValue: m.title }),
      desc: t(`${base}.milestones.${i}.desc`, { defaultValue: m.desc }),
    })),
  };
}
