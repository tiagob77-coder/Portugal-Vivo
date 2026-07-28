/**
 * Guia de Exploração — informação prática por região × categoria
 *
 * 7 regiões × 12 módulos temáticos = 84 guias, cada um com 3 experiências
 * sugeridas (252 no total), leitura regional própria, transportes, clima,
 * alertas e acessibilidade.
 *
 * Fonte: protótipo Claude Design (Portugal Vivo App.dc.html) —
 * GR_REGIONS / GR_MOD / GR_EXPS.
 */

export interface TransportNote {
  label: string;
  text: string;
}

export interface GuideRegion {
  id: string;
  label: string;
  /** Rótulo curto para o chip */
  chip: string;
  /** Sub-regiões, e.g. "Minho · Douro · Trás-os-Montes" */
  sub: string;
  /** Leitura de uma linha sobre o território */
  hook: string;
  transports: TransportNote[];
  /** Melhor altura para visitar */
  best: string;
  /** Avisos sazonais (neve, incêndio, calor) */
  alerts: string[];
  /** Acessibilidade — mobilidade reduzida */
  mobility: string;
  /** Acessibilidade — crianças */
  kids: string;
  /** Acessibilidade — animais */
  pets: string;
}

export interface GuideExperience {
  title: string;
  desc: string;
}

/** As 7 regiões canónicas, pela ordem dos chips. */
export const guideRegions: GuideRegion[] = [
  {
    id: 'norte',
    label: 'Norte',
    chip: 'Norte',
    sub: 'Minho · Douro · Trás-os-Montes',
    hook:
      'Granito, vinha em socalcos e serras a leste: do Minho húmido aos invernos rigorosos de Trás-os-Montes.',
    transports: [
      { label: 'Comboio (CP)', text: 'Linha do Douro (Porto–Pocinho) e Linha do Minho (Porto–Valença) servem os vales vinhateiros e a fronteira norte.' },
      { label: 'Rede Expressos', text: 'Porto, Braga, Vila Real e Bragança são os hubs rodoviários com ligações diárias a Lisboa.' },
      { label: 'Nota local', text: 'Para o Douro Superior, o Gerês e as aldeias de Montalegre recomenda-se viatura própria — as carreiras rurais são escassas ao fim de semana.' },
    ],
    best: 'Maio a outubro; setembro para as vindimas do Douro.',
    alerts: [
      'No inverno, neve e gelo podem cortar estradas no Gerês, Larouco e Montesinho.',
      'No verão, verifique o índice de risco de incêndio antes de entrar em zonas florestais.',
    ],
    mobility:
      'Porto tem metro e autocarros acessíveis; centros históricos de Guimarães e Viana têm calçada irregular e ruas em declive.',
    kids:
      'Boa oferta familiar: cruzeiros no Douro, museus interativos e praias fluviais vigiadas no verão.',
    pets:
      'Aceites em muitos alojamentos rurais e miradouros; proibidos em interiores de museus e adegas em laboração.',
  },
  {
    id: 'centro',
    label: 'Centro',
    chip: 'Centro',
    sub: 'Beiras · Serra da Estrela · Ria de Aveiro',
    hook:
      'Xisto, granito e mar: aldeias serranas, o planalto mais alto do continente e uma ria de canais a norte da Nazaré.',
    transports: [
      { label: 'Comboio (CP)', text: 'Linha do Norte para Aveiro (ligação a Ílhavo/Vista Alegre) e Linha da Beira Baixa para a Covilhã e o Fundão.' },
      { label: 'Rede Expressos', text: 'Coimbra, Viseu e Covilhã concentram as ligações frequentes a partir de Lisboa e Porto.' },
      { label: 'Nota local', text: 'Para aldeias de ofício como Molelos ou as Aldeias do Xisto, recomenda-se vivamente viatura própria.' },
    ],
    best: 'Primavera (abril a junho) e outono (setembro a outubro), com temperaturas amenas para caminhadas e visitas a oficinas.',
    alerts: [
      'No inverno, a Serra da Estrela pode ter estradas cortadas por neve.',
      'Em julho e agosto o interior ultrapassa os 40 °C; confirme sempre o risco de incêndio.',
    ],
    mobility:
      'Museus e unidades industriais modernas são totalmente acessíveis; oficinas tradicionais em aldeias históricas têm degraus e calçada irregular.',
    kids:
      'Muito recomendado: a componente tátil dos ofícios e dos centros de ciência prende os mais novos.',
    pets:
      'Geralmente não permitidos em museus e áreas de produção, por higiene e segurança — exceto cães-guia.',
  },
  {
    id: 'lisboa',
    label: 'Lisboa',
    chip: 'Lisboa',
    sub: 'Estuário do Tejo · Sintra · Arrábida',
    hook:
      'Uma capital de sete colinas entre dois estuários, com serra atlântica a ocidente e arriba calcária a sul.',
    transports: [
      { label: 'Comboio e barco', text: 'Urbanos da CP (Sintra, Cascais, Azambuja, Sado), Fertagus para a margem sul e ferries Transtejo/Soflusa.' },
      { label: 'Metro e Carris', text: 'Quatro linhas de metro, incluindo aeroporto; passe Navegante válido em toda a área metropolitana.' },
      { label: 'Nota local', text: 'Sintra e Cascais fazem-se melhor de comboio: o estacionamento na serra é muito limitado no verão.' },
    ],
    best: 'Março a junho e setembro a outubro; evite o pico de agosto em Sintra e Belém.',
    alerts: [
      'Ondas de calor com mais de 38 °C no vale do Tejo em julho e agosto.',
      'Nortada forte e correntes na costa do Guincho e Ericeira — respeite as bandeiras.',
    ],
    mobility:
      'A maioria das estações de metro tem elevador; Alfama, Bairro Alto e a Serra de Sintra têm declives e calçada portuguesa exigentes.',
    kids:
      'Oceanário, museus interativos e praias de rio e mar com apoio a 30 minutos do centro.',
    pets:
      'Permitidos em esplanadas e jardins; nos transportes só em transportadora, exceto cães-guia.',
  },
  {
    id: 'alentejo',
    label: 'Alentejo',
    chip: 'Alentejo',
    sub: 'Montado · Alqueva · Costa Vicentina',
    hook:
      'Planície aberta de montado e trigo, cidades muradas e uma costa de arriba onde o vento manda.',
    transports: [
      { label: 'Comboio (CP)', text: 'Linha do Alentejo até Évora, Beja e Funcheira; ligações a Lisboa por Casa Branca.' },
      { label: 'Rede Expressos', text: 'Évora, Beja e Portalegre com carreiras diárias; a costa é servida por Vila Nova de Milfontes e Odemira.' },
      { label: 'Nota local', text: 'O Alentejo pede carro: distâncias grandes entre aldeias e transporte público muito espaçado.' },
    ],
    best: 'Março a maio e outubro, quando a planície está verde ou dourada e o calor é suportável.',
    alerts: [
      'Verões acima de 40 °C e sombra escassa — leve água e evite as horas centrais.',
      'Risco de incêndio elevado; estradas rurais sem cobertura de rede em alguns troços.',
    ],
    mobility:
      'Évora e Beja têm centros parcialmente acessíveis; montes rurais e sítios megalíticos têm acessos em terra batida.',
    kids:
      'Céu escuro do Alqueva, passeios de barco e observação de aves funcionam muito bem com crianças.',
    pets:
      'Muito bem recebidos em turismo rural; interdição em áreas de pastoreio e reservas com aves nidificantes.',
  },
  {
    id: 'algarve',
    label: 'Algarve',
    chip: 'Algarve',
    sub: 'Barlavento · Sotavento · Serra do Caldeirão',
    hook:
      'Arribas douradas a ocidente, lagunas quentes a oriente e uma serra de xisto que quase ninguém visita.',
    transports: [
      { label: 'Comboio (CP)', text: 'Linha do Algarve entre Lagos e Vila Real de Santo António, paralela a toda a costa.' },
      { label: 'Vamus Algarve', text: 'Rede intermunicipal, incluindo ligação ao aeroporto de Faro.' },
      { label: 'Nota local', text: 'Para a Costa Vicentina e a serra recomenda-se viatura; no verão chegue às praias antes das 10h.' },
    ],
    best: 'Abril a junho e setembro a outubro: mar tépido sem a lotação de agosto.',
    alerts: [
      'Correntes de retorno e derrocadas de arriba — nunca se instale ao pé da falésia.',
      'Calor acima de 38 °C no interior e cheias rápidas em ribeiras no outono.',
    ],
    mobility:
      'Praias com passadeiras, cadeiras anfíbias e apoio na época balnear; miradouros de arriba sem acesso adaptado.',
    kids:
      'Praias abrigadas no sotavento, passeios na Ria Formosa e zoos e parques aquáticos junto à costa.',
    pets:
      'Praias pet-friendly sinalizadas fora da época balnear; verifique a portaria municipal.',
  },
  {
    id: 'acores',
    label: 'Açores',
    chip: 'Açores',
    sub: 'Nove ilhas · Atlântico médio',
    hook:
      'Nove ilhas vulcânicas em pleno Atlântico, com quatro estações no mesmo dia e uma cultura de mar antiga.',
    transports: [
      { label: 'Avião', text: 'SATA Azores Airlines liga as nove ilhas e o continente; reserve os inter-ilhas com antecedência.' },
      { label: 'Ferries Atlânticoline', text: 'Ligações regulares no grupo central (Faial, Pico, São Jorge) e sazonais nos restantes.' },
      { label: 'Nota local', text: 'Alugue viatura em cada ilha: os transportes públicos servem sobretudo horários escolares.' },
    ],
    best: 'Junho a setembro para mar e cetáceos; abril e maio para hortênsias e trilhos vazios.',
    alerts: [
      'Tempo muito variável: nevoeiro, chuva e vento podem cancelar trilhos e ferries no mesmo dia.',
      'Mar cruzado nas piscinas naturais — só entre com bandeira e maré favoráveis.',
    ],
    mobility:
      'Ponta Delgada, Angra e Horta têm frentes de mar acessíveis; trilhos, fajãs e caldeiras não são adaptados.',
    kids:
      'Observação de cetáceos, piscinas naturais e centros vulcanológicos com forte componente prática.',
    pets:
      'Transporte inter-ilhas com regras próprias; reservas naturais com nidificação são interditas a animais.',
  },
  {
    id: 'madeira',
    label: 'Madeira',
    chip: 'Madeira',
    sub: 'Maciço central · Porto Santo',
    hook:
      'Uma montanha no oceano: laurissilva húmida a norte, sol a sul e uma ilha de areia dourada a nordeste.',
    transports: [
      { label: 'Avião e ferry', text: 'Aeroporto da Madeira no Funchal; ferry diário para Porto Santo a partir do Funchal.' },
      { label: 'Horários do Funchal', text: 'Rede urbana e suburbana densa; teleféricos ligam a baixa ao Monte e às Fajãs.' },
      { label: 'Nota local', text: 'Para levadas e miradouros do maciço, transfer ou táxi evita o problema do regresso em percursos lineares.' },
    ],
    best: 'Todo o ano; abril e maio para flor, setembro para mar calmo.',
    alerts: [
      'Levadas escorregadias e túneis sem luz — leve lanterna e verifique se o percurso está aberto.',
      'Nevoeiro e frio súbito acima dos 1500 m no Areeiro e Ruivo.',
    ],
    mobility:
      'Funchal, teleféricos e vários miradouros são acessíveis; levadas e veredas do maciço não são adaptadas.',
    kids:
      'Piscinas naturais de Porto Moniz, teleféricos e o comboio botânico do Monte são fáceis com crianças.',
    pets:
      'Aceites em muitos hotéis e esplanadas; proibidos em levadas dentro da área da laurissilva protegida.',
  },
];

