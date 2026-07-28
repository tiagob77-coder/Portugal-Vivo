/**
 * EN2 — a "Route 66 portuguesa"
 *
 * 738,5 km de Chaves a Faro, a única estrada nacional que atravessa o país
 * pelo interior: 11 distritos, 35 concelhos, do granito à ria.
 *
 * Fonte: protótipo Claude Design (Portugal Vivo App.dc.html) —
 * EN2_WP / EN2_TROCOS / EN2_MUST / EN2_DISTRITOS.
 */
import type React from 'react';
import type { MaterialIcons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export interface En2Waypoint {
  name: string;
  lat: number;
  lng: number;
  /** Distância desde Chaves, em km */
  km: number;
}

export interface En2Section {
  /** Número do troço, "01"–"06" */
  n: string;
  title: string;
  /** Quilometragem e sub-região */
  meta: string;
  /** Índices em EN2_WAYPOINTS que delimitam o troço */
  fromIdx: number;
  toIdx: number;
  /** O que muda na paisagem ao longo do troço */
  desc: string;
  highlights: string[];
}

export interface En2Stop {
  name: string;
  sub: string;
  /** Marco quilométrico, e.g. "km 100" */
  km: string;
  lat: number;
  lng: number;
}

export interface En2District {
  name: string;
  icon: IconName;
}

export interface En2Milestone {
  year: string;
  title: string;
  desc: string;
}

/** Comprimento oficial da estrada. */
export const EN2_LENGTH_KM = 738.5;

/** Os 22 pontos de passagem, de norte para sul. */
export const EN2_WAYPOINTS: En2Waypoint[] = [
  { name: 'Chaves', lat: 41.7404, lng: -7.4707, km: 0 },
  { name: 'Vila Pouca de Aguiar', lat: 41.5019, lng: -7.6404, km: 34 },
  { name: 'Vila Real', lat: 41.3006, lng: -7.7441, km: 66 },
  { name: 'Peso da Régua', lat: 41.162, lng: -7.789, km: 91 },
  { name: 'Lamego', lat: 41.0959, lng: -7.8098, km: 100 },
  { name: 'Castro Daire', lat: 40.899, lng: -7.937, km: 137 },
  { name: 'Viseu', lat: 40.6566, lng: -7.9125, km: 170 },
  { name: 'Santa Comba Dão', lat: 40.399, lng: -8.129, km: 209 },
  { name: 'Penacova', lat: 40.27, lng: -8.283, km: 232 },
  { name: 'Góis', lat: 40.156, lng: -8.11, km: 262 },
  { name: 'Pedrógão Grande', lat: 39.916, lng: -8.143, km: 296 },
  { name: 'Sertã', lat: 39.806, lng: -8.098, km: 318 },
  { name: 'Abrantes', lat: 39.465, lng: -8.198, km: 372 },
  { name: 'Ponte de Sor', lat: 39.249, lng: -8.01, km: 405 },
  { name: 'Mora', lat: 38.939, lng: -8.162, km: 445 },
  { name: 'Montemor-o-Novo', lat: 38.648, lng: -8.217, km: 486 },
  { name: 'Torrão', lat: 38.317, lng: -8.227, km: 528 },
  { name: 'Ferreira do Alentejo', lat: 38.057, lng: -8.118, km: 566 },
  { name: 'Castro Verde', lat: 37.6975, lng: -8.0819, km: 617 },
  { name: 'Almodôvar', lat: 37.51, lng: -8.063, km: 648 },
  { name: 'São Brás de Alportel', lat: 37.153, lng: -7.888, km: 710 },
  { name: 'Faro', lat: 37.0194, lng: -7.9304, km: 738 },
];

/** Os 6 troços, cada um com o que muda na paisagem. */
export const EN2_SECTIONS: En2Section[] = [
  {
    n: '01',
    title: 'Chaves → Vila Real',
    meta: 'km 0–66 · Alto Tâmega',
    fromIdx: 0, toIdx: 2,
    desc:
      'Começa no granito e nas águas termais do Alto Tâmega, sobe ao planalto e desce por Pedras Salgadas até Vila Real.',
    highlights: [
      'Ponte de Trajano e balneário romano de Chaves',
      'Águas gasocarbónicas e parque de Pedras Salgadas',
      'Serra do Alvão — aldeias de xisto e cascatas',
    ],
  },
  {
    n: '02',
    title: 'Vila Real → Viseu',
    meta: 'km 66–170 · Douro e Beira Alta',
    fromIdx: 2, toIdx: 6,
    desc:
      'O troço mais fotografado: a estrada corta o Douro vinhateiro na Régua e sobe a Lamego antes de atravessar a Serra de Montemuro.',
    highlights: [
      'Miradouros do Douro entre Santa Marta e a Régua',
      'Santuário dos Remédios e escadaria de Lamego',
      'Sé de Viseu e Museu Grão Vasco',
    ],
  },
  {
    n: '03',
    title: 'Viseu → Góis',
    meta: 'km 170–262 · Dão e Lousã',
    fromIdx: 6, toIdx: 9,
    desc:
      'Vinhas do Dão, o Mondego encaixado em Penacova e a entrada nas aldeias de xisto da Serra da Lousã.',
    highlights: [
      'Quintas e adegas da Região Demarcada do Dão',
      'Penacova — vale do Mondego e os últimos barqueiros',
      'Aldeias de xisto do Pinhal Interior',
    ],
  },
  {
    n: '04',
    title: 'Góis → Abrantes',
    meta: 'km 262–372 · Pinhal Interior',
    fromIdx: 9, toIdx: 12,
    desc:
      'Curvas de serra, praias fluviais do Zêzere e a chegada ao Tejo, com a cozinha mais séria do interior.',
    highlights: [
      'Praias fluviais do Zêzere e do Ceira',
      'Sertã — maranhos, cabrito e bucho recheado',
      'Castelo de Abrantes sobre a planura do Tejo',
    ],
  },
  {
    n: '05',
    title: 'Abrantes → Montemor-o-Novo',
    meta: 'km 372–486 · Alentejo do montado',
    fromIdx: 12, toIdx: 15,
    desc:
      'A estrada abre: sobreiros, searas e horizontes longos. É o troço das rectas e da luz rasante.',
    highlights: [
      'Ponte de Sor — capital da cortiça',
      'Fluviário de Mora e o Raia',
      'Castelo de Montemor-o-Novo sobre a planície',
    ],
  },
  {
    n: '06',
    title: 'Montemor-o-Novo → Faro',
    meta: 'km 486–738 · Campo Branco e Caldeirão',
    fromIdx: 15, toIdx: 21,
    desc:
      'Do Alentejo profundo à serra algarvia: Campo Branco, minas, Almodôvar e a descida do Caldeirão até à Ria Formosa.',
    highlights: [
      'Albufeiras do Vale do Gaio e do Alvito',
      'Castro Verde — aves estepárias do Campo Branco',
      'Calçadinha romana de São Brás e chegada a Faro',
    ],
  },
];

/** 13 locais a não perder, com marco quilométrico. */
export const EN2_MUST_SEE: En2Stop[] = [
  { name: 'Ponte de Trajano', sub: 'Chaves · obra romana sobre o Tâmega', km: 'km 0', lat: 41.7414, lng: -7.4694 },
  { name: 'Parque de Pedras Salgadas', sub: 'Vila Pouca de Aguiar · termas e arquitetura', km: 'km 30', lat: 41.446, lng: -7.599 },
  { name: 'Miradouro de S. Leonardo da Galafura', sub: 'Peso da Régua · o Douro visto de cima', km: 'km 88', lat: 41.173, lng: -7.718 },
  { name: 'Santuário dos Remédios', sub: 'Lamego · escadaria barroca de 686 degraus', km: 'km 100', lat: 41.093, lng: -7.818 },
  { name: 'Museu Grão Vasco', sub: 'Viseu · pintura portuguesa do séc. XVI', km: 'km 170', lat: 40.66, lng: -7.912 },
  { name: 'Ecopista do Dão', sub: 'Santa Comba Dão · 49 km sobre a antiga linha', km: 'km 209', lat: 40.4, lng: -8.129 },
  { name: 'Penedos de Góis', sub: 'Góis · quartzitos e vista de serra', km: 'km 265', lat: 40.145, lng: -8.04 },
  { name: 'Castelo de Abrantes', sub: 'Abrantes · miradouro sobre o Tejo', km: 'km 372', lat: 39.464, lng: -8.199 },
  { name: 'Fluviário de Mora', sub: 'Mora · vida dos rios ibéricos', km: 'km 445', lat: 38.945, lng: -8.156 },
  { name: 'Castelo de Montemor-o-Novo', sub: 'Montemor · vila-cerca alentejana', km: 'km 486', lat: 38.649, lng: -8.22 },
  { name: 'Basílica Real de Castro Verde', sub: 'Castro Verde · azulejos da Batalha de Ourique', km: 'km 617', lat: 37.7, lng: -8.083 },
  { name: 'Calçadinha Romana', sub: 'São Brás de Alportel · via antiga da serra', km: 'km 710', lat: 37.158, lng: -7.885 },
  { name: 'Sé de Faro e Ria Formosa', sub: 'Faro · o fim da estrada, o início do mar', km: 'km 738', lat: 37.014, lng: -7.935 },
];

/** Os 11 distritos atravessados — os carimbos do passaporte. */
export const EN2_DISTRICTS: En2District[] = [
  { name: 'Vila Real', icon: 'terrain' },
  { name: 'Viseu', icon: 'landscape' },
  { name: 'Coimbra', icon: 'forest' },
  { name: 'Leiria', icon: 'park' },
  { name: 'Castelo Branco', icon: 'local-fire-department' },
  { name: 'Santarém', icon: 'agriculture' },
  { name: 'Portalegre', icon: 'grass' },
  { name: 'Évora', icon: 'castle' },
  { name: 'Setúbal', icon: 'water' },
  { name: 'Beja', icon: 'wb-sunny' },
  { name: 'Faro', icon: 'beach-access' },
];

/** De 1945 à "Route 66 portuguesa". */
export const EN2_HISTORY: En2Milestone[] = [
  { year: '1945', title: 'Nasce no Plano Rodoviário Nacional', desc: 'A EN2 é classificada como estrada nacional de primeira classe, com a missão de ligar o interior de norte a sul.' },
  { year: 'Anos 50–60', title: 'A estrada que fez o interior', desc: 'Passa a ser o eixo de correios, feiras e emigração — muitas vilas cresceram à beira dela.' },
  { year: 'Anos 90', title: 'As autoestradas levam o trânsito', desc: 'Os itinerários principais esvaziam a EN2 de camionagem — e devolvem-lhe o ritmo de viagem lenta.' },
  { year: 'Hoje', title: 'A “Route 66 portuguesa”', desc: 'Percurso turístico assumido, com passaporte de carimbos nos municípios e uma comunidade de viajantes que a faz de moto, carro ou bicicleta.' },
];

export const EN2_INTRO =
  'Traçada para costurar o país pelo interior, a EN2 é a única estrada portuguesa ' +
  'que liga a fronteira norte ao Algarve sem sair de terra funda — 738,5 km em que ' +
  'a paisagem muda de granito a xisto, de vinha a montado, de serra a ria.';

export const EN2_FACTS: { icon: IconName; label: string }[] = [
  { icon: 'straighten', label: '738,5 km' },
  { icon: 'flag', label: 'Chaves → Faro' },
  { icon: 'map', label: '11 distritos' },
  { icon: 'location-city', label: '35 concelhos' },
  { icon: 'schedule', label: '6 a 10 dias' },
];

export const EN2_START = EN2_WAYPOINTS[0];
export const EN2_END = EN2_WAYPOINTS[EN2_WAYPOINTS.length - 1];

/** Pontos de um troço, inclusive. */
export function sectionWaypoints(section: En2Section): En2Waypoint[] {
  return EN2_WAYPOINTS.slice(section.fromIdx, section.toIdx + 1);
}
