"""
Script de Seed para Património Vivo de Portugal
Contém TODOS os dados do documento de património cultural português
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import uuid
import os
from dotenv import load_dotenv

load_dotenv()

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]

# Coordenadas aproximadas para regiões de Portugal
REGION_COORDS = {
    "norte": {"lat": 41.15, "lng": -8.61},
    "centro": {"lat": 40.21, "lng": -8.43},
    "lisboa": {"lat": 38.72, "lng": -9.14},
    "alentejo": {"lat": 38.57, "lng": -7.91},
    "algarve": {"lat": 37.02, "lng": -7.93},
    "acores": {"lat": 37.74, "lng": -25.66},
    "madeira": {"lat": 32.65, "lng": -16.91}
}

def get_coords(region: str, variation: float = 0.5):
    """Get coordinates with slight variation"""
    import random
    base = REGION_COORDS.get(region, {"lat": 39.5, "lng": -8.0})
    return {
        "lat": base["lat"] + random.uniform(-variation, variation),
        "lng": base["lng"] + random.uniform(-variation, variation)
    }

# ========================
# LENDAS E MITOS
# ========================
LENDAS = [
    {"name": "O Galo de Barcelos", "description": "Símbolo nacional de justiça e sorte. Conta a lenda que um peregrino galego foi acusado injustamente de um crime e condenado à forca. Pediu para ser levado perante o juiz que estava a jantar e disse que o galo assado que estava na mesa cantaria para provar a sua inocência. O galo cantou e o peregrino foi libertado.", "region": "norte", "location": {"lat": 41.5314, "lng": -8.6152}, "address": "Barcelos"},
    {"name": "A Moura Encantada da Serra da Estrela", "description": "A princesa moura e o pastor. Reza a lenda que uma bela moura foi enfeitiçada e vive nas montanhas da Serra, aparecendo aos pastores nas noites de lua cheia. Guarda um tesouro em ouro e joias que só pode ser encontrado por quem tiver um coração puro.", "region": "centro", "location": {"lat": 40.3217, "lng": -7.6114}, "address": "Serra da Estrela"},
    {"name": "A Lenda das Sete Cidades", "description": "O amor proibido e as lagoas gémeas. Uma princesa de olhos verdes apaixonou-se por um pastor de olhos azuis. O rei proibiu o amor e os dois choraram tanto que as suas lágrimas formaram as duas lagoas - uma verde e outra azul - que ainda hoje se podem ver.", "region": "acores", "location": {"lat": 37.8410, "lng": -25.7870}, "address": "Sete Cidades, São Miguel, Açores"},
    {"name": "O Adamastor", "description": "O gigante do Cabo das Tormentas, imortalizado n'Os Lusíadas de Camões. Representa os perigos do mar desconhecido e a coragem dos navegadores portugueses que enfrentaram o medo do desconhecido para descobrir novos mundos.", "region": "lisboa", "location": {"lat": 38.7223, "lng": -9.1393}, "address": "Lisboa (Literatura épica)"},
    {"name": "A Dama Pé-de-Cabra", "description": "O demónio e o cavaleiro no Castelo de Almourol. D. Diego Lopes encontrou uma bela mulher nas margens do Tejo. Casaram, mas ela tinha um segredo - um pé de cabra escondido. Quando descoberto, ela desapareceu levando o filho.", "region": "centro", "location": {"lat": 39.4617, "lng": -8.3839}, "address": "Castelo de Almourol"},
    {"name": "A Lenda do Rei D. Sebastião", "description": "O 'Encoberto' que regressará num dia de nevoeiro. Após a batalha de Alcácer Quibir em 1578, o povo português nunca aceitou a morte do jovem rei. Acredita-se que ele voltará numa manhã de nevoeiro para salvar Portugal.", "region": "lisboa", "location": {"lat": 38.7223, "lng": -9.1393}, "address": "Mito nacional"},
    {"name": "A Lenda de Inês de Castro", "description": "Rainha depois de morta. O amor trágico entre D. Pedro e Inês de Castro, assassinada por ordem do rei D. Afonso IV. Quando D. Pedro se tornou rei, mandou coroar o cadáver de Inês como rainha de Portugal.", "region": "centro", "location": {"lat": 40.2033, "lng": -8.4103}, "address": "Coimbra, Mosteiro de Alcobaça"},
    {"name": "A Lenda da Praia do Cabedelo", "description": "O cavaleiro e a sereia. Conta-se que um cavaleiro se apaixonou por uma sereia que habitava as águas de Viana. Todas as noites ele ia à praia esperar por ela, até que um dia desapareceu nas ondas.", "region": "norte", "location": {"lat": 41.6946, "lng": -8.8403}, "address": "Praia do Cabedelo, Viana do Castelo"},
    {"name": "A Lenda da Serra do Marão", "description": "O pastor condenado a vaguear eternamente. Um pastor traiu a sua amada e foi amaldiçoado a vaguear pela serra para sempre. Nas noites de tempestade, ainda se ouvem os seus lamentos.", "region": "norte", "location": {"lat": 41.2833, "lng": -7.9000}, "address": "Serra do Marão"},
    {"name": "A Lenda da Fonte das Lágrimas", "description": "As lágrimas de Inês de Castro. Na Quinta das Lágrimas em Coimbra, diz-se que a água da fonte é vermelha com o sangue de Inês e que as algas são as suas lágrimas cristalizadas.", "region": "centro", "location": {"lat": 40.1978, "lng": -8.4322}, "address": "Quinta das Lágrimas, Coimbra"},
    {"name": "A Lenda do Cavaleiro das Ilhas Afortunadas", "description": "A visão da ilha. Um cavaleiro viu em sonhos uma ilha paradisíaca no meio do Atlântico. Navegou até encontrar a Madeira, cumprindo assim a profecia.", "region": "madeira", "location": {"lat": 32.6669, "lng": -16.9241}, "address": "Madeira, Machico"},
    {"name": "A Lenda da Nazaré", "description": "A intervenção de Nossa Senhora para salvar D. Fuas Roupinho. Em plena caçada, o cavaleiro ia cair de um penhasco quando invocou Nossa Senhora. O cavalo estacou miraculosamente à beira do abismo.", "region": "centro", "location": {"lat": 39.6017, "lng": -9.0714}, "address": "Nazaré"},
    {"name": "A Lenda da Ala dos Namorados", "description": "O símbolo de amor na pedra. No Mosteiro da Batalha, há uma ala onde se conta que casais apaixonados gravavam os seus nomes na pedra.", "region": "centro", "location": {"lat": 39.6600, "lng": -8.8247}, "address": "Mosteiro da Batalha"},
    {"name": "O Milagre das Rosas", "description": "A Rainha Santa Isabel transformava pão em rosas. Quando o rei D. Dinis a surpreendeu a levar pão aos pobres, ela escondeu-o no regaço. Quando questionada, disse que eram rosas - e rosas apareceram.", "region": "centro", "location": {"lat": 40.2033, "lng": -8.4103}, "address": "Coimbra, Alenquer"},
    {"name": "A Lenda do Bastardo de Avis", "description": "A visão antes de Aljubarrota. D. Nuno Álvares Pereira teve uma visão divina que lhe deu coragem para liderar as tropas portuguesas à vitória contra os castelhanos.", "region": "centro", "location": {"lat": 39.5500, "lng": -8.9667}, "address": "Aljubarrota"},
    {"name": "A Lenda da Sereia e do Caçador", "description": "A origem do nome 'Ericeira'. Um caçador perseguia uma sereia que se refugiou nas rochas. O nome Ericeira deriva de 'ouriceira' - lugar onde o ouriço (sereia) se escondeu.", "region": "lisboa", "location": {"lat": 38.9624, "lng": -9.4178}, "address": "Ericeira"},
    {"name": "A Lenda da Boca do Inferno", "description": "O local onde o diabo aparecia. Nas rochas de Cascais existe uma gruta marinha chamada Boca do Inferno, onde se diz que o diabo aparecia em noites de tempestade.", "region": "lisboa", "location": {"lat": 38.6925, "lng": -9.4358}, "address": "Boca do Inferno, Cascais"},
    {"name": "O Bruxo de Évora Monte", "description": "Lendas sobre o último alcaide-mor e artes mágicas. Conta-se que o último senhor do castelo de Évora Monte praticava bruxaria e feitiçaria nas torres da fortaleza.", "region": "alentejo", "location": {"lat": 38.8000, "lng": -7.5333}, "address": "Évora Monte"},
    {"name": "A Lenda do Santo Condestável", "description": "As visões místicas de São Nuno de Santa Maria. O Condestável D. Nuno Álvares Pereira tinha visões celestiais que o guiavam nas batalhas e na sua vida espiritual.", "region": "lisboa", "location": {"lat": 38.7139, "lng": -9.1456}, "address": "Igreja do Carmo, Lisboa"},
    {"name": "A Lenda da Costa da Morte", "description": "Sobre um naufrágio e uma maldição. Na costa rochosa do Algarve, diz-se que os espíritos dos marinheiros naufragados ainda vagueiam nas noites de tempestade.", "region": "algarve", "location": {"lat": 37.0833, "lng": -8.6667}, "address": "Costa rochosa do Algarve"},
]

# ========================
# FESTAS E TRADIÇÕES
# ========================
FESTAS = [
    {"name": "Santos Populares - Santo António", "description": "Festas de Lisboa em honra de Santo António, com marchas populares, arraiais, sardinhas assadas e manjericos. Celebra-se a 12-13 de junho.", "region": "lisboa", "location": {"lat": 38.7223, "lng": -9.1393}, "address": "Lisboa"},
    {"name": "Festas de São João do Porto", "description": "A maior festa popular do Norte de Portugal. Na noite de 23 para 24 de junho, o Porto enche-se de balões, alho-porro para bater na cabeça, sardinhas e fogo de artifício.", "region": "norte", "location": {"lat": 41.1579, "lng": -8.6291}, "address": "Porto"},
    {"name": "Festa dos Tabuleiros", "description": "Celebração quadrienal em Tomar com cortejo de tabuleiros decorados com pão e flores. Uma das festas mais emblemáticas de Portugal, com raízes no culto do Espírito Santo.", "region": "centro", "location": {"lat": 39.6014, "lng": -8.4111}, "address": "Tomar"},
    {"name": "Carnaval de Podence - Caretos", "description": "Rito de fertilidade com mascarados. Os Caretos de Podence usam fatos coloridos de franjas e máscaras de latão, correndo atrás das mulheres num ritual ancestral.", "region": "norte", "location": {"lat": 41.5500, "lng": -6.9333}, "address": "Podence, Macedo de Cavaleiros"},
    {"name": "Festa da Flor", "description": "Desfile alegórico e mural de flores na Madeira. Todos os anos, no início da primavera, o Funchal transforma-se num jardim de flores com desfiles e tapetes florais.", "region": "madeira", "location": {"lat": 32.6669, "lng": -16.9241}, "address": "Funchal, Madeira"},
    {"name": "Queima das Fitas", "description": "Tradição académica de Coimbra. Durante uma semana em maio, os estudantes finalistas celebram o fim do curso com serenatas, desfiles de carros alegóricos e muita festa.", "region": "centro", "location": {"lat": 40.2033, "lng": -8.4103}, "address": "Coimbra"},
    {"name": "Festa do Senhor Santo Cristo dos Milagres", "description": "A maior romaria açoriana. Em Ponta Delgada, milhares de fiéis percorrem as ruas em procissão em honra da imagem do Senhor Santo Cristo.", "region": "acores", "location": {"lat": 37.7394, "lng": -25.6687}, "address": "Ponta Delgada, São Miguel, Açores"},
    {"name": "Festa dos Rapazes", "description": "Máscaras, entrudos e rituais de passagem no Nordeste Transmontano. Os jovens usam máscaras e fatos coloridos em rituais que marcam a passagem à idade adulta.", "region": "norte", "location": {"lat": 41.8000, "lng": -6.7500}, "address": "Nordeste Transmontano"},
    {"name": "Festa do Divino Espírito Santo", "description": "Coroações e sopas do Espírito Santo. Celebrada em todo o país, especialmente nos Açores, com distribuição de pão e carne aos pobres.", "region": "acores", "location": {"lat": 37.7394, "lng": -25.6687}, "address": "Açores"},
    {"name": "Feira Medieval de Óbidos", "description": "Recriação histórica com mercados, espetáculos de época, torneios medievais e gastronomia tradicional. Uma viagem no tempo à Idade Média.", "region": "centro", "location": {"lat": 39.3600, "lng": -9.1569}, "address": "Óbidos"},
    {"name": "Romaria de Nossa Senhora d'Agonia", "description": "Trajes, tapetes floridos e gigantones em Viana do Castelo. Uma das romarias mais coloridas de Portugal, com desfile de trajes tradicionais e procissões.", "region": "norte", "location": {"lat": 41.6946, "lng": -8.8303}, "address": "Viana do Castelo"},
    {"name": "Festa de São Martinho", "description": "Magusto, jeropiga e castanhas. A 11 de novembro celebra-se o verão de São Martinho com castanhas assadas, vinho novo e convívio.", "region": "norte", "location": {"lat": 41.15, "lng": -8.61}, "address": "Todo o país"},
    {"name": "Festa do Pão", "description": "Celebração dos ciclos do pão em Ferreira do Zêzere. Uma festa que celebra a tradição milenar de fazer pão, com demonstrações e degustações.", "region": "centro", "location": {"lat": 39.6964, "lng": -8.2906}, "address": "Ferreira do Zêzere"},
    {"name": "Festa do Mar", "description": "Celebração da ligação ao mar em Vila do Conde e Nazaré. Festas que honram as tradições marítimas portuguesas com procissões, bênção dos barcos e gastronomia do mar.", "region": "norte", "location": {"lat": 41.3514, "lng": -8.7478}, "address": "Vila do Conde"},
    {"name": "Feira de São Mateus", "description": "Uma das mais antigas feiras do país, realizada em Viseu desde 1392. Combina feira, espetáculos, gastronomia e diversões.", "region": "centro", "location": {"lat": 40.6566, "lng": -7.9125}, "address": "Viseu"},
    {"name": "Carnaval de Loulé", "description": "Um dos mais antigos e famosos do Algarve. Desfiles de carros alegóricos e escolas de samba animam as ruas de Loulé.", "region": "algarve", "location": {"lat": 37.1381, "lng": -8.0206}, "address": "Loulé"},
    {"name": "Festa das Vindimas", "description": "Pisar das uvas e cortejo em Palmela e no Douro. Celebração da colheita das uvas com tradições antigas, incluindo o pisar das uvas.", "region": "lisboa", "location": {"lat": 38.5667, "lng": -8.9000}, "address": "Palmela, Douro"},
    {"name": "Festa da Cereja", "description": "Celebração do fruto e da cultura local no Fundão. A capital da cereja portuguesa celebra este fruto com festas, mercados e gastronomia.", "region": "centro", "location": {"lat": 40.1386, "lng": -7.5006}, "address": "Fundão"},
    {"name": "Colete Encarnado", "description": "Tradição ribatejana de Vila Franca de Xira. Festas em honra do colete encarnado dos campinos, com largadas de toiros e corridas.", "region": "lisboa", "location": {"lat": 38.9500, "lng": -8.9833}, "address": "Vila Franca de Xira"},
    {"name": "Festas de São Gonçalo", "description": "Tradições populares em Amarante, com procissões e o famoso bolo de São Gonçalo, considerado o santo casamenteiro.", "region": "norte", "location": {"lat": 41.2719, "lng": -8.0750}, "address": "Amarante"},
]

# ========================
# SABERES E OFÍCIOS
# ========================
SABERES = [
    {"name": "Azulejaria", "description": "Arte narrativa em cerâmica vidrada que decora fachadas, igrejas e palácios em todo Portugal. Uma tradição que remonta ao século XV e é símbolo da identidade portuguesa.", "region": "lisboa", "location": {"lat": 38.7223, "lng": -9.1393}, "address": "Fábrica Sant'Anna, Lisboa"},
    {"name": "Filigrana Portuguesa", "description": "Trabalho delicado em ouro e prata, característico de Gondomar. Os ourives criam peças de extraordinária fineza usando técnicas ancestrais.", "region": "norte", "location": {"lat": 41.1500, "lng": -8.5333}, "address": "Gondomar"},
    {"name": "Cante Alentejano", "description": "Canto polifónico masculino do Alentejo, reconhecido como Património Imaterial da Humanidade pela UNESCO. Grupos de homens cantam em coro sem acompanhamento instrumental.", "region": "alentejo", "location": {"lat": 38.5667, "lng": -7.9167}, "address": "Alentejo"},
    {"name": "Fado de Lisboa", "description": "Canção urbana portuguesa, Património Imaterial da Humanidade. O fado de Lisboa expressa a saudade, o amor e a vida da cidade através de vozes únicas.", "region": "lisboa", "location": {"lat": 38.7139, "lng": -9.1289}, "address": "Lisboa, Alfama"},
    {"name": "Fado de Coimbra", "description": "Variante académica do fado, cantado por estudantes e tunos. Mais solene que o fado de Lisboa, está ligado às tradições universitárias.", "region": "centro", "location": {"lat": 40.2033, "lng": -8.4103}, "address": "Coimbra"},
    {"name": "Arte Xávega", "description": "Pesca artesanal com redes puxadas à praia por tratores (antigamente por bois). Uma técnica ancestral ainda praticada nas praias do Centro.", "region": "centro", "location": {"lat": 40.6500, "lng": -8.7500}, "address": "Costa Central"},
    {"name": "Descortiçamento", "description": "Saber extrair cortiça sem danificar o sobreiro. Portugal é o maior produtor mundial de cortiça, e o descortiçamento é uma arte transmitida de geração em geração.", "region": "alentejo", "location": {"lat": 38.5667, "lng": -7.9167}, "address": "Alentejo"},
    {"name": "Produção de Vinho do Porto", "description": "Vinificação única no mundo, com pisas tradicionais e envelhecimento em caves de Vila Nova de Gaia. Um saber-fazer com séculos de história.", "region": "norte", "location": {"lat": 41.1347, "lng": -8.6139}, "address": "Vila Nova de Gaia, Douro"},
    {"name": "Produção de Vinho da Madeira", "description": "Processo único de aquecimento do vinho (estufagem) que cria sabores incomparáveis. Um vinho com mais de 500 anos de história.", "region": "madeira", "location": {"lat": 32.6669, "lng": -16.9241}, "address": "Funchal, Madeira"},
    {"name": "Pastelaria Conventual", "description": "Doces à base de ovos, açúcar e amêndoa criados nos conventos portugueses. Pastéis de nata, ovos moles, queijadas e muitos mais.", "region": "lisboa", "location": {"lat": 38.6979, "lng": -9.2068}, "address": "Belém, Lisboa"},
    {"name": "Barro Negro de Bisalhães", "description": "Técnica ancestral de olaria reconhecida pela UNESCO. As peças são cozidas em fornos subterrâneos sem oxigénio, criando a cor negra característica.", "region": "norte", "location": {"lat": 41.2931, "lng": -7.7475}, "address": "Bisalhães, Vila Real"},
    {"name": "Renda de Bilros", "description": "Trabalho delicado em renda feito com bilros de madeira. Vila do Conde e Peniche são os principais centros desta arte ancestral.", "region": "norte", "location": {"lat": 41.3514, "lng": -8.7478}, "address": "Vila do Conde"},
    {"name": "Artesanato em Vime", "description": "Cestaria tradicional em vime, uma arte que usa as varas flexíveis do salgueiro para criar cestos, móveis e objetos decorativos.", "region": "norte", "location": {"lat": 41.7667, "lng": -8.5833}, "address": "Ponte de Lima"},
    {"name": "Talha Dourada", "description": "Trabalho ornamental em madeira recoberto a ouro. As igrejas barrocas portuguesas são ricamente decoradas com talha dourada.", "region": "norte", "location": {"lat": 41.5500, "lng": -8.4200}, "address": "Braga"},
    {"name": "Tanoaria", "description": "Arte de fazer pipas, barris e tonéis para vinho. Os tanoeiros usam técnicas tradicionais para criar as vasilhas onde o vinho envelhece.", "region": "norte", "location": {"lat": 41.1500, "lng": -8.6100}, "address": "Gaia"},
    {"name": "Arte Chocalheira de Alcáçovas", "description": "Fabrico manual de chocalhos, reconhecido pela UNESCO como património em risco. Os chocalhos são usados no gado e são símbolo do Alentejo.", "region": "alentejo", "location": {"lat": 38.4000, "lng": -8.1500}, "address": "Alcáçovas"},
    {"name": "Bordado da Madeira", "description": "Arte do bordado manual, conhecido em todo o mundo pela sua delicadeza e perfeição. As bordadeiras da Madeira criam verdadeiras obras de arte em tecido.", "region": "madeira", "location": {"lat": 32.6669, "lng": -16.9241}, "address": "Funchal, Madeira"},
    {"name": "Produção de Queijo Serra da Estrela", "description": "Saber-fazer ancestral dos pastores da Serra da Estrela. O queijo é feito com leite cru de ovelha e cardo como coagulante.", "region": "centro", "location": {"lat": 40.3217, "lng": -7.6114}, "address": "Serra da Estrela"},
    {"name": "Olaria de Barcelos", "description": "Tradição cerâmica que inclui o famoso Galo de Barcelos. Os oleiros de Barcelos criam figuras coloridas e utilitárias.", "region": "norte", "location": {"lat": 41.5314, "lng": -8.6152}, "address": "Barcelos"},
    {"name": "Tapetes de Arraiolos", "description": "Arte do bordado de tapetes em lã sobre tela de linho. Os tapetes de Arraiolos são conhecidos pelos seus padrões coloridos e técnica única.", "region": "alentejo", "location": {"lat": 38.7167, "lng": -7.9833}, "address": "Arraiolos"},
]

# ========================
# CRENÇAS E OCULTO
# ========================
CRENCAS = [
    {"name": "Lobisomens de Trás-os-Montes", "description": "Crenças em homens que se transformam em lobos nas noites de lua cheia. Uma tradição oral que persiste nas aldeias transmontanas.", "region": "norte", "location": {"lat": 41.8000, "lng": -6.7500}, "address": "Trás-os-Montes"},
    {"name": "Bruxas e Feiticeiras", "description": "Mulheres com poderes sobrenaturais, capazes de curar ou amaldiçoar. As histórias de bruxas fazem parte do imaginário popular português.", "region": "norte", "location": {"lat": 41.5500, "lng": -8.4200}, "address": "Norte de Portugal"},
    {"name": "Alminhas e Almas Penadas", "description": "Rituais para as almas do purgatório. Os nichos das alminhas nas estradas são locais de oração pelos mortos.", "region": "norte", "location": {"lat": 41.5500, "lng": -8.4200}, "address": "Todo o país"},
    {"name": "Benzeduras e Curas", "description": "Medicina popular e rezas para curar o mau-olhado, quebranto e outras maleitas. As benzedeiras usam orações e rituais ancestrais.", "region": "alentejo", "location": {"lat": 38.5667, "lng": -7.9167}, "address": "Todo o país"},
    {"name": "Mau-Olhado e Quebranto", "description": "Crença no poder maléfico do olhar invejoso. Vários amuletos e rituais são usados para proteção.", "region": "norte", "location": {"lat": 41.5500, "lng": -8.4200}, "address": "Todo o país"},
    {"name": "A Fada dos Montes Hermínios", "description": "Espírito protetor da Serra da Estrela. Uma entidade benigna que protege os pastores e viajantes na montanha.", "region": "centro", "location": {"lat": 40.3217, "lng": -7.6114}, "address": "Serra da Estrela"},
    {"name": "A Moura Salúquia", "description": "Lenda ligada ao templo romano de Évora (Templo de Diana). Uma moura encantada que guarda tesouros.", "region": "alentejo", "location": {"lat": 38.5719, "lng": -7.9097}, "address": "Évora"},
    {"name": "Superstições Marítimas", "description": "Tabus e rituais dos pescadores para garantir sorte no mar. Não se deve assobiar no barco ou dizer certas palavras.", "region": "centro", "location": {"lat": 39.6017, "lng": -9.0714}, "address": "Nazaré"},
    {"name": "O Sebastianismo", "description": "Crença messiânica no regresso de D. Sebastião para salvar Portugal. Um mito que persiste no imaginário nacional.", "region": "lisboa", "location": {"lat": 38.7223, "lng": -9.1393}, "address": "Todo o país"},
    {"name": "Literatura de Cordel", "description": "Folhetos populares em verso vendidos em feiras. Contam histórias de amor, crime, milagres e eventos do quotidiano.", "region": "alentejo", "location": {"lat": 38.5667, "lng": -7.9167}, "address": "Todo o país"},
    {"name": "Contos Tradicionais", "description": "Histórias da Carochinha, João Pateta, Pedro Malasartes e muitos outros personagens do imaginário popular português.", "region": "norte", "location": {"lat": 41.5500, "lng": -8.4200}, "address": "Todo o país"},
    {"name": "Provérbios e Ditos Populares", "description": "Sabedoria prática e filosófica do povo expressa em frases curtas e memoráveis. 'De Espanha nem bom vento nem bom casamento.'", "region": "lisboa", "location": {"lat": 38.7223, "lng": -9.1393}, "address": "Todo o país"},
    {"name": "As Janeiras e Reisadas", "description": "Cantos de porta em porta no ciclo natalício. Grupos cantam as Janeiras para desejar um bom ano e recebem oferendas.", "region": "norte", "location": {"lat": 41.5500, "lng": -8.4200}, "address": "Todo o país"},
    {"name": "Cantigas de Embalar", "description": "Canções tradicionais para adormecer as crianças. Transmitidas oralmente de mães para filhas através das gerações.", "region": "alentejo", "location": {"lat": 38.5667, "lng": -7.9167}, "address": "Todo o país"},
    {"name": "Tesouros Mouros", "description": "Histórias de ouro escondido pelos mouros em castelos e fontes por todo o país. Muitos procuram ainda hoje estes tesouros.", "region": "alentejo", "location": {"lat": 38.5667, "lng": -7.9167}, "address": "Castelos por todo o país"},
]

# ========================
# GASTRONOMIA
# ========================
GASTRONOMIA = [
    # Norte
    {"name": "Tripas à Moda do Porto", "description": "Prato emblemático do Porto feito com tripas e feijão branco. Os portuenses são chamados 'tripeiros' por causa deste prato.", "region": "norte", "subcategory": "pratos", "location": {"lat": 41.1579, "lng": -8.6291}, "address": "Porto"},
    {"name": "Francesinha", "description": "Sanduíche típica do Porto com carnes variadas, queijo derretido e molho especial. Um ícone da gastronomia portuense.", "region": "norte", "subcategory": "pratos", "location": {"lat": 41.1579, "lng": -8.6291}, "address": "Porto"},
    {"name": "Caldo Verde", "description": "Sopa tradicional de couve galega, batata e chouriço. Um clássico da cozinha portuguesa, especialmente do Minho.", "region": "norte", "subcategory": "sopas", "location": {"lat": 41.6946, "lng": -8.8303}, "address": "Minho"},
    {"name": "Bacalhau à Gomes de Sá", "description": "Um dos pratos de bacalhau mais famosos de Portugal, com batata aos cubos, cebola e ovos cozidos.", "region": "norte", "subcategory": "pratos", "location": {"lat": 41.1579, "lng": -8.6291}, "address": "Porto"},
    {"name": "Rojões à Moda do Minho", "description": "Carne de porco frita em cubos, temperada com cominho e vinho. Servida com castanhas ou batata.", "region": "norte", "subcategory": "pratos", "location": {"lat": 41.6946, "lng": -8.8303}, "address": "Minho"},
    {"name": "Lampreia à Minhota", "description": "Iguaria sazonal do Rio Minho, preparada com o seu próprio sangue e vinho tinto.", "region": "norte", "subcategory": "pratos", "location": {"lat": 41.8667, "lng": -8.8500}, "address": "Caminha, Minho"},
    {"name": "Cabrito Assado de Barroso", "description": "Cabrito assado no forno à moda transmontana. A carne de cabrito do Barroso tem denominação de origem.", "region": "norte", "subcategory": "pratos", "location": {"lat": 41.7500, "lng": -7.8333}, "address": "Barroso"},
    {"name": "Pudim Abade de Priscos", "description": "Doce conventual feito com gemas de ovo, açúcar e toucinho. Uma receita criada pelo abade de Priscos.", "region": "norte", "subcategory": "doces", "location": {"lat": 41.5500, "lng": -8.4200}, "address": "Braga"},
    
    # Centro
    {"name": "Leitão da Bairrada", "description": "Leitão assado no forno, com a pele estaladiça. O prato mais famoso da Bairrada.", "region": "centro", "subcategory": "pratos", "location": {"lat": 40.3833, "lng": -8.4500}, "address": "Mealhada"},
    {"name": "Chanfana", "description": "Carne de cabra ou borrego cozinhada em vinho tinto num pote de barro. Típica da Serra da Lousã.", "region": "centro", "subcategory": "pratos", "location": {"lat": 40.1000, "lng": -8.2333}, "address": "Miranda do Corvo"},
    {"name": "Caldeirada de Enguias", "description": "Ensopado de enguias da Ria de Aveiro com batata e pimentão.", "region": "centro", "subcategory": "pratos", "location": {"lat": 40.6443, "lng": -8.6455}, "address": "Aveiro"},
    {"name": "Ovos Moles de Aveiro", "description": "Doce conventual com gema de ovo e açúcar em hóstias. Tem Indicação Geográfica Protegida.", "region": "centro", "subcategory": "doces", "location": {"lat": 40.6443, "lng": -8.6455}, "address": "Aveiro"},
    {"name": "Pastéis de Tentúgal", "description": "Doce de massa folhada finíssima recheado com ovos moles. Uma especialidade de Tentúgal.", "region": "centro", "subcategory": "doces", "location": {"lat": 40.2000, "lng": -8.5667}, "address": "Tentúgal"},
    {"name": "Sopa da Pedra", "description": "Sopa rica com feijão, enchidos, carnes e legumes. Originária de Almeirim.", "region": "centro", "subcategory": "sopas", "location": {"lat": 39.2167, "lng": -8.6333}, "address": "Almeirim"},
    {"name": "Ginja de Óbidos", "description": "Licor de ginja servido em copo de chocolate. Uma tradição de Óbidos e Alcobaça.", "region": "centro", "subcategory": "bebidas", "location": {"lat": 39.3600, "lng": -9.1569}, "address": "Óbidos"},
    
    # Lisboa e Vale do Tejo
    {"name": "Pastéis de Belém", "description": "Os famosos pastéis de nata de Belém, feitos com uma receita secreta desde 1837.", "region": "lisboa", "subcategory": "doces", "location": {"lat": 38.6979, "lng": -9.2068}, "address": "Belém, Lisboa"},
    {"name": "Amêijoas à Bulhão Pato", "description": "Amêijoas salteadas com alho, coentros, azeite e vinho branco. Um clássico lisboeta.", "region": "lisboa", "subcategory": "pratos", "location": {"lat": 38.7223, "lng": -9.1393}, "address": "Lisboa"},
    {"name": "Caracóis", "description": "Petisco típico de Lisboa, servido em molho picante no verão. 'Ó Rosa, arrefeça-me estes caracóis!'", "region": "lisboa", "subcategory": "petiscos", "location": {"lat": 38.7223, "lng": -9.1393}, "address": "Lisboa"},
    {"name": "Açorda de Marisco", "description": "Sopa-guisado de pão alentejano com camarão, berbigão e coentros.", "region": "lisboa", "subcategory": "pratos", "location": {"lat": 38.5333, "lng": -8.8833}, "address": "Setúbal"},
    {"name": "Choco Frito à Setubalense", "description": "Choco frito à moda de Setúbal, uma especialidade local.", "region": "lisboa", "subcategory": "pratos", "location": {"lat": 38.5333, "lng": -8.8833}, "address": "Setúbal"},
    
    # Alentejo
    {"name": "Açorda Alentejana", "description": "Sopa de pão com alho, coentros, ovo escalfado e azeite. A alma da cozinha alentejana.", "region": "alentejo", "subcategory": "sopas", "location": {"lat": 38.5719, "lng": -7.9097}, "address": "Évora"},
    {"name": "Carne de Porco à Alentejana", "description": "Carne de porco com amêijoas, uma combinação única de mar e terra.", "region": "alentejo", "subcategory": "pratos", "location": {"lat": 38.5719, "lng": -7.9097}, "address": "Alentejo"},
    {"name": "Migas com Carne de Porco", "description": "Pão esfarelado frito com gordura de porco, servido com entrecosto.", "region": "alentejo", "subcategory": "pratos", "location": {"lat": 38.5719, "lng": -7.9097}, "address": "Alentejo"},
    {"name": "Gaspacho à Alentejana", "description": "Sopa fria de tomate, pepino, pimento e pão. Refrescante nos verões quentes.", "region": "alentejo", "subcategory": "sopas", "location": {"lat": 38.5719, "lng": -7.9097}, "address": "Alentejo"},
    {"name": "Sericaia com Ameixas de Elvas", "description": "Doce conventual de ovos servido com ameixas. Uma combinação perfeita.", "region": "alentejo", "subcategory": "doces", "location": {"lat": 38.8500, "lng": -7.1667}, "address": "Elvas"},
    
    # Algarve
    {"name": "Cataplana de Marisco", "description": "Cozinhado na tradicional cataplana de cobre com mariscos, peixe e legumes.", "region": "algarve", "subcategory": "pratos", "location": {"lat": 37.0194, "lng": -7.9322}, "address": "Faro"},
    {"name": "Dom Rodrigo", "description": "Doce fino do Algarve feito com fios de ovos, amêndoa e açúcar.", "region": "algarve", "subcategory": "doces", "location": {"lat": 37.0833, "lng": -8.6667}, "address": "Lagos"},
    {"name": "Arroz de Lingueirão", "description": "Arroz malandrinho com lingueirões frescos do mar algarvio.", "region": "algarve", "subcategory": "pratos", "location": {"lat": 37.0194, "lng": -7.9322}, "address": "Algarve"},
    
    # Açores
    {"name": "Cozido das Furnas", "description": "Cozido cozinhado no calor vulcânico da terra nas Furnas, São Miguel.", "region": "acores", "subcategory": "pratos", "location": {"lat": 37.7730, "lng": -25.3080}, "address": "Furnas, São Miguel"},
    {"name": "Alcatra da Terceira", "description": "Carne de vaca cozinhada lentamente em panela de barro com vinho e especiarias.", "region": "acores", "subcategory": "pratos", "location": {"lat": 38.7167, "lng": -27.2167}, "address": "Terceira"},
    {"name": "Bolo Lêvedo", "description": "Pão doce fofinho típico de São Miguel, perfeito com manteiga.", "region": "acores", "subcategory": "pães", "location": {"lat": 37.7394, "lng": -25.6687}, "address": "São Miguel"},
    
    # Madeira
    {"name": "Espetada Madeirense", "description": "Carne de vaca em espetos de louro grelhada sobre brasas.", "region": "madeira", "subcategory": "pratos", "location": {"lat": 32.6669, "lng": -16.9241}, "address": "Funchal"},
    {"name": "Bolo do Caco", "description": "Pão achatado de batata-doce, servido com manteiga de alho.", "region": "madeira", "subcategory": "pães", "location": {"lat": 32.6669, "lng": -16.9241}, "address": "Madeira"},
    {"name": "Filete de Espada com Banana", "description": "Peixe-espada preto frito com banana da Madeira. Uma combinação única.", "region": "madeira", "subcategory": "pratos", "location": {"lat": 32.6669, "lng": -16.9241}, "address": "Funchal"},
    {"name": "Poncha", "description": "Bebida alcoólica tradicional com aguardente de cana, mel e limão.", "region": "madeira", "subcategory": "bebidas", "location": {"lat": 32.6669, "lng": -16.9241}, "address": "Madeira"},
    {"name": "Bolo de Mel", "description": "Bolo denso e escuro feito com mel de cana, especiarias e frutos secos.", "region": "madeira", "subcategory": "doces", "location": {"lat": 32.6669, "lng": -16.9241}, "address": "Madeira"},
]

# ========================
# PRODUTOS DOP/IGP
# ========================
PRODUTOS = [
    # Norte
    {"name": "Vinho Verde DOP", "description": "Vinho leve e fresco do Minho, com ligeira efervescência natural. Um dos vinhos mais característicos de Portugal.", "region": "norte", "subcategory": "vinhos", "location": {"lat": 41.6946, "lng": -8.8303}},
    {"name": "Vinho do Porto DOP", "description": "Vinho licoroso mundialmente famoso, produzido na região demarcada do Douro desde 1756.", "region": "norte", "subcategory": "vinhos", "location": {"lat": 41.1347, "lng": -8.6139}},
    {"name": "Azeite de Trás-os-Montes DOP", "description": "Azeite produzido com azeitonas da região transmontana, de sabor frutado e intenso.", "region": "norte", "subcategory": "azeites", "location": {"lat": 41.8000, "lng": -6.7500}},
    {"name": "Presunto de Barroso IGP", "description": "Presunto curado das terras altas de Barroso, de sabor único devido à altitude e clima.", "region": "norte", "subcategory": "enchidos", "location": {"lat": 41.7500, "lng": -7.8333}},
    {"name": "Alheira de Mirandela IGP", "description": "Enchido tradicional de pão e carnes, criado pelos judeus para simular o consumo de porco.", "region": "norte", "subcategory": "enchidos", "location": {"lat": 41.4833, "lng": -7.1833}},
    {"name": "Castanha da Padrela DOP", "description": "Castanha de qualidade superior da Serra da Padrela, Valpaços.", "region": "norte", "subcategory": "frutos", "location": {"lat": 41.6000, "lng": -7.3000}},
    
    # Centro
    {"name": "Queijo Serra da Estrela DOP", "description": "O mais famoso queijo português, cremoso e amanteigado, feito com leite cru de ovelha.", "region": "centro", "subcategory": "queijos", "location": {"lat": 40.3217, "lng": -7.6114}},
    {"name": "Azeite da Beira Interior DOP", "description": "Azeite de qualidade premium produzido na região da Beira Interior.", "region": "centro", "subcategory": "azeites", "location": {"lat": 40.1386, "lng": -7.5006}},
    {"name": "Cereja da Cova da Beira IGP", "description": "Cereja de qualidade excecional produzida na região do Fundão.", "region": "centro", "subcategory": "frutos", "location": {"lat": 40.1386, "lng": -7.5006}},
    {"name": "Vinho do Dão DOP", "description": "Vinho tinto elegante e encorpado da região demarcada do Dão.", "region": "centro", "subcategory": "vinhos", "location": {"lat": 40.6566, "lng": -7.9125}},
    {"name": "Maçã da Beira Alta IGP", "description": "Maçã de qualidade superior produzida na Serra da Estrela.", "region": "centro", "subcategory": "frutos", "location": {"lat": 40.3217, "lng": -7.6114}},
    
    # Lisboa
    {"name": "Queijo de Azeitão DOP", "description": "Queijo cremoso feito com leite de ovelha na Serra da Arrábida.", "region": "lisboa", "subcategory": "queijos", "location": {"lat": 38.5200, "lng": -8.9833}},
    {"name": "Moscatel de Setúbal DOP", "description": "Vinho licoroso de uvas moscatel, doce e aromático.", "region": "lisboa", "subcategory": "vinhos", "location": {"lat": 38.5333, "lng": -8.8833}},
    {"name": "Pêra Rocha do Oeste DOP", "description": "Pêra suculenta e aromática do Oeste de Portugal.", "region": "lisboa", "subcategory": "frutos", "location": {"lat": 39.3600, "lng": -9.1569}},
    {"name": "Vinho de Colares DOP", "description": "Vinho raro produzido em areias junto ao mar, em Sintra.", "region": "lisboa", "subcategory": "vinhos", "location": {"lat": 38.7893, "lng": -9.4422}},
    
    # Alentejo
    {"name": "Queijo de Évora DOP", "description": "Queijo curado de ovelha, de sabor intenso e pasta firme.", "region": "alentejo", "subcategory": "queijos", "location": {"lat": 38.5719, "lng": -7.9097}},
    {"name": "Queijo Serpa DOP", "description": "Queijo cremoso e picante feito com leite de ovelha em Serpa.", "region": "alentejo", "subcategory": "queijos", "location": {"lat": 37.9500, "lng": -7.6000}},
    {"name": "Presunto de Barrancos DOP", "description": "O presunto mais prestigiado de Portugal, curado durante 24 meses.", "region": "alentejo", "subcategory": "enchidos", "location": {"lat": 38.1333, "lng": -6.9833}},
    {"name": "Azeite do Alentejo Interior DOP", "description": "Azeite de qualidade superior do interior alentejano.", "region": "alentejo", "subcategory": "azeites", "location": {"lat": 38.5719, "lng": -7.9097}},
    {"name": "Ameixas de Elvas DOP", "description": "Ameixas em calda de qualidade única, uma tradição secular.", "region": "alentejo", "subcategory": "frutos", "location": {"lat": 38.8500, "lng": -7.1667}},
    {"name": "Vinho do Alentejo DOP", "description": "Vinhos encorpados e frutados da maior região vinícola de Portugal.", "region": "alentejo", "subcategory": "vinhos", "location": {"lat": 38.5719, "lng": -7.9097}},
    
    # Algarve
    {"name": "Citrinos do Algarve IGP", "description": "Laranjas e tangerinas doces e sumarentas do Algarve.", "region": "algarve", "subcategory": "frutos", "location": {"lat": 37.2500, "lng": -8.4167}},
    {"name": "Mel do Algarve DOP", "description": "Mel de qualidade produzido com flores da serra algarvia.", "region": "algarve", "subcategory": "mel", "location": {"lat": 37.2500, "lng": -8.4167}},
    {"name": "Medronho do Algarve", "description": "Aguardente destilada do fruto do medronheiro, tradição secular.", "region": "algarve", "subcategory": "bebidas", "location": {"lat": 37.2500, "lng": -8.4167}},
    
    # Açores
    {"name": "Queijo São Jorge DOP", "description": "Queijo curado picante da Ilha de São Jorge, envelhecido durante meses.", "region": "acores", "subcategory": "queijos", "location": {"lat": 38.6500, "lng": -28.0833}},
    {"name": "Ananás dos Açores DOP", "description": "Ananás doce e aromático cultivado em estufas de São Miguel.", "region": "acores", "subcategory": "frutos", "location": {"lat": 37.7394, "lng": -25.6687}},
    {"name": "Vinho do Pico DOP", "description": "Vinho produzido nas paisagens vulcânicas da ilha do Pico, Património Mundial.", "region": "acores", "subcategory": "vinhos", "location": {"lat": 38.4667, "lng": -28.2667}},
    {"name": "Chá dos Açores", "description": "O único chá produzido na Europa, nas plantações Gorreana e Porto Formoso.", "region": "acores", "subcategory": "bebidas", "location": {"lat": 37.8000, "lng": -25.4500}},
    
    # Madeira
    {"name": "Vinho da Madeira DOP", "description": "Vinho licoroso único, envelhecido através do processo de estufagem.", "region": "madeira", "subcategory": "vinhos", "location": {"lat": 32.6669, "lng": -16.9241}},
    {"name": "Banana da Madeira DOP", "description": "Banana pequena e doce, cultivada nos socalcos da ilha.", "region": "madeira", "subcategory": "frutos", "location": {"lat": 32.6669, "lng": -16.9241}},
    {"name": "Mel da Madeira DOP", "description": "Mel produzido com flores endémicas da Laurissilva.", "region": "madeira", "subcategory": "mel", "location": {"lat": 32.6669, "lng": -16.9241}},
]

# ========================
# ALDEIAS HISTÓRICAS
# ========================
ALDEIAS = [
    {"name": "Monsanto", "description": "Aldeia incrustada entre penedos graníticos gigantes. Eleita 'Aldeia mais Portuguesa de Portugal' em 1938.", "region": "centro", "location": {"lat": 40.0389, "lng": -7.1147}, "address": "Idanha-a-Nova"},
    {"name": "Piódão", "description": "A aldeia de xisto azulado perdida na Serra do Açor. Um presépio natural entre as montanhas.", "region": "centro", "location": {"lat": 40.2278, "lng": -7.8264}, "address": "Arganil"},
    {"name": "Sortelha", "description": "Aldeia medieval com castelo e muralhas intactas. Uma viagem no tempo à Idade Média.", "region": "centro", "location": {"lat": 40.3333, "lng": -7.2000}, "address": "Sabugal"},
    {"name": "Castelo Rodrigo", "description": "Cidadela medieval com vistas deslumbrantes sobre a fronteira com Espanha.", "region": "centro", "location": {"lat": 40.8833, "lng": -6.9667}, "address": "Figueira de Castelo Rodrigo"},
    {"name": "Linhares da Beira", "description": "Aldeia medieval com castelo sobranceiro e casas em granito.", "region": "centro", "location": {"lat": 40.5333, "lng": -7.4667}, "address": "Celorico da Beira"},
    {"name": "Marvão", "description": "'Ninho de águias' na Serra de São Mamede, com muralhas que se confundem com a rocha.", "region": "alentejo", "location": {"lat": 39.3944, "lng": -7.3764}, "address": "Portalegre"},
    {"name": "Mértola", "description": "Vila-museu com história visigótica, mourisca e cristã às margens do Guadiana.", "region": "alentejo", "location": {"lat": 37.6333, "lng": -7.6667}, "address": "Mértola"},
    {"name": "Monsaraz", "description": "Aldeia medieval muralhada com vista sobre o lago do Alqueva.", "region": "alentejo", "location": {"lat": 38.4431, "lng": -7.3811}, "address": "Reguengos de Monsaraz"},
    {"name": "Óbidos", "description": "Vila medieval muralhada, perfeita para um passeio romântico.", "region": "centro", "location": {"lat": 39.3600, "lng": -9.1569}, "address": "Óbidos"},
    {"name": "Sintra", "description": "Centro histórico romântico com palácios e jardins encantados.", "region": "lisboa", "location": {"lat": 38.7980, "lng": -9.3905}, "address": "Sintra"},
    {"name": "Belmonte", "description": "Aldeia berço de Pedro Álvares Cabral, com importante património judaico.", "region": "centro", "location": {"lat": 40.3589, "lng": -7.3506}, "address": "Belmonte"},
    {"name": "Idanha-a-Velha", "description": "Aldeia-museu com vestígios romanos e visigóticos, antiga capital da Egitânia.", "region": "centro", "location": {"lat": 39.9969, "lng": -7.1444}, "address": "Idanha-a-Nova"},
    {"name": "Dornes", "description": "Península no Rio Zêzere com torre templária pentagonal única.", "region": "centro", "location": {"lat": 39.6500, "lng": -8.2333}, "address": "Ferreira do Zêzere"},
    {"name": "Alte", "description": "'Aldeia mais bonita do Algarve', com fonte e cascata.", "region": "algarve", "location": {"lat": 37.2333, "lng": -8.1667}, "address": "Loulé"},
    {"name": "Ponte de Lima", "description": "'Vila mais antiga de Portugal' com ponte romana sobre o Rio Lima.", "region": "norte", "location": {"lat": 41.7667, "lng": -8.5833}, "address": "Ponte de Lima"},
    {"name": "Castro Laboreiro", "description": "Aldeia serrana com castelo medieval e paisagens selvagens do Gerês.", "region": "norte", "location": {"lat": 42.0333, "lng": -8.1500}, "address": "Melgaço"},
    {"name": "Soajo", "description": "Conhecida pelos espigueiros comunitários em granito.", "region": "norte", "location": {"lat": 41.8667, "lng": -8.2667}, "address": "Arcos de Valdevez"},
    {"name": "Lindoso", "description": "Castelo medieval rodeado por espigueiros de granito.", "region": "norte", "location": {"lat": 41.8667, "lng": -8.2000}, "address": "Ponte da Barca"},
    {"name": "Rio de Onor", "description": "Aldeia comunitária transfronteiriça com tradições ancestrais.", "region": "norte", "location": {"lat": 41.9500, "lng": -6.6500}, "address": "Bragança"},
    {"name": "Constância", "description": "Vila poética na confluência do Zêzere com o Tejo, ligada a Camões.", "region": "centro", "location": {"lat": 39.4833, "lng": -8.3333}, "address": "Constância"},
]

# ========================
# SERRAS E FLORESTAS
# ========================
FLORESTAS = [
    {"name": "Parque Nacional da Peneda-Gerês", "description": "O único Parque Nacional de Portugal, com paisagens selvagens, cascatas e fauna única.", "region": "norte", "location": {"lat": 41.7500, "lng": -8.1667}, "address": "Gerês"},
    {"name": "Mata Nacional do Buçaco", "description": "Floresta histórica com a primeira lei florestal de Portugal (Bula Papal de 1643).", "region": "centro", "location": {"lat": 40.3767, "lng": -8.3667}, "address": "Luso"},
    {"name": "Floresta Laurissilva da Madeira", "description": "Relíquia terciária com 20 milhões de anos, Património Mundial da UNESCO.", "region": "madeira", "location": {"lat": 32.7500, "lng": -17.0000}, "address": "Madeira"},
    {"name": "Serra da Estrela", "description": "O ponto mais alto de Portugal continental, com paisagens alpinas e lago glaciar.", "region": "centro", "location": {"lat": 40.3217, "lng": -7.6114}, "address": "Serra da Estrela"},
    {"name": "Serra de Sintra", "description": "Serra romântica com palácios, jardins e floresta mágica.", "region": "lisboa", "location": {"lat": 38.7893, "lng": -9.4422}, "address": "Sintra"},
    {"name": "Serra de Monchique", "description": "A serra mais alta do Algarve, com floresta de sobreiros e medronheiros.", "region": "algarve", "location": {"lat": 37.3167, "lng": -8.5667}, "address": "Monchique"},
    {"name": "Serra da Arrábida", "description": "Serra calcária junto ao mar com vegetação mediterrânica única.", "region": "lisboa", "location": {"lat": 38.4833, "lng": -8.9833}, "address": "Arrábida"},
    {"name": "Parque Natural de Montesinho", "description": "Paisagem transmontana selvagem com lobos e aldeias tradicionais.", "region": "norte", "location": {"lat": 41.9000, "lng": -6.8333}, "address": "Bragança"},
    {"name": "Serra do Marão", "description": "Serra que divide o litoral do interior do Norte de Portugal.", "region": "norte", "location": {"lat": 41.2833, "lng": -7.9000}, "address": "Amarante"},
    {"name": "Montado Alentejano", "description": "Ecossistema único de sobreiros e azinheiras, habitat do lince-ibérico.", "region": "alentejo", "location": {"lat": 38.5667, "lng": -7.9167}, "address": "Alentejo"},
    {"name": "Pinhal de Leiria", "description": "Mata Nacional plantada por D. Dinis para proteger as terras agrícolas.", "region": "centro", "location": {"lat": 39.7500, "lng": -8.9167}, "address": "Marinha Grande"},
    {"name": "Serra da Lousã", "description": "Serra de xisto com aldeias recuperadas e paisagens dramáticas.", "region": "centro", "location": {"lat": 40.1000, "lng": -8.2333}, "address": "Lousã"},
]

# ========================
# RIOS E RIBEIRAS
# ========================
RIOS = [
    {"name": "Rio Douro", "description": "O rio do vinho, atravessa a região vinhateira mais antiga do mundo demarcada.", "region": "norte", "location": {"lat": 41.1418, "lng": -8.6103}, "address": "Porto a Barca d'Alva"},
    {"name": "Rio Tejo", "description": "O maior rio ibérico, nasce em Espanha e desagua em Lisboa.", "region": "lisboa", "location": {"lat": 38.6925, "lng": -9.2222}, "address": "Lisboa"},
    {"name": "Rio Guadiana", "description": "Rio fronteiriço que atravessa o Alentejo até ao Algarve.", "region": "alentejo", "location": {"lat": 37.1667, "lng": -7.4167}, "address": "Vila Real de Santo António"},
    {"name": "Rio Minho", "description": "Rio que marca a fronteira norte com a Galiza.", "region": "norte", "location": {"lat": 41.8667, "lng": -8.8500}, "address": "Caminha"},
    {"name": "Rio Mondego", "description": "O maior rio exclusivamente português, atravessa Coimbra.", "region": "centro", "location": {"lat": 40.2033, "lng": -8.4103}, "address": "Coimbra"},
    {"name": "Rio Lima", "description": "O 'rio do esquecimento' da mitologia romana.", "region": "norte", "location": {"lat": 41.7667, "lng": -8.5833}, "address": "Ponte de Lima"},
    {"name": "Rio Zêzere", "description": "Afluente do Tejo com praias fluviais e paisagens deslumbrantes.", "region": "centro", "location": {"lat": 39.4833, "lng": -8.3333}, "address": "Constância"},
    {"name": "Rio Cávado", "description": "Nasce na Serra do Larouco e atravessa paisagens do Gerês.", "region": "norte", "location": {"lat": 41.5833, "lng": -8.7500}, "address": "Esposende"},
    {"name": "Rio Paiva", "description": "Um dos rios mais limpos da Europa, com passadiços famosos.", "region": "norte", "location": {"lat": 40.9667, "lng": -8.2333}, "address": "Arouca"},
    {"name": "Rio Mira", "description": "Rio alentejano com estuário na costa vicentina.", "region": "alentejo", "location": {"lat": 37.7333, "lng": -8.7833}, "address": "Vila Nova de Milfontes"},
]

# ========================
# PISCINAS NATURAIS
# ========================
PISCINAS = [
    {"name": "Poço Azul de Montalegre", "description": "Piscina natural de águas cristalinas na Serra do Barroso.", "region": "norte", "location": {"lat": 41.8000, "lng": -7.8000}, "address": "Montalegre"},
    {"name": "Fisgas de Ermelo", "description": "Cascatas espetaculares do rio Olo, com quedas de 200 metros.", "region": "norte", "location": {"lat": 41.3500, "lng": -7.8667}, "address": "Mondim de Basto"},
    {"name": "Praia Fluvial de Loriga", "description": "Praia fluvial glaciar na Serra da Estrela, rodeada de montanhas.", "region": "centro", "location": {"lat": 40.3178, "lng": -7.6917}, "address": "Loriga, Serra da Estrela"},
    {"name": "Lagoa Comprida", "description": "Lagoa de origem glaciar na Serra da Estrela.", "region": "centro", "location": {"lat": 40.3500, "lng": -7.6333}, "address": "Serra da Estrela"},
    {"name": "Fragas de São Simão", "description": "Cascatas e piscinas naturais na Serra da Lousã.", "region": "centro", "location": {"lat": 40.1000, "lng": -8.2000}, "address": "Figueiró dos Vinhos"},
    {"name": "Pego do Inferno", "description": "Cascata e piscina natural escondida no interior algarvio.", "region": "algarve", "location": {"lat": 37.1500, "lng": -7.6500}, "address": "Tavira"},
    {"name": "Poça da Dona Beija", "description": "Piscinas de águas termais quentes nas Furnas.", "region": "acores", "location": {"lat": 37.7731, "lng": -25.3083}, "address": "Furnas, São Miguel"},
    {"name": "Caldeira Velha", "description": "Cascata de água quente termal em ambiente de floresta.", "region": "acores", "location": {"lat": 37.7667, "lng": -25.4667}, "address": "Ribeira Grande, São Miguel"},
    {"name": "Parque Terra Nostra", "description": "Jardim botânico com piscina termal histórica.", "region": "acores", "location": {"lat": 37.7730, "lng": -25.3100}, "address": "Furnas, São Miguel"},
    {"name": "Piscinas de Porto Moniz", "description": "Piscinas naturais de lava vulcânica junto ao mar.", "region": "madeira", "location": {"lat": 32.8667, "lng": -17.1667}, "address": "Porto Moniz, Madeira"},
    {"name": "Praia Fluvial de Vila Nova de Milfontes", "description": "Praia no estuário do Rio Mira.", "region": "alentejo", "location": {"lat": 37.7333, "lng": -8.7833}, "address": "Vila Nova de Milfontes"},
    {"name": "Albufeira do Azibo", "description": "Praia fluvial em barragem com bandeira azul.", "region": "norte", "location": {"lat": 41.5500, "lng": -6.9000}, "address": "Macedo de Cavaleiros"},
]

# ========================
# ROTAS TEMÁTICAS
# ========================
ROTAS_TEMATICAS = [
    # Rotas do Vinho
    {"name": "Rota dos Vinhos do Douro e Porto", "description": "Percurso pela região vinhateira mais antiga do mundo demarcada, com quintas, caves e paisagens Património Mundial.", "category": "vinho", "region": "norte"},
    {"name": "Rota dos Vinhos Verdes", "description": "Descoberta dos vinhos leves e frescos do Minho, entre paisagens verdejantes.", "category": "vinho", "region": "norte"},
    {"name": "Rota dos Vinhos do Dão", "description": "Vinhos elegantes da Beira Alta, entre granito e floresta.", "category": "vinho", "region": "centro"},
    {"name": "Rota dos Vinhos do Alentejo", "description": "Grandes vinhos encorpados das planícies alentejanas.", "category": "vinho", "region": "alentejo"},
    {"name": "Rota do Vinho da Madeira", "description": "Vinhos únicos envelhecidos pelo calor, uma tradição de 500 anos.", "category": "vinho", "region": "madeira"},
    {"name": "Rota do Vinho do Pico", "description": "Vinhedos em muros de pedra vulcânica, Património Mundial.", "category": "vinho", "region": "acores"},
    
    # Rotas do Pão e Azeite
    {"name": "Rota do Pão de Centeio", "description": "Tradições do pão de centeio nas serras do Norte.", "category": "pao", "region": "norte"},
    {"name": "Rota do Pão Alentejano", "description": "O famoso pão alentejano e os seus segredos.", "category": "pao", "region": "alentejo"},
    {"name": "Rota do Azeite Transmontano", "description": "Olivais milenares e lagares de Trás-os-Montes.", "category": "azeite", "region": "norte"},
    {"name": "Rota do Azeite do Alentejo", "description": "Olivais extensos e azeites premiados.", "category": "azeite", "region": "alentejo"},
    
    # Rotas Culturais
    {"name": "Rota das 12 Aldeias Históricas", "description": "Circuito pelas aldeias históricas da Beira Interior.", "category": "cultural", "region": "centro"},
    {"name": "Rota das Aldeias do Xisto", "description": "27 aldeias de xisto recuperadas na Serra da Lousã e Açor.", "category": "cultural", "region": "centro"},
    {"name": "Rota dos Castelos da Raia", "description": "Fortalezas medievais na fronteira com Espanha.", "category": "cultural", "region": "centro"},
    {"name": "Rota dos Mosteiros", "description": "Os grandes mosteiros de Portugal: Alcobaça, Batalha, Tomar.", "category": "religioso", "region": "centro"},
    {"name": "Rota da Arte Rupestre", "description": "Gravuras pré-históricas do Vale do Côa, Património Mundial.", "category": "arqueologia", "region": "norte"},
    
    # Rotas da Natureza
    {"name": "Rota Vicentina", "description": "Trilhos pedestres ao longo da costa mais bem preservada da Europa.", "category": "natureza", "region": "alentejo"},
    {"name": "Passadiços do Paiva", "description": "8 km de passadiços de madeira ao longo do Rio Paiva.", "category": "natureza", "region": "norte"},
    {"name": "Trilhos da Serra da Estrela", "description": "Percursos pela montanha mais alta de Portugal continental.", "category": "natureza", "region": "centro"},
    {"name": "Levadas da Madeira", "description": "Percursos ao longo dos canais de irrigação centenários.", "category": "natureza", "region": "madeira"},
    {"name": "Rota dos Miradouros dos Açores", "description": "Os melhores pontos de vista das ilhas açorianas.", "category": "natureza", "region": "acores"},
]

# ========================
# TURISMO RELIGIOSO
# ========================
RELIGIOSO = [
    {"name": "Santuário de Fátima", "description": "Um dos maiores centros de peregrinação católica do mundo. Local das aparições de Nossa Senhora em 1917.", "region": "centro", "location": {"lat": 39.6317, "lng": -8.6747}, "address": "Fátima"},
    {"name": "Santuário do Bom Jesus do Monte", "description": "Escadório barroco monumental em Braga, Património Mundial da UNESCO.", "region": "norte", "location": {"lat": 41.5547, "lng": -8.3769}, "address": "Braga"},
    {"name": "Sé de Braga", "description": "A catedral mais antiga de Portugal, fundada no século XI.", "region": "norte", "location": {"lat": 41.5500, "lng": -8.4200}, "address": "Braga"},
    {"name": "Mosteiro dos Jerónimos", "description": "Obra-prima do estilo Manuelino, Património Mundial da UNESCO.", "region": "lisboa", "location": {"lat": 38.6979, "lng": -9.2068}, "address": "Belém, Lisboa"},
    {"name": "Mosteiro de Alcobaça", "description": "Fundado em 1153, guarda os túmulos de D. Pedro e Inês de Castro.", "region": "centro", "location": {"lat": 39.5483, "lng": -8.9786}, "address": "Alcobaça"},
    {"name": "Mosteiro da Batalha", "description": "Construído para celebrar a vitória de Aljubarrota, Património Mundial.", "region": "centro", "location": {"lat": 39.6600, "lng": -8.8247}, "address": "Batalha"},
    {"name": "Convento de Cristo", "description": "Sede dos Templários e dos Cavaleiros de Cristo, Património Mundial.", "region": "centro", "location": {"lat": 39.6014, "lng": -8.4111}, "address": "Tomar"},
    {"name": "Igreja de São Francisco", "description": "Igreja com a impressionante Capela dos Ossos em Évora.", "region": "alentejo", "location": {"lat": 38.5719, "lng": -7.9097}, "address": "Évora"},
    {"name": "Santuário do Sameiro", "description": "O segundo maior santuário mariano de Portugal, em Braga.", "region": "norte", "location": {"lat": 41.5333, "lng": -8.3667}, "address": "Braga"},
    {"name": "Igreja do Senhor Santo Cristo", "description": "Centro da maior romaria dos Açores, em Ponta Delgada.", "region": "acores", "location": {"lat": 37.7394, "lng": -25.6687}, "address": "Ponta Delgada, São Miguel"},
]

# ========================
# FAUNA E FLORA
# ========================
FAUNA_FLORA = [
    {"name": "Lobo-ibérico", "description": "O maior predador terrestre de Portugal, presente no Norte e Centro.", "region": "norte", "subcategory": "fauna", "location": {"lat": 41.8000, "lng": -6.7500}},
    {"name": "Lince-ibérico", "description": "O felino mais ameaçado do mundo, em recuperação no Alentejo.", "region": "alentejo", "subcategory": "fauna", "location": {"lat": 37.7333, "lng": -7.4333}},
    {"name": "Águia-imperial-ibérica", "description": "Rapina rara que nidifica nos montados alentejanos.", "region": "alentejo", "subcategory": "fauna", "location": {"lat": 38.5667, "lng": -7.9167}},
    {"name": "Garrano", "description": "Cavalo selvagem do Gerês, raça autóctone portuguesa.", "region": "norte", "subcategory": "fauna", "location": {"lat": 41.7500, "lng": -8.1667}},
    {"name": "Priolo", "description": "Ave endémica dos Açores, uma das mais raras da Europa.", "region": "acores", "subcategory": "fauna", "location": {"lat": 37.7667, "lng": -25.1500}},
    {"name": "Cagarra", "description": "Ave marinha emblemática dos Açores.", "region": "acores", "subcategory": "fauna", "location": {"lat": 37.7394, "lng": -25.6687}},
    {"name": "Baleia-azul", "description": "O maior animal do planeta, avistado nos mares dos Açores.", "region": "acores", "subcategory": "fauna", "location": {"lat": 38.4667, "lng": -28.2667}},
    {"name": "Sobreiro", "description": "A árvore símbolo de Portugal, de onde se extrai a cortiça.", "region": "alentejo", "subcategory": "flora", "location": {"lat": 38.5667, "lng": -7.9167}},
    {"name": "Azinheira", "description": "Árvore do montado que produz as bolotas que alimentam os porcos.", "region": "alentejo", "subcategory": "flora", "location": {"lat": 38.5667, "lng": -7.9167}},
    {"name": "Til da Laurissilva", "description": "Árvore endémica da floresta Laurissilva da Madeira.", "region": "madeira", "subcategory": "flora", "location": {"lat": 32.7500, "lng": -17.0000}},
    {"name": "Hortênsia dos Açores", "description": "Flor símbolo dos Açores, que pinta as ilhas de azul.", "region": "acores", "subcategory": "flora", "location": {"lat": 37.7394, "lng": -25.6687}},
    {"name": "Estrelícia", "description": "Ave-do-paraíso, flor icónica da Madeira.", "region": "madeira", "subcategory": "flora", "location": {"lat": 32.6669, "lng": -16.9241}},
]

# ========================
# ARTE PORTUGUESA
# ========================
ARTE = [
    {"name": "Estilo Manuelino", "description": "Estilo arquitetónico português único, com motivos marítimos e descobrimentos.", "region": "lisboa", "subcategory": "arquitetura", "location": {"lat": 38.6979, "lng": -9.2068}},
    {"name": "Azulejaria Portuguesa", "description": "Arte da cerâmica vidrada que decora Portugal desde o século XV.", "region": "lisboa", "subcategory": "artes_decorativas", "location": {"lat": 38.7223, "lng": -9.1393}},
    {"name": "Pintura Portuguesa - Painéis de São Vicente", "description": "Obra-prima de Nuno Gonçalves, retrato da sociedade portuguesa do século XV.", "region": "lisboa", "subcategory": "pintura", "location": {"lat": 38.7139, "lng": -9.1456}},
    {"name": "Escultura em Calcário de Ançã", "description": "Tradição escultórica em pedra calcária branca de Coimbra.", "region": "centro", "subcategory": "escultura", "location": {"lat": 40.2033, "lng": -8.4103}},
    {"name": "Talha Dourada Barroca", "description": "Arte da madeira entalhada e dourada nas igrejas barrocas.", "region": "norte", "subcategory": "artes_decorativas", "location": {"lat": 41.1579, "lng": -8.6291}},
    {"name": "Olaria de Bordallo Pinheiro", "description": "Cerâmica artística das Caldas da Rainha, famosa pelas peças naturalistas.", "region": "centro", "subcategory": "ceramica", "location": {"lat": 39.4036, "lng": -9.1389}},
    {"name": "Natureza-Morta Portuguesa", "description": "Tradição pictórica de representação de objetos e alimentos.", "region": "lisboa", "subcategory": "pintura", "location": {"lat": 38.7223, "lng": -9.1393}},
    {"name": "Calçada Portuguesa", "description": "Arte de pavimentação em pedra calcária branca e negra.", "region": "lisboa", "subcategory": "artes_decorativas", "location": {"lat": 38.7139, "lng": -9.1397}},
    {"name": "Guitarra Portuguesa", "description": "Instrumento de 12 cordas usado no Fado, símbolo musical de Portugal.", "region": "lisboa", "subcategory": "musica", "location": {"lat": 38.7139, "lng": -9.1289}},
    {"name": "Paula Rego - Arte Contemporânea", "description": "Uma das maiores artistas portuguesas contemporâneas.", "region": "lisboa", "subcategory": "pintura", "location": {"lat": 38.6972, "lng": -9.4209}},
]

# ========================
# COGUMELOS
# ========================
COGUMELOS = [
    {"name": "Boletus edulis - Porcini", "description": "O rei dos cogumelos, muito apreciado na gastronomia portuguesa.", "region": "norte", "subcategory": "comestivel", "location": {"lat": 41.8000, "lng": -6.7500}},
    {"name": "Lactarius deliciosus - Míscaro", "description": "Cogumelo laranja comestível muito popular em Trás-os-Montes.", "region": "norte", "subcategory": "comestivel", "location": {"lat": 41.8000, "lng": -6.7500}},
    {"name": "Amanita caesarea - Ovo-de-rei", "description": "Considerado o melhor cogumelo do mundo desde a Roma Antiga.", "region": "norte", "subcategory": "comestivel", "location": {"lat": 41.8000, "lng": -6.7500}},
    {"name": "Macrolepiota procera - Parasol", "description": "Cogumelo grande e saboroso, muito apreciado panado.", "region": "centro", "subcategory": "comestivel", "location": {"lat": 40.3217, "lng": -7.6114}},
    {"name": "Craterellus cornucopioides - Trompeta-negra", "description": "Cogumelo negro aromático, excelente em risottos.", "region": "norte", "subcategory": "comestivel", "location": {"lat": 41.8000, "lng": -6.7500}},
    {"name": "Amanita phalloides - Cicuta-verde", "description": "MORTAL - Responsável pela maioria das mortes por cogumelos. Não colher!", "region": "norte", "subcategory": "toxico", "location": {"lat": 41.8000, "lng": -6.7500}},
    {"name": "Festival Micológico de Montemor-o-Novo", "description": "Evento anual de celebração dos cogumelos no Alentejo.", "region": "alentejo", "subcategory": "evento", "location": {"lat": 38.6500, "lng": -8.2167}},
]

# ========================
# ARQUEOLOGIA
# ========================
ARQUEOLOGIA = [
    {"name": "Gravuras do Vale do Côa", "description": "Maior conjunto de arte rupestre paleolítica ao ar livre do mundo, Património Mundial.", "region": "norte", "location": {"lat": 41.0833, "lng": -7.1167}, "address": "Vila Nova de Foz Côa"},
    {"name": "Cromeleque dos Almendres", "description": "O maior cromeleque da Península Ibérica, mais antigo que Stonehenge.", "region": "alentejo", "location": {"lat": 38.5500, "lng": -8.0667}, "address": "Évora"},
    {"name": "Citânia de Briteiros", "description": "Povoado da Idade do Ferro, um dos mais importantes da cultura castreja.", "region": "norte", "location": {"lat": 41.5167, "lng": -8.3167}, "address": "Guimarães"},
    {"name": "Ruínas de Conímbriga", "description": "Uma das maiores cidades romanas de Portugal, com mosaicos espetaculares.", "region": "centro", "location": {"lat": 40.1000, "lng": -8.4833}, "address": "Condeixa-a-Nova"},
    {"name": "Templo Romano de Évora", "description": "Templo do século I, erroneamente chamado de 'Templo de Diana'.", "region": "alentejo", "location": {"lat": 38.5719, "lng": -7.9097}, "address": "Évora"},
    {"name": "Pegadas de Dinossauros", "description": "Trilho de pegadas de saurópodes na Serra de Aire.", "region": "centro", "location": {"lat": 39.5333, "lng": -8.7000}, "address": "Ourém"},
    {"name": "Anta Grande do Zambujeiro", "description": "O maior dólmen da Península Ibérica.", "region": "alentejo", "location": {"lat": 38.5667, "lng": -7.9500}, "address": "Évora"},
    {"name": "Ruínas Romanas de Milreu", "description": "Villa romana com templo e termas no Algarve.", "region": "algarve", "location": {"lat": 37.0500, "lng": -7.9833}, "address": "Estói"},
    {"name": "Castro de Santa Trega", "description": "Povoado celta com vista sobre a foz do Minho.", "region": "norte", "location": {"lat": 41.8833, "lng": -8.8667}, "address": "Caminha (fronteira)"},
]

# ========================
# TERMAS E PRAIAS
# ========================
TERMAS = [
    {"name": "Termas de São Pedro do Sul", "description": "As termas mais antigas e visitadas de Portugal, frequentadas desde os Romanos.", "region": "centro", "location": {"lat": 40.7500, "lng": -8.0833}, "address": "São Pedro do Sul"},
    {"name": "Termas de Vidago", "description": "Termas de luxo no Norte de Portugal, com hotel palácio.", "region": "norte", "location": {"lat": 41.6500, "lng": -7.5833}, "address": "Vidago"},
    {"name": "Termas de Gerês", "description": "Termas no coração do Parque Nacional, rodeadas de natureza.", "region": "norte", "location": {"lat": 41.7333, "lng": -8.1667}, "address": "Gerês"},
    {"name": "Termas de Chaves", "description": "Águas termais mais quentes da Europa (73°C).", "region": "norte", "location": {"lat": 41.7333, "lng": -7.4667}, "address": "Chaves"},
    {"name": "Termas do Luso", "description": "Famosas águas minerais junto à Mata do Buçaco.", "region": "centro", "location": {"lat": 40.3767, "lng": -8.3667}, "address": "Luso"},
    {"name": "Praia da Costa Nova", "description": "Praia famosa pelas casas às riscas coloridas.", "region": "centro", "location": {"lat": 40.6167, "lng": -8.7500}, "address": "Ílhavo"},
    {"name": "Praia da Nazaré", "description": "Praia famosa pelas ondas gigantes e tradição piscatória.", "region": "centro", "location": {"lat": 39.6017, "lng": -9.0714}, "address": "Nazaré"},
    {"name": "Praia de Benagil", "description": "Praia com a famosa gruta marinha, ícone do Algarve.", "region": "algarve", "location": {"lat": 37.0875, "lng": -8.4269}, "address": "Lagoa"},
    {"name": "Praia da Comporta", "description": "Praia selvagem e elegante no litoral alentejano.", "region": "alentejo", "location": {"lat": 38.3833, "lng": -8.8000}, "address": "Comporta"},
    {"name": "Porto Santo", "description": "Praia de areia dourada com 9 km, propriedades terapêuticas.", "region": "madeira", "location": {"lat": 33.0667, "lng": -16.3333}, "address": "Porto Santo"},
]

async def seed_database():
    """Seed the database with all heritage data"""
    print("Starting database seeding...")
    
    # Clear existing data
    print("Clearing existing data...")
    await db.heritage_items.delete_many({})
    await db.routes.delete_many({})
    
    # Helper function to create heritage item
    def create_item(data, category):
        return {
            "id": str(uuid.uuid4()),
            "name": data["name"],
            "description": data["description"],
            "category": category,
            "subcategory": data.get("subcategory"),
            "region": data["region"],
            "location": data.get("location"),
            "address": data.get("address"),
            "tags": [category, data["region"]],
            "metadata": {},
            "created_at": datetime.now(timezone.utc)
        }
    
    # Insert all categories
    all_items = []
    
    # Lendas
    print("Adding legends...")
    for item in LENDAS:
        all_items.append(create_item(item, "lendas"))
    
    # Festas
    print("Adding festivals...")
    for item in FESTAS:
        all_items.append(create_item(item, "festas"))
    
    # Saberes
    print("Adding crafts and knowledge...")
    for item in SABERES:
        all_items.append(create_item(item, "saberes"))
    
    # Crenças
    print("Adding beliefs...")
    for item in CRENCAS:
        all_items.append(create_item(item, "crencas"))
    
    # Gastronomia
    print("Adding gastronomy...")
    for item in GASTRONOMIA:
        all_items.append(create_item(item, "gastronomia"))
    
    # Produtos
    print("Adding regional products...")
    for item in PRODUTOS:
        all_items.append(create_item(item, "produtos"))
    
    # Aldeias
    print("Adding historic villages...")
    for item in ALDEIAS:
        all_items.append(create_item(item, "aldeias"))
    
    # Florestas
    print("Adding forests and mountains...")
    for item in FLORESTAS:
        all_items.append(create_item(item, "florestas"))
    
    # Rios
    print("Adding rivers...")
    for item in RIOS:
        all_items.append(create_item(item, "rios"))
    
    # Piscinas
    print("Adding natural pools...")
    for item in PISCINAS:
        all_items.append(create_item(item, "piscinas"))
    
    # Religioso
    print("Adding religious sites...")
    for item in RELIGIOSO:
        all_items.append(create_item(item, "religioso"))
    
    # Fauna e Flora
    print("Adding fauna and flora...")
    for item in FAUNA_FLORA:
        all_items.append(create_item(item, "fauna"))
    
    # Arte
    print("Adding Portuguese art...")
    for item in ARTE:
        all_items.append(create_item(item, "arte"))
    
    # Cogumelos
    print("Adding mushrooms...")
    for item in COGUMELOS:
        all_items.append(create_item(item, "cogumelos"))
    
    # Arqueologia
    print("Adding archaeology...")
    for item in ARQUEOLOGIA:
        all_items.append(create_item(item, "arqueologia"))
    
    # Termas
    print("Adding thermal baths and beaches...")
    for item in TERMAS:
        all_items.append(create_item(item, "termas"))
    
    # Insert all items
    print(f"Inserting {len(all_items)} heritage items...")
    if all_items:
        await db.heritage_items.insert_many(all_items)
    
    # Insert routes
    print("Adding thematic routes...")
    routes = []
    for route_data in ROTAS_TEMATICAS:
        routes.append({
            "id": str(uuid.uuid4()),
            "name": route_data["name"],
            "description": route_data["description"],
            "category": route_data["category"],
            "region": route_data.get("region"),
            "items": [],
            "tags": [route_data["category"]],
            "created_at": datetime.now(timezone.utc)
        })
    
    if routes:
        await db.routes.insert_many(routes)
    
    print(f"Database seeded successfully!")
    print(f"Total items: {len(all_items)}")
    print(f"Total routes: {len(routes)}")
    
    # Print summary by category
    print("\nSummary by category:")
    categories_count = {}
    for item in all_items:
        cat = item["category"]
        categories_count[cat] = categories_count.get(cat, 0) + 1
    
    for cat, count in sorted(categories_count.items()):
        print(f"  {cat}: {count}")

if __name__ == "__main__":
    asyncio.run(seed_database())