/**
 * Leitura editorial de cada módulo: a lente com que olha o território, e o
 * ângulo específico de cada região.
 */
export const guideModuleLenses: Record<string, { lens: string; angles: Record<string, string> }> = {
  biodiversidade: {
    lens:
      'A costa portuguesa junta afloramento frio e correntes subtropicais — cada região mostra uma comunidade marinha diferente.',
    angles: {
      norte:
        'No Norte, o litoral rochoso de Viana a Matosinhos guarda poças de maré, e a foz do Minho é corredor de migração da lampreia e do sável.',
      centro:
        'No Centro, a Ria de Aveiro e o canhão da Nazaré põem lado a lado um berçário lagunar e um dos maiores desfiladeiros submarinos do mundo.',
      lisboa:
        'Em Lisboa, o estuário do Tejo e o Parque Marinho Luiz Saldanha, na Arrábida, concentram roazes, limícolas e fundos protegidos desde 1998.',
      alentejo:
        'No Alentejo, o Sado acolhe a população residente de roazes-corvineiros e a Costa Vicentina protege percebes e cracas em arriba batida.',
      algarve:
        'No Algarve, a Ria Formosa é o sistema lagunar mais rico do país — cavalos-marinhos, ostras e ilhas-barreira em movimento constante.',
      acores:
        'Nos Açores, montes submarinos e canais atraem cachalotes e baleias durante todo o ano, com observação sujeita a licença.',
      madeira:
        'Na Madeira, o Garajau e as Desertas protegem a foca-monge, uma das populações mais raras do planeta.',
    },
  },
  flora: {
    lens:
      'Portugal reúne floras que não existem em mais nenhum lugar: relíquias atlânticas nas ilhas e endemismos ibéricos no continente.',
    angles: {
      norte:
        'No Norte, o Gerês guarda carvalho-alvarinho, azevinho e o lírio-do-gerês em vales de granito permanentemente húmidos.',
      centro:
        'No Centro, a Serra da Estrela sobe do carvalhal ao planalto de altitude, com zimbro-rasteiro e cervum acima dos 1500 m.',
      lisboa:
        'Em Lisboa, a Serra de Sintra cruza mata exótica do séc. XIX com fetos atlânticos, e a Arrábida guarda o carrasco mediterrânico.',
      alentejo:
        'No Alentejo, o montado de sobro e azinho é paisagem construída: esteva, rosmaninho e orquídeas silvestres no sub-bosque.',
      algarve:
        'No Algarve, o Barrocal e a serra do Caldeirão juntam medronheiro e alfarrobeira aos endemismos de arriba da Costa Vicentina.',
      acores:
        'Nos Açores, a laurissilva das Flores e as turfeiras do Pico guardam cedro-do-mato e musgos endémicos.',
      madeira:
        'Na Madeira, a laurissilva é Património Mundial desde 1999 — dragoeiro, massaroco e urze-da-madeira no maciço central.',
    },
  },
  fauna: {
    lens:
      'A fauna ibérica sobreviveu nos vazios do interior; hoje o lobo, o lince e as aves migradoras medem o estado dos habitats.',
    angles: {
      norte:
        'No Norte, Montesinho e o Alvão são o núcleo do lobo-ibérico; a Peneda guarda garranos em liberdade.',
      centro:
        'No Centro, a Serra da Estrela e a Malcata acolhem cabra-montês e aves de rapina em vales encaixados.',
      lisboa:
        'Em Lisboa, o estuário do Tejo é uma das dez zonas húmidas mais importantes da Europa para limícolas e flamingos.',
      alentejo:
        'No Alentejo, o Vale do Guadiana viu regressar o lince-ibérico e a planície cerealífera é o último refúgio da abetarda.',
      algarve:
        'No Algarve, a Ria Formosa e Castro Marim concentram flamingos, colhereiros e o galeirão-de-crista.',
      acores:
        'Nos Açores, o cagarro nidifica nas falésias e regressa ao mar em outubro — as luzes fortes desorientam as crias.',
      madeira:
        'Na Madeira, a freira-da-madeira nidifica nas cumeadas e é uma das aves marinhas mais ameaçadas da Europa.',
    },
  },
  gastronomia: {
    lens:
      'A cozinha portuguesa nasceu do que a terra e a maré davam: cada técnica — assar, cataplanar, escabechar — guarda uma rota de comércio.',
    angles: {
      norte:
        'No Norte, o sarrabulho e as papas de Ponte de Lima, o cozido à portuguesa transmontano e os vinhos verdes definem uma mesa de partilha e frio.',
      centro:
        'No Centro, o leitão da Bairrada, a chanfana e os ovos moles de Aveiro cruzam mar, serra e doçaria conventual.',
      lisboa:
        'Em Lisboa, a sardinha assada, as amêijoas à Bulhão Pato e o pastel de nata contam uma cidade de estuário e de império.',
      alentejo:
        'No Alentejo, o porco de raça alentejana, a açorda e o gaspacho mostram uma cozinha de pão, ervas e economia.',
      algarve:
        'No Algarve, a cataplana de marisco, as conquilhas e os doces de amêndoa e figo revelam a herança árabe e mediterrânica.',
      acores:
        'Nos Açores, o cozido das Furnas cozinha em calor geotérmico e o queijo São Jorge é a assinatura das pastagens atlânticas.',
      madeira:
        'Na Madeira, a espetada em pau de louro, o bolo do caco e o peixe-espada-preto com banana marcam a cozinha da ilha.',
    },
  },
  'cultura-maritima': {
    lens:
      'Antes das estradas havia o mar: as artes de pesca, os barcos e as festas do mar são o alfabeto das comunidades costeiras.',
    angles: {
      norte:
        'No Norte, as siglas poveiras, as rendas de bilros de Vila do Conde e a arte xávega da Apúlia mantêm um vocabulário de mar próprio.',
      centro:
        'No Centro, os moliceiros da Ria de Aveiro, a arte xávega da Praia de Mira e os tratores da Nazaré são pesca ainda em atividade.',
      lisboa:
        'Em Lisboa, as fragatas e varinos do Tejo, os cais de Cacilhas e as procissões de Nossa Senhora dos Navegantes ligam as duas margens.',
      alentejo:
        'No Alentejo, Sines e Vila Nova de Milfontes vivem entre porto industrial e pesca artesanal de arriba.',
      algarve:
        'No Algarve, a memória das armações de atum, os esteiros da Fuseta e a apanha de bivalves definem o sotavento.',
      acores:
        'Nos Açores, as Lajes do Pico e a Horta transformaram a baleação em ciência, museus e observação regulada.',
      madeira:
        'Na Madeira, Câmara de Lobos guarda os barcos pintados e a pesca de profundidade do peixe-espada-preto.',
    },
  },
  infraestrutura: {
    lens:
      'Passadiços, ecovias e barragens tornaram acessível uma paisagem que antes só se via de longe — e mudaram a economia de vales inteiros.',
    angles: {
      norte:
        'No Norte, os Passadiços do Paiva e a ponte 516 Arouca abriram um desfiladeiro que não tinha acesso pedonal.',
      centro:
        'No Centro, a Ecopista do Dão e os passadiços do Mondego reconverteram linha férrea e margem de rio em percurso contínuo.',
      lisboa:
        'Em Lisboa, as ecovias do Tejo e da Costa da Caparica ligam frentes ribeirinhas a praia e sapal sem sair de trilho.',
      alentejo:
        'No Alentejo, o Alqueva criou o maior lago artificial da Europa e com ele náutica, pesca e céu escuro.',
      algarve:
        'No Algarve, a Ecovia do Litoral e os passadiços da Ria Formosa atravessam sapal e dunas em estrutura suspensa.',
      acores:
        'Nos Açores, canadas, miradouros e piscinas naturais de lava são a infraestrutura discreta que estrutura cada ilha.',
      madeira:
        'Na Madeira, as levadas são engenharia hidráulica do séc. XVI transformada em rede pedestre de centenas de quilómetros.',
    },
  },
  economia: {
    lens:
      'Nos ofícios e mercados vê-se a economia real de cada região: quem produz, com que matéria-prima e para que mercado.',
    angles: {
      norte:
        'No Norte, a filigrana de Gondomar, a olaria de Barcelos, o Mercado do Bolhão e as quintas do Douro sustentam uma economia de exportação antiga.',
      centro:
        'No Centro, os teares de burel em Manteigas, o barro negro de Molelos e a porcelana da Vista Alegre provam que a inovação vive do respeito pela tradição.',
      lisboa:
        'Em Lisboa, a azulejaria, os mercados de bairro e a doçaria conventual mantiveram-se como economia urbana viva.',
      alentejo:
        'No Alentejo, a cortiça de Coruche e Ponte de Sor, as mantas de Reguengos e o queijo de Serpa DOP estruturam o interior.',
      algarve:
        'No Algarve, o sal marinho de Castro Marim e Tavira, o medronho da serra e a cestaria de palma resistem à monocultura turística.',
      acores:
        'Nos Açores, o queijo São Jorge, o chá da Gorreana — o mais antigo da Europa — e o ananás em estufa são a base agrícola.',
      madeira:
        'Na Madeira, o bordado, o vime da Camacha e o Vinho Madeira mantêm certificação e mercado internacional.',
    },
  },
  prehistoria: {
    lens:
      'Portugal tem uma das maiores concentrações de megalitismo e arte rupestre da Europa — e alguns dos céus mais escuros.',
    angles: {
      norte:
        'No Norte, as gravuras do Vale do Côa, Património Mundial, e as citânias de Briteiros e Sanfins abrem dez mil anos de ocupação.',
      centro:
        'No Centro, as antas da Beira e o planalto da Serra da Estrela juntam megalitismo a céu escuro de altitude.',
      lisboa:
        'Em Lisboa, as necrópoles do vale do Tejo, o complexo de Alcalar-Tejo e os observatórios da Serra de Sintra e Arrábida.',
      alentejo:
        'No Alentejo, o Cromeleque dos Almendres, a Anta Grande do Zambujeiro e a reserva Dark Sky Alqueva são referência mundial.',
      algarve:
        'No Algarve, os menires de Vila do Bispo e o povoado de Alcalar mostram o megalitismo do sudoeste peninsular.',
      acores:
        'Nos Açores, a ausência de poluição luminosa e as caldeiras do Pico e Terceira fazem noites de observação excecionais.',
      madeira:
        'Na Madeira, o Pico do Arieiro acima do mar de nuvens dá uma das melhores janelas atlânticas para o céu de verão.',
    },
  },
  costa: {
    lens:
      '1200 km de costa com regimes muito diferentes: nortada e ondulação atlântica a norte, mar quente e laguna a sul.',
    angles: {
      norte:
        'No Norte, as praias de Moledo a Espinho têm água fria e nortada forte de tarde — a manhã é sempre mais calma.',
      centro:
        'No Centro, a Nazaré recebe as maiores ondas do mundo e as dunas de São Jacinto protegem a ria por trás.',
      lisboa:
        'Em Lisboa, o Guincho, a Reserva Mundial de Surf da Ericeira e a Arriba Fóssil da Caparica cabem numa hora de carro.',
      alentejo:
        'No Alentejo, a Costa Vicentina é arriba alta e praias de acesso íngreme, com ventos que raramente descansam.',
      algarve:
        'No Algarve, arribas e grutas a ocidente e ilhas-barreira de água tépida a oriente, com 443 praias Bandeira Azul no país.',
      acores:
        'Nos Açores, o banho faz-se em piscinas naturais de lava e baías abrigadas, dependentes do estado do mar.',
      madeira:
        'Na Madeira, praias de calhau rolado e piscinas naturais; a areia dourada está nos 9 km de Porto Santo.',
    },
  },
  musica: {
    lens:
      'O património sonoro português é regional antes de ser nacional: cada território tem afinação, instrumento e ocasião próprios.',
    angles: {
      norte:
        'No Norte, os cantares ao desafio, os zés-pereiras e o cavaquinho minhoto vivem em romaria e não em palco.',
      centro:
        'No Centro, os bombos de Lavacolhos e o fado de Coimbra, cantado por vozes masculinas e guitarra própria, marcam duas tradições distintas.',
      lisboa:
        'Em Lisboa, o fado — Património Imaterial da UNESCO — nasceu em Alfama e Mouraria e ainda se ouve em casas pequenas.',
      alentejo:
        'No Alentejo, o Cante Alentejano, também UNESCO, canta-se a várias vozes sem instrumento, nos grupos corais do Baixo Alentejo.',
      algarve:
        'No Algarve, o corridinho e o acordeão marcam o baile de festa e as associações de folclore da serra.',
      acores:
        'Nos Açores, a chamarrita e as violas da terra de doze cordas acompanham festas do Espírito Santo.',
      madeira:
        'Na Madeira, o bailinho e o brinquinho, instrumento de bonecos e castanholas, são a assinatura sonora da ilha.',
    },
  },
  'rotas-culturais': {
    lens:
      'As rotas culturais permitem ler um território em sequência, seguindo um fio — devoção, água, vinho ou pedra.',
    angles: {
      norte:
        'No Norte, o Caminho Português de Santiago e a Rota do Românico ligam mosteiros e pontes medievais em vales fluviais.',
      centro:
        'No Centro, as Aldeias do Xisto e as Aldeias Históricas de Portugal formam duas redes de aldeias reabilitadas com percursos entre si.',
      lisboa:
        'Em Lisboa, as rotas do fado, dos conventos e das quintas de Sintra fazem-se em grande parte a pé ou de comboio urbano.',
      alentejo:
        'No Alentejo, a Rota do Cante, a Rota dos Vinhos e a Rota do Fresco cruzam aldeias brancas em distâncias curtas de carro.',
      algarve:
        'No Algarve, a Via Algarviana atravessa 300 km de serra de Alcoutim a Cabo de São Vicente, longe da linha de costa.',
      acores:
        'Nos Açores, a paisagem vinhateira do Pico, Património Mundial, é uma rota de currais de pedra até ao mar.',
      madeira:
        'Na Madeira, os Caminhos Reais e as levadas formam uma rede histórica de ligação entre freguesias.',
    },
  },
  inclusivo: {
    lens:
      'Turismo inclusivo é informação verificada: saber antes de chegar o que é acessível, com que apoio e em que época.',
    angles: {
      norte:
        'No Norte, o metro do Porto e a frente marítima de Matosinhos a Vila do Conde são das rotas urbanas mais acessíveis do país.',
      centro:
        'No Centro, museus e unidades industriais recentes são plenamente acessíveis, mas as aldeias históricas têm calçada irregular e declives acentuados.',
      lisboa:
        'Em Lisboa, quase todas as estações de metro têm elevador e várias praias da Caparica e de Cascais têm cadeira anfíbia e passadeira até à água.',
      alentejo:
        'No Alentejo, Évora tem circuitos adaptados no centro, mas sítios megalíticos e montes rurais mantêm acessos em terra batida.',
      algarve:
        'No Algarve, a rede de praias acessíveis é a maior do país, com cadeira anfíbia, passadeira e apoio na época balnear.',
      acores:
        'Nos Açores, as frentes de mar de Ponta Delgada, Angra e Horta são acessíveis; trilhos, fajãs e caldeiras não são adaptados.',
      madeira:
        'Na Madeira, o Funchal, os teleféricos e vários miradouros são acessíveis, ao contrário das levadas e veredas do maciço.',
    },
  },
};

/** 3 experiências sugeridas por combinação módulo × região (252 no total). */
export const guideExperiences: Record<string, Record<string, GuideExperience[]>> = {
  biodiversidade: {
    norte: [
      { title: 'Poças de maré em Vila do Conde e Labruge', desc: 'Desça ao intertidal duas horas antes da baixa-mar: anémonas, ouriços e caranguejos-verdes ficam à vista sem qualquer equipamento.' },
      { title: 'Aquário e centro de ciência de Matosinhos', desc: 'O Sea Life e o Parque da Cidade explicam a comunidade do litoral norte antes de a procurar nas rochas.' },
      { title: 'Foz do Minho em época de migração', desc: 'Entre março e junho a lampreia e o sável sobem o rio; os pescadores de Caminha explicam a arte da lampreia melhor do que qualquer painel.' },
    ],
    centro: [
      { title: 'Passeio de barco pelos canais da Ria de Aveiro', desc: 'Saia de Torreira ou da Murtosa ao início da manhã: o berçário lagunar mostra garças, colhereiros e viveiros de bivalves em atividade.' },
      { title: 'Reserva de São Jacinto', desc: 'Percurso plano entre dunas e lagoas com observatórios; leve binóculos e vá logo à abertura para ver mais aves.' },
      { title: 'Lota da Nazaré e canhão submarino', desc: 'A descarga do peixe explica em cinco minutos que espécies vivem no desfiladeiro submarino ao largo da praia.' },
    ],
    lisboa: [
      { title: 'Observação de roazes na Arrábida', desc: 'Saídas com biólogo a partir de Setúbal e Sesimbra dentro do Parque Marinho Luiz Saldanha, protegido desde 1998.' },
      { title: 'Estuário do Tejo no Alcochete e Vila Franca', desc: 'Os observatórios do Tejo recebem flamingos e limícolas por milhares — melhor na maré cheia, quando as aves se concentram.' },
      { title: 'Oceanário e Ciência Viva do Tejo', desc: 'A galeria do Atlântico permite identificar as espécies do estuário e da Arrábida antes de as ver no campo.' },
    ],
    alentejo: [
      { title: 'Roazes do Sado a partir de Setúbal ou Carrasqueira', desc: 'A população residente do Sado é uma das poucas da Europa; os operadores licenciados mantêm distância e nunca perseguem os animais.' },
      { title: 'Percebes e cracas na Costa Vicentina', desc: 'Nas arribas de Almograve e Zambujeira observa-se a apanha licenciada; a colheita sem licença é proibida.' },
      { title: 'Ribeira de Odeceixe e sapal de Alvor a Milfontes', desc: 'As foz de ribeira concentram peixes juvenis e aves pescadoras; visite ao início da manhã, com maré a vazar.' },
    ],
    algarve: [
      { title: 'Ria Formosa de barco solar a partir de Faro', desc: 'Percurso silencioso entre ilhas-barreira, com paragens em bancos de ostras e zonas de cavalo-marinho.' },
      { title: 'Passadiços e centro de educação ambiental de Marim', desc: 'O percurso de 3 km em Olhão junta salinas, moinho de maré e viveiros — o melhor resumo do sistema lagunar.' },
      { title: 'Sapal de Castro Marim ao nascer do sol', desc: 'Flamingos e colhereiros alimentam-se nas salinas; a luz da primeira hora é também a melhor para fotografia.' },
    ],
    acores: [
      { title: 'Observação de cetáceos com vigia em terra', desc: 'Nos operadores de Ponta Delgada, Lajes do Pico e Horta é o vigia em terra que localiza os animais — método local e menos invasivo.' },
      { title: 'Ilhéu de Vila Franca do Campo', desc: 'Cratera submersa com acesso limitado por dia: reserve com antecedência e leve máscara e tubo.' },
      { title: 'Museu dos Baleeiros nas Lajes do Pico', desc: 'Explica a passagem da caça à observação científica, e é a melhor introdução aos cachalotes do canal.' },
    ],
    madeira: [
      { title: 'Reserva do Garajau', desc: 'Mergulho ou snorkel numa das primeiras reservas marinhas totalmente protegidas da Europa, com meros de grande porte.' },
      { title: 'Saída às Desertas', desc: 'Passeio de dia inteiro a partir do Funchal ou Caniçal, onde vive a foca-monge; a aproximação é regulada.' },
      { title: 'Aquário da Madeira em Porto Moniz', desc: 'Instalado no Forte de São João Baptista, mostra as espécies dos fundos rochosos da ilha antes de as ver nas piscinas naturais.' },
    ],
  },
  flora: {
    norte: [
      { title: 'Mata de Albergaria no Gerês', desc: 'Carvalho-alvarinho, azevinho e teixo em floresta atlântica madura; circulação limitada em certos troços, confirme na porta do parque.' },
      { title: 'Jardim Botânico do Porto', desc: 'As coleções e o arboreto permitem identificar num par de horas espécies que na serra exigem dias.' },
      { title: 'Turfeiras e brenhas do Alvão na primavera', desc: 'Entre abril e junho a floração das urzes e do lírio-do-gerês transforma os planaltos húmidos.' },
    ],
    centro: [
      { title: 'Planalto da Torre acima dos 1500 m', desc: 'Zimbro-rasteiro, cervum e endemismos de altitude num percurso curto a partir da estrada da Torre.' },
      { title: 'Mata do Buçaco', desc: 'Uma das mais antigas matas protegidas da Europa, com cedros e sequoias plantados por monges carmelitas.' },
      { title: 'Aldeias do Xisto na floração dos medronheiros', desc: 'Entre outubro e dezembro os vales da Lousã e do Açor mudam de cor e cheiro — época de medronho e castanha.' },
    ],
    lisboa: [
      { title: 'Parque da Pena e Convento dos Capuchos', desc: 'A serra de Sintra cruza fetos atlânticos com mata exótica do séc. XIX; os Capuchos mostram a floresta húmida original.' },
      { title: 'Mata do Solitário na Arrábida', desc: 'Carrasco, aroeira e medronheiro em maquis mediterrânico — visita condicionada, marque no parque natural.' },
      { title: 'Jardim Botânico da Ajuda e Estufa Fria', desc: 'Os dois jardins históricos de Lisboa explicam a introdução de espécies vindas das rotas atlânticas.' },
    ],
    alentejo: [
      { title: 'Montado de sobro em Coruche ou Grândola', desc: 'Peça uma visita em época de descortiçamento (maio a agosto) para ver a extração sem danificar a árvore.' },
      { title: 'Orquídeas do Barrocal alentejano em abril', desc: 'As encostas calcárias de Estremoz a Vila Viçosa dão dezenas de orquídeas silvestres numa janela de três semanas.' },
      { title: 'Herdade com percurso botânico guiado', desc: 'No Alentejo interior várias herdades têm trilhos interpretados com esteva, rosmaninho e plantas aromáticas usadas na cozinha.' },
    ],
    algarve: [
      { title: 'Serra do Caldeirão na floração das esteiras', desc: 'De fevereiro a abril a serra enche-se de esteva e cistos; os percursos da Via Algarviana atravessam as melhores manchas.' },
      { title: 'Barrocal entre Loulé e Salir', desc: 'Alfarrobeira, figueira e amendoeira definem uma paisagem agrícola antiga; a amendoeira floresce em fevereiro.' },
      { title: 'Endemismos de arriba no Cabo de São Vicente', desc: 'O Sudoeste Alentejano e Costa Vicentina tem plantas que só existem neste cabo — não saia dos caminhos marcados.' },
    ],
    acores: [
      { title: 'Laurissilva das Flores', desc: 'Reserva da Biosfera com cedro-do-mato e fetos arbóreos; o trilho da Fajãzinha faz a transição da mata para a costa.' },
      { title: 'Caldeira do Faial', desc: 'Um percurso circular sobre o bordo da cratera, com uma das floras endémicas mais bem conservadas do arquipélago.' },
      { title: 'Jardim Botânico do Faial e Terra Nostra', desc: 'As coleções de conservação mostram as espécies endémicas ao lado das invasoras que hoje as ameaçam.' },
    ],
    madeira: [
      { title: 'Levada do Caldeirão Verde ou dos Balcões', desc: 'Percursos dentro da laurissilva, Património Mundial desde 1999; leve lanterna para os túneis.' },
      { title: 'Jardim Botânico da Madeira', desc: 'O setor de endemismos reúne dragoeiro, massaroco e urze-da-madeira num único percurso acessível.' },
      { title: 'Cumeadas do Areeiro e Pico Ruivo', desc: 'Urze-da-madeira e vegetação de altitude acima do mar de nuvens; parta antes das 8h para ter vista.' },
    ],
  },
  fauna: {
    norte: [
      { title: 'Garranos na Serra da Peneda', desc: 'Os cavalos vivem em liberdade nos planaltos de Castro Laboreiro e Lamas de Mouro; observe à distância, são animais selvagens.' },
      { title: 'Centro de interpretação do lobo-ibérico', desc: 'Em Montesinho e no Alvão os centros explicam o rasto, o território e a coexistência com o pastoreio.' },
      { title: 'Aves de rapina no Douro Internacional', desc: 'Grifos, abutre-do-Egito e águia-real nidificam nas escarpas; melhor de março a junho, a partir dos miradouros de Miranda.' },
    ],
    centro: [
      { title: 'Cabra-montês na Serra da Estrela', desc: 'Reintroduzida com sucesso, é visível ao amanhecer nas vertentes acima de Manteigas e do Vale do Zêzere.' },
      { title: 'Reserva da Malcata', desc: 'O antigo território do lince guarda hoje javali, corço e uma das melhores populações de aves de rapina do interior.' },
      { title: 'Paul de Arzila e Pateira de Fermentelos', desc: 'Zonas húmidas de água doce com garças, biguás e lontra, a poucos quilómetros de Coimbra e Aveiro.' },
    ],
    lisboa: [
      { title: 'Flamingos no estuário do Tejo', desc: 'Os observatórios de Alcochete, Ponta da Erva e Vila Franca recebem milhares de aves; leve telescópio ou junte-se a uma saída guiada.' },
      { title: 'Cegonhas e abelharucos na Lezíria', desc: 'A lezíria de Vila Franca é o sítio mais fácil do país para ver cegonha-branca em nidificação urbana e rural.' },
      { title: 'Morcegos e aves de rapina na Arrábida', desc: 'As escarpas da Arrábida têm falcão-peregrino e colónias de morcegos em grutas — visita apenas com guia autorizado.' },
    ],
    alentejo: [
      { title: 'Abetarda e sisão na planície de Castro Verde', desc: 'A Zona de Proteção Especial tem a maior população ibérica de abetarda; visita de carro pelos caminhos públicos, ao amanhecer.' },
      { title: 'Lince-ibérico no Vale do Guadiana', desc: 'O centro de Mértola explica o programa de reintrodução; o avistamento é raro, mas o rasto e as armadilhas fotográficas contam a história.' },
      { title: 'Aves de rapina no Guadiana e Mértola', desc: 'Grifo, águia-imperial e bufo-real usam as escarpas do rio; a época de maior atividade é fevereiro a maio.' },
    ],
    algarve: [
      { title: 'Sapal de Castro Marim e Vila Real', desc: 'Flamingos, perna-longa e colhereiros nas antigas salinas, com passadiços e observatórios sinalizados.' },
      { title: 'Ria Formosa em maré vazia', desc: 'A maré descoberta atrai limícolas por milhares; os passadiços de Marim e da Fuseta são os melhores pontos.' },
      { title: 'Camaleão-comum no sotavento', desc: 'Espécie protegida, ativa na primavera e verão nos pinhais de dunas entre Faro e Monte Gordo — observe sem tocar.' },
    ],
    acores: [
      { title: 'Cagarros ao anoitecer', desc: 'De agosto a outubro ouvem-se nas falésias; em outubro as crias saem ao mar e as campanhas locais recolhem as desorientadas por luzes.' },
      { title: 'Priolo na Serra da Tronqueira', desc: 'A ave mais ameaçada da Europa vive apenas neste vale de São Miguel; o centro ambiental do Priolo organiza saídas guiadas.' },
      { title: 'Aves marinhas no canal Faial–Pico', desc: 'A travessia de ferry é um transecto de observação gratuito: cagarros, garajaus e, com sorte, cetáceos.' },
    ],
    madeira: [
      { title: 'Freira-da-madeira nas cumeadas', desc: 'Nidifica apenas no maciço central; a visita noturna é feita exclusivamente com guias do Parque Natural.' },
      { title: 'Aves endémicas na laurissilva', desc: 'Bisbis, tentilhão e pombo-trocaz vêem-se nos Balcões e na Ribeiro Frio logo ao início da manhã.' },
      { title: 'Aves marinhas em Porto Santo e ilhéus', desc: 'As saídas de barco aos ilhéus mostram cagarra, roque-de-castro e a colónia de aves do Ilhéu de Cima.' },
    ],
  },
  gastronomia: {
    norte: [
      { title: 'Papas de sarrabulho em Ponte de Lima', desc: 'Prato de inverno servido em casas de comida familiares; peça acompanhado de rojões e vinho verde tinto da região.' },
      { title: 'Mercado do Bolhão ao início do dia', desc: 'Entre as 8h e as 10h vê-se o que está na época e é quem vende que explica como se cozinha.' },
      { title: 'Adega no Douro com prova de vinho e mesa', desc: 'As quintas de Pinhão e São João da Pesqueira servem cozinha de casa com os seus próprios vinhos — reserve com um dia de antecedência.' },
    ],
    centro: [
      { title: 'Leitão da Bairrada em Mealhada ou Anadia', desc: 'Peça meia dose com pimenta em grão e espumante da Bairrada; as casas antigas assam de manhã e ao meio-dia.' },
      { title: 'Ovos moles de Aveiro com certificação IGP', desc: 'As casas históricas do centro fazem-nos à vista; procure o selo IGP na embalagem.' },
      { title: 'Chanfana e queijo Serra da Estrela DOP', desc: 'Na Lousã e em Seia prove a chanfana em forno de lenha e compre o queijo diretamente na queijaria, entre novembro e março.' },
    ],
    lisboa: [
      { title: 'Sardinha assada em taberna de bairro', desc: 'De junho a setembro a sardinha está no ponto; escolha casas onde a grelha está à porta e o peixe vem da lota de manhã.' },
      { title: 'Amêijoas à Bulhão Pato e peixe da Costa', desc: 'Cascais, Paço de Arcos e Setúbal servem o marisco do dia; pergunte pelo peixe de lota antes de pedir a ementa.' },
      { title: 'Mercado da Ribeira e Campo de Ourique', desc: 'Os mercados municipais mantêm bancas de produtor ao lado das de restauração — vá cedo para ver o abastecimento.' },
    ],
    alentejo: [
      { title: 'Porco de raça alentejana em taberna de aldeia', desc: 'Peça secretos ou plumas com migas de espargos; as tabernas de Monsaraz, Alandroal e Serpa mantêm receita de casa.' },
      { title: 'Açorda e gaspacho no calor', desc: 'Duas cozinhas de pão, coentros e poejo pensadas para o verão alentejano — prove nas tabernas de Beja e Moura.' },
      { title: 'Queijo de Serpa e Nisa DOP na queijaria', desc: 'Entre dezembro e maio, com leite cru de ovelha; a compra na origem inclui explicação do coalho de flor de cardo.' },
    ],
    algarve: [
      { title: 'Cataplana de marisco no sotavento', desc: 'Olhão, Fuseta e Tavira servem cataplana com o marisco da ria; peça-a para dois e sem pressa.' },
      { title: 'Conquilhas e ostras da Ria Formosa', desc: 'A apanha regulada garante bivalve de qualidade; prove nos restaurantes de cais em Olhão e na Ilha da Armona.' },
      { title: 'Doçaria de amêndoa e figo', desc: 'Dom Rodrigo, morgados e figos recheados mantêm herança árabe — compre em casas de fabrico próprio em Silves e Loulé.' },
    ],
    acores: [
      { title: 'Cozido das Furnas cozido em calor geotérmico', desc: 'As caldeiras da lagoa cozem as panelas cinco horas; reserve na véspera no restaurante e assista ao levantamento.' },
      { title: 'Queijo São Jorge DOP na cooperativa', desc: 'Visita à Uniqueijo em Beira, com prova de curas diferentes e explicação das pastagens de altitude.' },
      { title: 'Chá da Gorreana e ananás em estufa', desc: 'A fábrica mais antiga da Europa em atividade e as estufas de ananás de Fajã de Baixo, ambas com entrada livre.' },
    ],
    madeira: [
      { title: 'Espetada em pau de louro e bolo do caco', desc: 'Nas casas de Estreito de Câmara de Lobos a carne é temperada só com sal e alho e assada sobre lenha.' },
      { title: 'Peixe-espada-preto e lapas no Funchal', desc: 'Mercado dos Lavradores de manhã para ver o peixe, e almoço com lapas grelhadas e milho frito à beira-mar.' },
      { title: 'Prova de Vinho Madeira em adega histórica', desc: 'As adegas do Funchal explicam a estufagem e o canteiro; prove um verdelho ou malvasia com 10 anos.' },
    ],
  },
  'cultura-maritima': {
    norte: [
      { title: 'Siglas poveiras na Póvoa de Varzim', desc: 'O museu municipal decifra o alfabeto de marcas familiares usado pelos pescadores durante séculos.' },
      { title: 'Arte xávega na Apúlia', desc: 'A rede é largada da praia e recolhida com trator; chegue ao amanhecer para acompanhar a faina completa.' },
      { title: 'Rendas de bilros em Vila do Conde', desc: 'A escola de rendas mantém oficina aberta; as mestras explicam o ponto e vendem peças certificadas.' },
    ],
    centro: [
      { title: 'Passeio em moliceiro na Ria de Aveiro', desc: 'Os barcos pintados eram usados na colheita do moliço; hoje os passeios saem do Canal Central de meia em meia hora.' },
      { title: 'Arte xávega na Praia de Mira', desc: 'Companhas ainda ativas no verão; a Palheiro do Pescador explica a arquitetura de madeira das praias.' },
      { title: 'Tratores e lota da Nazaré', desc: 'A pesca com traineira e o peixe seco ao sol no Sítio contam duas economias no mesmo dia.' },
    ],
    lisboa: [
      { title: 'Varinos e fragatas no Tejo', desc: 'Os barcos tradicionais navegam em Alcochete, Sarilhos e Vila Franca; algumas associações fazem saídas com tripulação local.' },
      { title: 'Cais de Cacilhas e travessia de ferry', desc: 'A travessia é o mais barato passeio de rio de Lisboa e explica a relação diária entre as duas margens.' },
      { title: 'Procissão de Nossa Senhora dos Navegantes', desc: 'As festas de junho e julho em Cascais, Sesimbra e Trafaria levam as imagens ao mar em cortejo de embarcações.' },
    ],
    alentejo: [
      { title: 'Pesca artesanal na Zambujeira e Milfontes', desc: 'Pequenas embarcações trabalham entre arribas; a lota de Sines mostra a escala industrial ao lado.' },
      { title: 'Percebeiros da Costa Vicentina', desc: 'A apanha em arriba batida é das mais perigosas do país — assista da falésia, com distância e cuidado.' },
      { title: 'Museu do Mar e memória baleeira em Sines', desc: 'Explica o porto, a pesca do atum e a transformação industrial da costa alentejana.' },
    ],
    algarve: [
      { title: 'Memória das armações de atum em Tavira e Vila Real', desc: 'Os antigos edifícios da Companhia de Pescarias explicam o maior negócio do sotavento até aos anos 70.' },
      { title: 'Apanha de bivalves nos esteiros da Fuseta', desc: 'Com maré vazia, as mariscadoras licenciadas trabalham a pé nos bancos de areia — respeite as zonas interditas.' },
      { title: 'Museu Marítimo de Faro e cais de Olhão', desc: 'Modelos de embarcações e artes de pesca do Algarve, a cinco minutos das bancas de peixe.' },
    ],
    acores: [
      { title: 'Vigias de baleia nas Lajes e no Pico', desc: 'As torres de vigia usadas na baleação servem hoje a observação científica; algumas estão abertas a visita.' },
      { title: 'Museu da Baleia e fábrica de São Roque', desc: 'A antiga fábrica de óleo em São Roque do Pico é hoje museu industrial — o melhor testemunho da economia baleeira.' },
      { title: 'Marina da Horta e Peter Café Sport', desc: 'Séculos de travessia atlântica escritos nos painéis pintados pelos veleiros que ali param.' },
    ],
    madeira: [
      { title: 'Barcos pintados de Câmara de Lobos', desc: 'Os xavelhas são pintados à mão pelos pescadores; a pesca do peixe-espada-preto faz-se a mais de 800 m de profundidade.' },
      { title: 'Lota e Mercado dos Lavradores', desc: 'Ver o corte do espada-preto no mercado explica a pesca de profundidade melhor do que qualquer museu.' },
      { title: 'Museu da Baleia no Caniçal', desc: 'Reconverteu a memória baleeira em investigação de cetáceos, com museografia recente e muito clara.' },
    ],
  },
  infraestrutura: {
    norte: [
      { title: 'Passadiços do Paiva e ponte 516 Arouca', desc: '8,7 km lineares em desfiladeiro; combine com o shuttle de regresso e faça o percurso de Areinho para Espiunca, a favor do desnível.' },
      { title: 'Ecopista do Tâmega ou do Corgo', desc: 'Antigas linhas de via estreita convertidas em percurso plano — ideal para bicicleta com crianças.' },
      { title: 'Barragens do Douro e eclusas', desc: 'A eclusa do Carrapatelo tem 35 m de desnível; os cruzeiros do Douro atravessam-na em cerca de 20 minutos.' },
    ],
    centro: [
      { title: 'Ecopista do Dão', desc: '49 km entre Viseu e Santa Comba Dão sobre a antiga linha férrea, com estações reconvertidas em apoios.' },
      { title: 'Passadiços do Mondego', desc: '12 km entre Góis e a Ponte da Mucela, em plataforma suspensa sobre o rio.' },
      { title: 'Barragens da Serra da Estrela', desc: 'Lagoa Comprida e Vale do Rossim mostram engenharia hidráulica de altitude com acesso rodoviário direto.' },
    ],
    lisboa: [
      { title: 'Ecovia do Tejo entre Belém e Algés', desc: 'Percurso plano e contínuo à beira-rio, com ligação a comboio urbano nas duas pontas.' },
      { title: 'Passadiços da Costa da Caparica e Arriba Fóssil', desc: 'Estruturas sobre duna que protegem a vegetação e dão acesso a praias sem pisar a arriba.' },
      { title: 'Aqueduto das Águas Livres', desc: 'Visita ao arco maior em Campolide e ao Reservatório da Mãe d’Água: a infraestrutura que fez crescer Lisboa.' },
    ],
    alentejo: [
      { title: 'Alqueva e o maior lago artificial da Europa', desc: 'Náutica, pesca e céu escuro num plano de água de 250 km²; os cais de Amieira e Monsaraz são o melhor ponto de entrada.' },
      { title: 'Ecopista do Alentejo e antigas linhas', desc: 'Os troços de Évora a Mora e do Ramal de Reguengos oferecem percursos planos entre montado e olival.' },
      { title: 'Barragens e açudes do Guadiana', desc: 'Pulo do Lobo e as azenhas de Mértola mostram como a água estruturou a ocupação do vale.' },
    ],
    algarve: [
      { title: 'Ecovia do Litoral', desc: '214 km de Vila Real de Santo António ao Cabo de São Vicente; os troços do sotavento são planos e bem sinalizados.' },
      { title: 'Passadiços da Ria Formosa em Marim e Praia de Faro', desc: 'Plataformas sobre sapal, com painéis de interpretação e acesso adaptado em vários troços.' },
      { title: 'Passadiço e ponte de Alcoutim ao Guadiana', desc: 'O troço da Via Algarviana junto ao rio combina paisagem fluvial com o único slide transfronteiriço da Europa.' },
    ],
    acores: [
      { title: 'Piscinas naturais de lava', desc: 'Porto Moniz nos Açores tem equivalentes em Biscoitos, Mosteiros e Ferraria — entre apenas com bandeira e mar calmo.' },
      { title: 'Canadas e miradouros de São Miguel', desc: 'A rede de estradas florestais e miradouros do Cerrado das Freiras e Vista do Rei estrutura toda a visita à ilha.' },
      { title: 'Central geotérmica e Furnas', desc: 'A Ribeira Grande produz mais de 40% da eletricidade de São Miguel; as caldeiras das Furnas explicam a fonte.' },
    ],
    madeira: [
      { title: 'Levadas como engenharia hidráulica', desc: 'Mais de 2000 km de canais do séc. XVI em diante; a Levada do Norte e a dos Tornos mostram a solução de rega da ilha.' },
      { title: 'Teleféricos do Funchal e das Achadas', desc: 'Ligam a baixa ao Monte e a Fajã dos Padres — infraestrutura de transporte que resolve encostas impossíveis.' },
      { title: 'Estradas e túneis do maciço', desc: 'A ligação Funchal–Porto Moniz mostra como a engenharia rodoviária mudou a mobilidade da ilha em 20 anos.' },
    ],
  },
  economia: {
    norte: [
      { title: 'Filigrana em Gondomar', desc: 'Oficinas abertas onde o fio de ouro é soldado à mão; peça a demonstração da técnica antes de comprar peça certificada.' },
      { title: 'Olaria de Barcelos e feira de quinta-feira', desc: 'A figurada de Barcelos vende-se na maior feira semanal do país, ao lado de cestaria e ferramenta agrícola.' },
      { title: 'Quinta do Douro em vindima', desc: 'De setembro a outubro várias quintas deixam participar na apanha e na pisa em lagar de granito.' },
    ],
    centro: [
      { title: 'Imersão no design do burel em Manteigas', desc: 'A Burel Factory faz visitas guiadas aos teares ancestrais em funcionamento e workshops de tecelagem com lã da ovelha bordaleira.' },
      { title: 'Mestre oleiro em Molelos, Tondela', desc: 'Aprenda o brunido com pedra e observe a cozedura em atmosfera redutora, que torna o barro negro sem tintas ou pigmentos.' },
      { title: 'Pintura em porcelana na Vista Alegre, Ílhavo', desc: 'Museu e sessão prática de pintura manual com mestres pintores; leva a peça e a história da manufatura consigo.' },
    ],
    lisboa: [
      { title: 'Azulejaria e olaria em Lisboa', desc: 'O Museu Nacional do Azulejo explica cinco séculos de produção; algumas fábricas da cidade mantêm pintura à mão.' },
      { title: 'Mercados de bairro e doçaria conventual', desc: 'Campo de Ourique, Arroios e Ribeira mantêm produtor local; as pastelarias históricas guardam receitas de convento.' },
      { title: 'Cooperativas de vinho de Colares e Bucelas', desc: 'Duas denominações pequenas e antigas à porta de Lisboa, com visita e prova em adega.' },
    ],
    alentejo: [
      { title: 'Cortiça em Coruche ou Ponte de Sor', desc: 'Portugal produz metade da cortiça mundial; as unidades explicam a extração de nove em nove anos e a transformação.' },
      { title: 'Mantas de Reguengos e tapetes de Arraiolos', desc: 'Oficinas com tear manual, ponto de Arraiolos e explicação da tinturaria tradicional.' },
      { title: 'Queijarias de Serpa e Nisa', desc: 'Visita em época de fabrico, entre dezembro e maio, com prova de curas e explicação do coalho vegetal.' },
    ],
    algarve: [
      { title: 'Salinas artesanais de Castro Marim e Tavira', desc: 'A colheita de flor de sal faz-se de junho a setembro, à mão e ao amanhecer; várias salinas recebem visita.' },
      { title: 'Destilarias de medronho na serra', desc: 'Em Monchique e Alcoutim as destilarias licenciadas explicam a fermentação do medronho e a dupla destilação.' },
      { title: 'Cestaria de palma e empreita', desc: 'Nas aldeias do Barrocal a empreita de palma-anã continua a ser feita à mão, sobretudo por mulheres da serra.' },
    ],
    acores: [
      { title: 'Cooperativa de queijo São Jorge', desc: 'A Uniqueijo mostra o percurso do leite de pastagem à cura em câmara; prove curas de 4, 12 e 24 meses.' },
      { title: 'Fábrica de chá da Gorreana', desc: 'A mais antiga da Europa em atividade, com máquinas do séc. XIX e entrada livre na linha de produção.' },
      { title: 'Ananás em estufa em Fajã de Baixo', desc: 'Duas anos de ciclo por fruto; as estufas de vidro explicam o método único de fumo para induzir floração.' },
    ],
    madeira: [
      { title: 'Bordado Madeira com selo IBTAM', desc: 'As casas certificadas mostram o picotado, o desenho e o controlo de qualidade que dá o selo de garantia.' },
      { title: 'Vimeiros da Camacha', desc: 'A curtidura do vime e a cestaria mantêm oficinas abertas; o centro da Camacha vende produção local.' },
      { title: 'Adegas de Vinho Madeira no Funchal', desc: 'Blandy’s e Barbeito explicam estufagem, canteiro e vinhos com décadas de envelhecimento.' },
    ],
  },
  prehistoria: {
    norte: [
      { title: 'Gravuras do Vale do Côa com marcação', desc: 'Visita obrigatoriamente guiada em jipe a Canada do Inferno ou Penascosa; ao fim do dia a luz rasante revela as gravuras.' },
      { title: 'Citânia de Briteiros e Sanfins', desc: 'Povoados castrejos com casas circulares e muralhas — o Museu da Cultura Castreja contextualiza a visita.' },
      { title: 'Gravuras de Mazouco e escarpas do Douro', desc: 'Arte paleolítica ao ar livre junto ao rio, num dos troços mais isolados do Douro Internacional.' },
    ],
    centro: [
      { title: 'Antas e dólmens da Beira', desc: 'Os monumentos megalíticos de Pera do Moço e Fiais da Beira ficam em campo aberto e sem bilheteira — leve coordenadas.' },
      { title: 'Céu escuro na Serra da Estrela', desc: 'O planalho acima dos 1500 m tem dos céus mais limpos do continente; escolha lua nova e leve lanterna vermelha.' },
      { title: 'Dark Sky Aldeias do Xisto', desc: 'Em Pampilhosa da Serra e Aldeia das Dez a observação astronómica é programa oficial, com operadores certificados.' },
    ],
    lisboa: [
      { title: 'Grutas do Almonda e necrópoles do Tejo', desc: 'O vale do Tejo tem ocupação paleolítica contínua; os museus de Torres Novas e Alenquer guardam os achados.' },
      { title: 'Observatório e planetário de Lisboa', desc: 'O Planetário Calouste Gulbenkian e o Observatório Astronómico da Ajuda preparam qualquer noite de campo.' },
      { title: 'Serra da Arrábida para observação noturna', desc: 'A vertente sul, virada ao mar e longe de luzes, é a janela de céu escuro mais próxima da capital.' },
    ],
    alentejo: [
      { title: 'Cromeleque dos Almendres e Anta do Zambujeiro', desc: 'O maior conjunto megalítico da Península, com cerca de 6000 a.C., a 15 km de Évora; visite ao amanhecer.' },
      { title: 'Dark Sky Alqueva', desc: 'Primeira reserva Starlight do mundo: operadores licenciados fornecem telescópio e leitura do céu em português.' },
      { title: 'Povoado dos Perdigões e museu de Reguengos', desc: 'Escavações em curso num dos maiores recintos pré-históricos da Europa, com centro interpretativo.' },
    ],
    algarve: [
      { title: 'Menires de Vila do Bispo e Cabo de São Vicente', desc: 'Dezenas de menires isolados no planalto do sudoeste — o percurso do Menir da Cruz do Pinheiro faz-se a pé.' },
      { title: 'Povoado de Alcalar em Portimão', desc: 'Monumentos funerários com corredor, museografia recente e percurso acessível.' },
      { title: 'Céu escuro na serra do Caldeirão', desc: 'Longe do litoral iluminado, Alcoutim e Cachopo têm noites de observação com muito pouca poluição luminosa.' },
    ],
    acores: [
      { title: 'Observação em Santa Bárbara e caldeiras da Terceira', desc: 'A ausência de luz artificial no interior das ilhas dá uma Via Láctea nítida em noites limpas de verão.' },
      { title: 'Grutas vulcânicas do Algar do Carvão', desc: 'Chaminé vulcânica visitável, com lago interior — geologia recente que explica a formação das ilhas.' },
      { title: 'Observatório e miradouros do Pico', desc: 'O ponto mais alto de Portugal serve de plataforma de observação acima da camada de nuvens.' },
    ],
    madeira: [
      { title: 'Pico do Arieiro à noite', desc: 'Acima do mar de nuvens e com estrada asfaltada até ao topo: a observação astronómica mais acessível do país.' },
      { title: 'Fósseis e vulcanismo em São Vicente', desc: 'As grutas e o Centro do Vulcanismo explicam a origem da ilha há 6 milhões de anos.' },
      { title: 'Porto Santo para céu limpo', desc: 'A ilha tem menos nebulosidade e pouca iluminação — as praias a norte são o melhor ponto de observação.' },
    ],
  },
  costa: {
    norte: [
      { title: 'Praias de Moledo a Vila Praia de Âncora', desc: 'Água fria e nortada à tarde: escolha a manhã e um abrigo de esporão para o vento.' },
      { title: 'Surf em Matosinhos e Espinho', desc: 'Escolas certificadas com ondas moderadas e apoio na areia durante todo o ano.' },
      { title: 'Passeio de arriba entre Espinho e Esmoriz', desc: 'Passadiços sobre duna com interpretação da erosão costeira e da defesa por esporões.' },
    ],
    centro: [
      { title: 'Nazaré e o Canhão Submarino', desc: 'No inverno o Praia do Norte recebe as maiores ondas do mundo; observe do Forte de São Miguel Arcanjo.' },
      { title: 'Dunas de São Jacinto e Torreira', desc: 'Cordão dunar protegido entre ria e mar, com percursos marcados que evitam pisar a vegetação.' },
      { title: 'Surf e bodyboard na Figueira da Foz', desc: 'O Cabedelo tem ondulação constante e escolas com aula para iniciantes durante todo o ano.' },
    ],
    lisboa: [
      { title: 'Reserva Mundial de Surf da Ericeira', desc: 'Sete picos protegidos entre Ribeira d’Ilhas e São Lourenço; escolha escola licenciada para o nível certo.' },
      { title: 'Guincho e Cabo Raso', desc: 'Vento forte e correntes: excelente para kite e windsurf, exigente para banhos — leia sempre a bandeira.' },
      { title: 'Arriba Fóssil da Caparica', desc: 'Paisagem protegida com miradouros e o elevador panorâmico da Praia da Rainha; as praias sul são as mais tranquilas.' },
    ],
    alentejo: [
      { title: 'Praias de arriba em Almograve e Zambujeira', desc: 'Acessos por escada e vento constante; a Praia do Carvalhal e a de Odeceixe são as mais abrigadas.' },
      { title: 'Rota Vicentina — Trilho dos Pescadores', desc: 'Etapas sobre arriba com acesso a praias sem estrada; leve água, não há apoio no percurso.' },
      { title: 'Ilha do Pessegueiro e Porto Covo', desc: 'Fortaleza no ilhéu, mar transparente e passeio de barco curto a partir do porto de pesca.' },
    ],
    algarve: [
      { title: 'Grutas de Benagil e Marinha', desc: 'Vá de caiaque ou barco pequeno ao início da manhã; a entrada a nado é proibida e perigosa.' },
      { title: 'Ilhas-barreira da Ria Formosa', desc: 'Deserta, Armona e Culatra têm água tépida e ferry regular a partir de Faro e Olhão.' },
      { title: 'Costa Vicentina do barlavento', desc: 'Arrifana e Bordeira têm ondulação forte e escolas de surf; o vento aumenta sempre depois do meio-dia.' },
    ],
    acores: [
      { title: 'Piscinas naturais de lava', desc: 'Biscoitos, Mosteiros e Ferraria só devem ser usadas com mar calmo e bandeira — o mar cruzado é o principal risco.' },
      { title: 'Praia de areia negra em Ribeira Quente', desc: 'Uma das poucas praias de areia dos Açores, abrigada e com apoio balnear no verão.' },
      { title: 'Mergulho no Princesa Alice e canais', desc: 'Saídas técnicas para mergulhadores certificados, com montes submarinos e grande fauna pelágica.' },
    ],
    madeira: [
      { title: 'Piscinas naturais de Porto Moniz', desc: 'Formadas por lava, com apoio balnear e acesso adaptado na estrutura principal.' },
      { title: 'Praias de calhau no Seixal e Ponta do Sol', desc: 'Areia preta e calhau rolado; o Seixal tem piscinas naturais e mar mais abrigado a norte.' },
      { title: 'Nove quilómetros de areia em Porto Santo', desc: 'A maior praia de areia dourada do arquipélago, com ferry diário do Funchal e mar calmo no verão.' },
    ],
  },
  musica: {
    norte: [
      { title: 'Cantares ao desafio em romaria do Minho', desc: 'Nas festas de agosto os cantadores improvisam quadras à vez — a música tem função social, não é atuação.' },
      { title: 'Zés-pereiras e bombos', desc: 'Grupos de bombos abrem as romarias de Braga a Amarante; o som ouve-se antes de se ver o cortejo.' },
      { title: 'Oficina de cavaquinho minhoto', desc: 'Associações culturais de Braga e Guimarães dão sessões curtas para principiantes, com instrumento emprestado.' },
    ],
    centro: [
      { title: 'Bombos de Lavacolhos, Fundão', desc: 'Grupo centenário da Beira Baixa; toca nas festas locais e recebe visitas na sede.' },
      { title: 'Fado de Coimbra em casa pequena', desc: 'Cantado por vozes masculinas com guitarra de Coimbra; ouça em sala e não em jantar-espetáculo.' },
      { title: 'Adufe na Beira Baixa', desc: 'Em Idanha-a-Nova e Monsanto o adufe é tocado e construído por mulheres — há oficinas de construção e toque.' },
    ],
    lisboa: [
      { title: 'Fado em Alfama ou Mouraria', desc: 'Património Imaterial da UNESCO desde 2011; procure casas de fado vadio, onde canta quem aparece.' },
      { title: 'Museu do Fado', desc: 'Percurso sonoro pela história do género, com arquivo de gravações e guitarras históricas.' },
      { title: 'Marchas populares em junho', desc: 'Cada bairro ensaia meses para a noite de Santo António; os ensaios abertos são a melhor forma de ver o processo.' },
    ],
    alentejo: [
      { title: 'Cante Alentejano em sede de grupo coral', desc: 'Polifonia sem instrumentos, UNESCO desde 2014; em Serpa, Cuba e Beja os grupos ensaiam com porta aberta.' },
      { title: 'Casa do Cante em Serpa', desc: 'Centro de documentação e sala de ensaio dedicada ao cante, com sessões abertas ao público.' },
      { title: 'Festival de cante e moda alentejana', desc: 'Vários concelhos organizam encontros de grupos corais entre março e outubro — calendário nas juntas de freguesia.' },
    ],
    algarve: [
      { title: 'Corridinho em baile de associação', desc: 'Dançado com acordeão em ritmo rápido; as associações de Loulé, Alte e Querença mantêm bailes regulares.' },
      { title: 'Acordeão e cantares da serra', desc: 'Em Cachopo e Alcoutim os grupos etnográficos guardam repertório de trabalho e de festa.' },
      { title: 'Festas de verão no barlavento', desc: 'As festas de Silves, Monchique e Aljezur juntam corridinho, folclore e cantares populares.' },
    ],
    acores: [
      { title: 'Chamarrita em festa do Espírito Santo', desc: 'Dança de roda com viola da terra, tocada nos impérios entre maio e julho.' },
      { title: 'Viola da terra em oficina de construtor', desc: 'Instrumento de doze cordas, com construtores em São Miguel e na Terceira que recebem visitas.' },
      { title: 'Filarmónicas de ilha', desc: 'Quase todas as freguesias têm banda; os concertos de verão são o principal programa cultural local.' },
    ],
    madeira: [
      { title: 'Bailinho da Madeira em festa de freguesia', desc: 'Dançado com brinquinho e rajão, sobretudo no Carnaval e nas festas de verão.' },
      { title: 'Brinquinho e instrumentos tradicionais', desc: 'O instrumento de bonecos e castanholas é construído à mão; há oficinas na Camacha e em Santana.' },
      { title: 'Grupos de folclore na Camacha', desc: 'Berço do folclore madeirense, com atuações regulares e escola de dança tradicional.' },
    ],
  },
  'rotas-culturais': {
    norte: [
      { title: 'Rota do Românico', desc: '58 monumentos nos vales do Sousa, Douro e Tâmega; escolha três igrejas próximas em vez de tentar a rota inteira.' },
      { title: 'Caminho Português de Santiago', desc: 'A etapa Barcelos–Ponte de Lima faz-se em cinco horas e tem albergues e transporte de mochila.' },
      { title: 'Rota do Vinho do Porto', desc: 'Quintas com visita e prova entre Peso da Régua e Pinhão, com ligação por comboio da Linha do Douro.' },
    ],
    centro: [
      { title: 'Aldeias do Xisto — trilhos entre aldeias', desc: 'O percurso Talasnal–Casal Novo liga duas aldeias recuperadas em duas horas, com praias fluviais pelo caminho.' },
      { title: 'Aldeias Históricas de Portugal', desc: 'Doze aldeias muradas da Beira, de Piódão a Castelo Rodrigo; a rota de carro faz-se em três dias.' },
      { title: 'Rota dos Moinhos e da água', desc: 'Em Penacova e Góis os moinhos recuperados explicam a economia da água antes da eletricidade.' },
    ],
    lisboa: [
      { title: 'Rota do Fado em Alfama e Mouraria', desc: 'Percurso a pé por casas, museu e locais de memória do fado, feito em meia tarde.' },
      { title: 'Quintas e palácios de Sintra', desc: 'Pena, Monserrate e Quinta da Regaleira em comboio urbano e autocarro 434 — evite carro próprio.' },
      { title: 'Rota dos conventos e Mosteiros do Tejo', desc: 'Alcobaça, Batalha e Tomar em eixo direto de estrada, três Patrimónios Mundiais em um dia longo.' },
    ],
    alentejo: [
      { title: 'Rota do Cante', desc: 'Serpa, Cuba, Beja e Castro Verde ligadas por grupos corais e casas do cante; distâncias curtas de carro.' },
      { title: 'Rota dos Vinhos do Alentejo', desc: 'Adegas certificadas em Reguengos, Borba e Vidigueira, com prova e visita à vinha.' },
      { title: 'Rota do Fresco', desc: 'Pintura mural do séc. XVI em igrejas de Cabeço de Vide, Alter e Fronteira — visita com chave na junta de freguesia.' },
    ],
    algarve: [
      { title: 'Via Algarviana', desc: '300 km de Alcoutim ao Cabo de São Vicente; as etapas de Salir e Alte são as mais bem servidas de alojamento.' },
      { title: 'Rota das aldeias do Barrocal', desc: 'Querença, Alte e Salir ligadas por estrada de serra, com fontes, moinhos e igrejas manuelinas.' },
      { title: 'Rota do património islâmico', desc: 'Silves, Loulé e Faro guardam vestígios do al-Ândalus, com museus municipais que os interpretam.' },
    ],
    acores: [
      { title: 'Paisagem vinhateira do Pico', desc: 'Património Mundial: currais de pedra vulcânica até ao mar, com adegas visitáveis na Criação Velha.' },
      { title: 'Rota dos impérios do Espírito Santo', desc: 'Na Terceira e em São Miguel os impérios pintados marcam o calendário religioso de cada freguesia.' },
      { title: 'Rota baleeira do triângulo', desc: 'Lajes do Pico, São Roque e Horta ligadas por ferry, com museus que contam a mesma história em três escalas.' },
    ],
    madeira: [
      { title: 'Caminhos Reais do maciço', desc: 'Antigas ligações entre freguesias, hoje veredas marcadas; a vereda do Larano é das mais espetaculares.' },
      { title: 'Rota das levadas do norte', desc: 'Caldeirão Verde e Ribeiro Frio atravessam a laurissilva em percursos de meio dia.' },
      { title: 'Rota do Vinho Madeira e vinha do Estreito', desc: 'Vinha em socalcos no Estreito de Câmara de Lobos, com adegas e vindima em agosto e setembro.' },
    ],
  },
  inclusivo: {
    norte: [
      { title: 'Praias acessíveis de Matosinhos a Vila do Conde', desc: 'Passadeira até à água, cadeira anfíbia e apoio de nadador-salvador na época balnear — confirme no posto de praia.' },
      { title: 'Metro do Porto e frente ribeirinha', desc: 'Toda a rede tem elevador e piso tátil; a marginal do Douro dá um percurso plano até à Foz.' },
      { title: 'Ecopistas do Tâmega e do Corgo', desc: 'Antigas linhas férreas em plataforma contínua, sem degraus e com desnível mínimo.' },
    ],
    centro: [
      { title: 'Museus e centros de ciência acessíveis', desc: 'Museu Vista Alegre, Ciência Viva de Aveiro e Museu do Papel têm circuito completo sem degraus.' },
      { title: 'Passadiços do Mondego em troço plano', desc: 'O troço junto à Ponte da Mucela é o mais regular; os acessos de Góis têm estacionamento adaptado.' },
      { title: 'Aldeias históricas — planear a visita', desc: 'Piódão e Monsanto têm calçada irregular e declives: escolha os miradouros com estacionamento próximo e apoio.' },
    ],
    lisboa: [
      { title: 'Praias com cadeira anfíbia na Caparica e Cascais', desc: 'Várias praias têm passadeira, cadeira anfíbia e apoio de banho assistido entre junho e setembro.' },
      { title: 'Metro, elevadores e Belém', desc: 'Quase todas as estações têm elevador; a frente ribeirinha de Belém a Algés é plana e contínua.' },
      { title: 'Museus com apoio adaptado', desc: 'Gulbenkian, MAAT e Oceanário têm percursos acessíveis, visitas em LGP e material tátil por marcação.' },
    ],
    alentejo: [
      { title: 'Évora acessível no centro histórico', desc: 'O circuito Templo–Sé–Praça do Giraldo tem calçada regularizada; peça o mapa acessível no posto de turismo.' },
      { title: 'Alqueva e barcos com acesso', desc: 'Os cais de Amieira têm rampas e há embarcações com embarque adaptado por marcação.' },
      { title: 'Observação de céu escuro sem trilho', desc: 'As sessões Dark Sky fazem-se em plataformas com acesso de carro — não exigem caminhada.' },
    ],
    algarve: [
      { title: 'Rede de praias acessíveis do sotavento', desc: 'A maior concentração do país: passadeira, cadeira anfíbia e apoio balnear em praias de Faro a Monte Gordo.' },
      { title: 'Passadiços da Ria Formosa em Marim', desc: 'Plataforma contínua com painéis e miradouros, adequada a cadeira de rodas com acompanhante.' },
      { title: 'Ecovia do Litoral em troços planos', desc: 'Os segmentos de Tavira a Cabanas e da Praia de Faro são planos e pavimentados.' },
    ],
    acores: [
      { title: 'Frentes de mar acessíveis', desc: 'Ponta Delgada, Angra e Horta têm marginais planas, com miradouros e piscinas com rampa.' },
      { title: 'Furnas e caldeiras com acesso de carro', desc: 'O percurso das caldeiras e o Terra Nostra permitem ver a atividade geotérmica sem trilho.' },
      { title: 'Observação de cetáceos com embarque assistido', desc: 'Alguns operadores têm barco com acesso facilitado — confirme sempre por telefone na véspera.' },
    ],
    madeira: [
      { title: 'Funchal e teleféricos', desc: 'A baixa, a marginal e o teleférico do Monte formam um circuito acessível com vista de encosta.' },
      { title: 'Miradouros com acesso adaptado', desc: 'Cabo Girão tem skywalk com piso regular e estacionamento adaptado, sem necessidade de caminhada.' },
      { title: 'Piscinas naturais com estrutura', desc: 'Porto Moniz tem acesso adaptado ao complexo principal, com vestiários e rampa.' },
    ],
  },
};

export function getGuideRegion(id: string): GuideRegion | undefined {
  return guideRegions.find((r) => r.id === id);
}

/** Experiências para uma combinação; vazio se a combinação não existir. */
export function getGuideExperiences(module: string, region: string): GuideExperience[] {
  return guideExperiences[module]?.[region] ?? [];
}

/** Ângulo regional do módulo, com a lente como recurso. */
export function getGuideAngle(module: string, region: string): string {
  const m = guideModuleLenses[module];
  return m?.angles[region] ?? m?.lens ?? '';
}
