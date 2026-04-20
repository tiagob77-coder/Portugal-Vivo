"""
Script para popular a base de dados com dados das Termas e Balneários de Portugal
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Descrição geral da categoria Termas e Balneários
TERMAS_CATEGORY_DESCRIPTION = """
Portugal possui uma das maiores tradições termais da Europa, com fontes medicinais utilizadas desde a época romana. As águas termais portuguesas são reconhecidas pelas suas propriedades terapêuticas únicas, oferecendo tratamentos para problemas respiratórios, reumáticos, dermatológicos e muito mais.

Desde as águas sulfurosas do Norte às nascentes alcalinas do Sul, cada estância termal oferece uma experiência única de bem-estar, combinando a tradição milenar com modernos tratamentos de SPA. Muitas das nossas termas estão situadas em locais de beleza natural extraordinária, proporcionando o ambiente perfeito para relaxamento e recuperação.

A maioria das termas tem uma época termal principal (geralmente entre março/abril e outubro/novembro), mas muitas operam todo o ano, especialmente os SPAs. Recomenda-se sempre verificar horários e disponibilidades diretamente com cada estabelecimento.
"""

# Dados das Termas e Balneários
TERMAS_DATA = [
    # Norte de Portugal
    {
        "name": "Balneário Pedagógico de Vidago",
        "description": "A fama dos poderes curativos das águas espalhou-se tão longe que em 1876-1889 foram premiadas em Madrid, Paris, Viena e Rio de Janeiro. No reinado de D. Carlos I, Vidago tornou-se um dos destinos termais mais prestigiados de Portugal, atraindo a aristocracia europeia.",
        "region": "norte",
        "address": "Vidago, Vila Real",
        "location": {"lat": 41.6333, "lng": -7.5833},
        "tags": ["águas premiadas", "histórico", "termalismo clássico", "Vila Real"],
        "metadata": {"district": "Vila Real", "water_type": "gasocarbónica", "specialties": ["tratamentos digestivos", "metabolismo"]}
    },
    {
        "name": "Caldas da Rainha",
        "description": "O Hospital Termal das Caldas da Rainha, fundado em 1485 pela Rainha D. Leonor, é considerado o hospital termal mais antigo do mundo, com uma história única de mais de 500 anos de tradição termal. As suas águas sulfurosas são especialmente indicadas para problemas respiratórios e reumáticos.",
        "region": "centro",
        "address": "Caldas da Rainha, Leiria",
        "location": {"lat": 39.4030, "lng": -9.1363},
        "tags": ["hospital termal", "D. Leonor", "histórico", "Leiria", "mais antigo do mundo"],
        "metadata": {"district": "Leiria", "founded": "1485", "water_type": "sulfurosa", "specialties": ["reumatismo", "respiratório"]}
    },
    {
        "name": "Termas da Curia",
        "description": "A propriedade é constituída por uma área vedada de cerca de 14 hectares, no interior da qual se situam as Termas da Curia (estabelecimento Termal e SPA). O complexo inclui um grande parque com lago, campos de ténis e golfe, proporcionando uma experiência completa de lazer e bem-estar.",
        "region": "centro",
        "address": "Curia, Aveiro",
        "location": {"lat": 40.3728, "lng": -8.4603},
        "tags": ["parque", "lago", "golfe", "ténis", "Aveiro", "SPA"],
        "metadata": {"district": "Aveiro", "area_hectares": 14, "facilities": ["golf", "tennis", "lake"], "specialties": ["circulação", "pele"]}
    },
    {
        "name": "Termas da Fadagosa de Nisa",
        "description": "As Termas da Fadagosa de Nisa são uma nascente termal de água sulfurosa especialmente procurada pelo seu valor terapêutico no tratamento de problemas de pele, reumáticos e respiratórios. Situadas no coração do Alentejo, oferecem um ambiente tranquilo e rural.",
        "region": "alentejo",
        "address": "Nisa, Portalegre",
        "location": {"lat": 39.5167, "lng": -7.6500},
        "tags": ["sulfurosa", "pele", "reumatismo", "Portalegre", "Alentejo"],
        "metadata": {"district": "Portalegre", "water_type": "sulfurosa", "specialties": ["dermatologia", "reumatismo", "respiratório"]}
    },
    {
        "name": "Termas da Ladeira de Envendos",
        "description": "Enquadradas pela beleza agreste dos montes que a rodeiam, as Termas da Ladeira de Envendos oferecem um conjunto de práticas termais que utilizam, de forma complementar, os recursos naturais locais para promover a saúde e o bem-estar dos seus visitantes.",
        "region": "centro",
        "address": "Envendos, Santarém",
        "location": {"lat": 39.4833, "lng": -7.9167},
        "tags": ["natureza", "bem-estar", "Santarém", "ambiente rural"],
        "metadata": {"district": "Santarém", "specialties": ["bem-estar", "relaxamento"]}
    },
    {
        "name": "Termas da Piedade",
        "description": "Perde-se no tempo a origem da utilização das águas que futuramente vieram a dar origem às atuais Termas da Piedade, em Alcobaça. A utilização das águas remonta a tempos ancestrais, sendo conhecidas pelas suas propriedades curativas para problemas de pele e reumáticos.",
        "region": "centro",
        "address": "Alcobaça, Leiria",
        "location": {"lat": 39.5481, "lng": -8.9772},
        "tags": ["ancestral", "pele", "reumatismo", "Leiria", "Alcobaça"],
        "metadata": {"district": "Leiria", "specialties": ["dermatologia", "reumatismo"]}
    },
    {
        "name": "Termas das Caldas da Saúde",
        "description": "As Termas das Caldas da Saúde são um balneário termal que desde 1891 têm oferecido aos seus clientes as vantagens da sua água mineral natural! Com águas sulfúreas indicadas para tratamentos respiratórios e reumáticos, são uma referência no Norte de Portugal.",
        "region": "norte",
        "address": "Caldas da Saúde, Porto",
        "location": {"lat": 41.3833, "lng": -8.4667},
        "tags": ["sulfúreas", "respiratório", "reumático", "Porto", "desde 1891"],
        "metadata": {"district": "Porto", "founded": "1891", "water_type": "sulfúrea", "specialties": ["respiratório", "reumático"]}
    },
    {
        "name": "Termas das Pedras Salgadas",
        "description": "O SPA TERMAL de Pedras Salgadas é um local propício ao descanso e relaxamento. Inserido num belo parque, o histórico edifício do SPA Termal de Pedras Salgadas dispõe de água mineral natural gasocarbónica e um SPA com 14 salas de tratamento.",
        "region": "norte",
        "address": "Pedras Salgadas, Vila Real",
        "location": {"lat": 41.5333, "lng": -7.6000},
        "tags": ["SPA", "parque natural", "gasocarbónica", "Vila Real", "14 salas"],
        "metadata": {"district": "Vila Real", "water_type": "gasocarbónica", "spa_rooms": 14, "specialties": ["digestivo", "metabolismo"]}
    },
    {
        "name": "Termas das Taipas",
        "description": "A primeira utilização conhecida das águas medicinais das Taipas como agentes terapêuticos remonta à época da Romanização, durante o império de Trajano. Hoje, dispõe de um moderno centro de fisioterapia associado às práticas termais tradicionais.",
        "region": "norte",
        "address": "Caldas das Taipas, Braga",
        "location": {"lat": 41.5167, "lng": -8.4000},
        "tags": ["romano", "fisioterapia", "Braga", "histórico", "Trajano"],
        "metadata": {"district": "Braga", "origin": "romana", "specialties": ["fisioterapia", "reumatismo"]}
    },
    {
        "name": "Termas da Sulfúrea - Cabeço de Vide",
        "description": "Num espaço onde se respira Natureza surge um moderno e confortável balneário, onde a comodidade e o bem-estar físico e psíquico andam de mãos dadas. As águas sulfurosas são raras, com pH elevado de 11.5, de grande interesse científico.",
        "region": "alentejo",
        "address": "Cabeço de Vide, Portalegre",
        "location": {"lat": 39.1000, "lng": -7.5500},
        "tags": ["sulfurosa", "pH elevado", "científico", "Portalegre", "Alentejo"],
        "metadata": {"district": "Portalegre", "water_type": "sulfurosa", "ph": 11.5, "specialties": ["dermatologia", "interesse científico"]}
    },
    {
        "name": "Termas de Águas - Penamacor",
        "description": "As Termas Fonte Santa situam-se numa zona calma e bucólica, ideal para o relaxamento e escape do stress urbano. Apenas a 7 km da sede do concelho, oferecem um ambiente perfeito para tratamentos termais em contacto com a natureza.",
        "region": "centro",
        "address": "Penamacor, Castelo Branco",
        "location": {"lat": 40.1667, "lng": -7.1667},
        "tags": ["Fonte Santa", "relaxamento", "Castelo Branco", "natureza"],
        "metadata": {"district": "Castelo Branco", "specialties": ["relaxamento", "stress"]}
    },
    {
        "name": "Termas de Alcafache",
        "description": "As Termas de Alcafache são uma tranquila e aprazível estância de tratamento, lazer e repouso, com um clima ameno. Ficam bem no centro da Beira Alta. A água sulfúrea é das mais quentes de Portugal, emergindo a 50ºC. Funcionam de abril a novembro.",
        "region": "centro",
        "address": "Alcafache, Viseu",
        "location": {"lat": 40.6167, "lng": -7.8833},
        "tags": ["sulfúrea", "água quente", "50ºC", "Viseu", "Beira Alta"],
        "metadata": {"district": "Viseu", "water_type": "sulfúrea", "temperature": "50ºC", "season": "abril-novembro", "specialties": ["reumatismo", "respiratório"]}
    },
    {
        "name": "Termas de Almeida - Fonte Santa",
        "description": "As águas minerais do complexo termal de Almeida brotam nas escarpas dos montes que formam o vale por onde corre o Rio Côa a uma altitude de 560m, oferecendo vistas deslumbrantes e um ambiente de montanha único.",
        "region": "centro",
        "address": "Almeida, Guarda",
        "location": {"lat": 40.7333, "lng": -6.9000},
        "tags": ["Rio Côa", "montanha", "Guarda", "altitude"],
        "metadata": {"district": "Guarda", "altitude": "560m", "specialties": ["reumatismo", "bem-estar"]}
    },
    {
        "name": "Termas de Amarante",
        "description": "A primeira grande referência histórica às águas mineromedicinais de Amarante surge no Aquilégio Medicinal de Francisco da Fonseca Henriques, em 1726. Dispõe de piscina de água termal aquecida, jacuzzi e banho turco.",
        "region": "norte",
        "address": "Amarante, Porto",
        "location": {"lat": 41.2667, "lng": -8.0833},
        "tags": ["piscina termal", "jacuzzi", "banho turco", "Porto", "histórico"],
        "metadata": {"district": "Porto", "first_reference": "1726", "facilities": ["piscina", "jacuzzi", "banho turco"], "specialties": ["circulação", "relaxamento"]}
    },
    {
        "name": "Termas de Aregos",
        "description": "As Termas das Caldas de Aregos são reconhecidas pelo valor medicinal das suas águas naturais, captadas a 62ºC, que durante séculos de história fizeram desta estância um local de referência para tratamentos de saúde.",
        "region": "centro",
        "address": "Caldas de Aregos, Viseu",
        "location": {"lat": 41.0500, "lng": -7.9333},
        "tags": ["62ºC", "medicinal", "Viseu", "histórico"],
        "metadata": {"district": "Viseu", "temperature": "62ºC", "specialties": ["reumatismo", "respiratório"]}
    },
    {
        "name": "Termas de Caldelas",
        "description": "Caldelas está em pleno coração do Minho, no concelho de Amares entre Braga e o Gerês, envolvida por uma paisagem verde. É um ótimo destino para fugir ao stress e desfrutar de momentos de relaxamento em contacto com a natureza.",
        "region": "norte",
        "address": "Caldelas, Braga",
        "location": {"lat": 41.6500, "lng": -8.2833},
        "tags": ["Minho", "Gerês", "natureza", "Braga", "relaxamento"],
        "metadata": {"district": "Braga", "near": "Gerês", "specialties": ["relaxamento", "bem-estar"]}
    },
    {
        "name": "Termas de Carvalhelhos",
        "description": "Situadas a 800m de altitude, no sopé de um castro pré-romano e envoltas pelo frondoso parque das serras do Barroso, as Termas de Carvalhelhos (ditas de Carvalhelhos) oferecem um ambiente único de montanha e história.",
        "region": "norte",
        "address": "Carvalhelhos, Vila Real",
        "location": {"lat": 41.7667, "lng": -7.7500},
        "tags": ["altitude", "castro pré-romano", "Barroso", "Vila Real", "montanha"],
        "metadata": {"district": "Vila Real", "altitude": "800m", "specialties": ["respiratório", "reumatismo"]}
    },
    {
        "name": "Termas de Chaves",
        "description": "As Termas de Chaves têm uma tradição milenar que remonta ao Império Romano. Integradas no centro urbano de Chaves, conjugam as virtudes da água termal com a conveniência de uma localização central e fácil acesso.",
        "region": "norte",
        "address": "Chaves, Vila Real",
        "location": {"lat": 41.7400, "lng": -7.4717},
        "tags": ["romano", "centro urbano", "Vila Real", "milenar"],
        "metadata": {"district": "Vila Real", "origin": "romana", "specialties": ["reumatismo", "digestivo"]}
    },
    {
        "name": "Termas de Entre-os-Rios",
        "description": "As Termas situam-se na província de Entre-o-Douro e Minho. O Inatel Entre-os-Rios, com a sua Estância Termal centenária, beneficia de um panorama deslumbrante sobre a confluência dos rios Douro e Tâmega.",
        "region": "norte",
        "address": "Entre-os-Rios, Porto",
        "location": {"lat": 41.0833, "lng": -8.2833},
        "tags": ["Douro", "Tâmega", "panorama", "Porto", "centenária"],
        "metadata": {"district": "Porto", "rivers": ["Douro", "Tâmega"], "specialties": ["respiratório", "relaxamento"]}
    },
    {
        "name": "Termas de Longroiva",
        "description": "As Termas de Longroiva são uma tranquila e aprazível estância de reconhecidas qualidades terapêuticas, proporcionando saúde e bem-estar. Localizadas junto ao castelo medieval, oferecem um ambiente histórico único.",
        "region": "centro",
        "address": "Longroiva, Guarda",
        "location": {"lat": 40.9667, "lng": -7.2167},
        "tags": ["castelo medieval", "terapêutico", "Guarda", "histórico"],
        "metadata": {"district": "Guarda", "specialties": ["reumatismo", "dermatologia"]}
    },
    {
        "name": "Termas de Luso",
        "description": "As Termas de Luso, totalmente renovadas e requalificadas, imprimem uma nova dinâmica de termalismo a nível nacional, através de um conceito inovador. O edifício foi projetado por Gustave Eiffel e está rodeado pela magnífica floresta do Buçaco.",
        "region": "centro",
        "address": "Luso, Aveiro",
        "location": {"lat": 40.3833, "lng": -8.3833},
        "tags": ["Gustave Eiffel", "Buçaco", "renovado", "Aveiro", "inovador"],
        "metadata": {"district": "Aveiro", "architect": "Gustave Eiffel", "near": "Buçaco", "specialties": ["circulação", "hipertensão"]}
    },
    {
        "name": "Termas de Manteigas",
        "description": "Inseridas na Região Hidrotermal de Montanha, a água mineral das Termas de Manteigas é captada a cerca de 100 metros de profundidade, o que lhe garante pureza e propriedades terapêuticas excecionais no coração da Serra da Estrela.",
        "region": "centro",
        "address": "Manteigas, Guarda",
        "location": {"lat": 40.4000, "lng": -7.5333},
        "tags": ["Serra da Estrela", "montanha", "Guarda", "100m profundidade"],
        "metadata": {"district": "Guarda", "depth": "100m", "near": "Serra da Estrela", "specialties": ["respiratório", "dermatologia"]}
    },
    {
        "name": "Termas de Monchique",
        "description": "Situada no coração da Serra de Monchique, esta exclusiva Villa Termal é constituída por hotéis em edifícios históricos recuperados, Piscina Exterior de Água Termal e SPA. A água é rica em bicarbonato e sódio, a apenas 20 km da praia.",
        "region": "algarve",
        "address": "Monchique, Faro",
        "location": {"lat": 37.3167, "lng": -8.5500},
        "tags": ["Serra de Monchique", "Villa Termal", "SPA", "Faro", "Algarve"],
        "metadata": {"district": "Faro", "water_type": "bicarbonato-sódica", "distance_beach": "20km", "specialties": ["pele", "respiratório"]}
    },
    {
        "name": "Termas de Monfortinho",
        "description": "Uma das mais antigas fontes termais do país, a Fonte Santa, encontra-se num lugar paradisíaco, cheio de cultura e lazer. Esta fonte é considerada uma das melhores da Península Ibérica para tratamentos de problemas de pele.",
        "region": "centro",
        "address": "Monfortinho, Castelo Branco",
        "location": {"lat": 39.9667, "lng": -6.9000},
        "tags": ["Fonte Santa", "pele", "Castelo Branco", "Península Ibérica", "antigas"],
        "metadata": {"district": "Castelo Branco", "specialties": ["dermatologia", "pele"], "recognition": "melhor da Península Ibérica"}
    },
    {
        "name": "Termas de Monte Real",
        "description": "As Termas de Monte Real, integradas no Resort Monte Real, encontram-se temporariamente encerradas com vista à realização de um projeto de remodelação que irá elevar ainda mais a qualidade dos serviços oferecidos.",
        "region": "centro",
        "address": "Monte Real, Leiria",
        "location": {"lat": 39.8500, "lng": -8.8500},
        "tags": ["resort", "remodelação", "Leiria"],
        "metadata": {"district": "Leiria", "status": "em remodelação", "specialties": ["respiratório", "reumatismo"]}
    },
    {
        "name": "Termas de Sangemil",
        "description": "As Termas de Sangemil localizam-se na freguesia de Lajeosa do Dão, junto à margem do rio Dão, no Concelho de Tondela, Distrito de Viseu. A época termal decorre de abril a novembro, num ambiente de grande beleza natural.",
        "region": "centro",
        "address": "Sangemil, Viseu",
        "location": {"lat": 40.5333, "lng": -8.0000},
        "tags": ["rio Dão", "Tondela", "Viseu", "natureza"],
        "metadata": {"district": "Viseu", "river": "Dão", "season": "abril-novembro", "specialties": ["reumatismo", "respiratório"]}
    },
    {
        "name": "Termas de São Jorge",
        "description": "Na Vila de Caldas de S. Jorge, a 25 km do Porto, encontrará o refúgio ideal para recuperar o seu equilíbrio físico e psicológico, face às tensões do quotidiano. Ambiente tranquilo e familiar.",
        "region": "centro",
        "address": "Caldas de São Jorge, Aveiro",
        "location": {"lat": 40.9000, "lng": -8.5667},
        "tags": ["perto do Porto", "equilíbrio", "Aveiro", "familiar"],
        "metadata": {"district": "Aveiro", "distance_porto": "25km", "specialties": ["stress", "relaxamento"]}
    },
    {
        "name": "Termas de São Lourenço",
        "description": "As Termas de São Lourenço localizam-se na sub-zona Galiza Média do Maciço Hespérico, no distrito de Bragança, junto da estação ferroviária da linha do Tua. Um local de grande interesse geológico e paisagístico.",
        "region": "norte",
        "address": "São Lourenço, Bragança",
        "location": {"lat": 41.4667, "lng": -7.1167},
        "tags": ["linha do Tua", "Bragança", "geológico", "Trás-os-Montes"],
        "metadata": {"district": "Bragança", "near": "Linha do Tua", "specialties": ["reumatismo", "dermatologia"]}
    },
    {
        "name": "Termas de S. Pedro do Sul",
        "description": "Com mais de dois mil anos de história, as Termas de S. Pedro do Sul contam já com inúmeros casos de sucesso. O regresso anual dos aquistas é uma prova da eficácia dos tratamentos. Uma das termas mais frequentadas e antigas de Portugal.",
        "region": "centro",
        "address": "São Pedro do Sul, Viseu",
        "location": {"lat": 40.7500, "lng": -8.0833},
        "tags": ["2000 anos", "histórico", "Viseu", "mais frequentada", "romana"],
        "metadata": {"district": "Viseu", "age": "2000+ anos", "origin": "romana", "specialties": ["reumatismo", "respiratório"]}
    },
    {
        "name": "Termas de Unhais da Serra - Aquadome",
        "description": "O Aquadome - Termas de Unhais da Serra encontra-se situado na vila de Unhais da Serra, na vertente Sudoeste da Serra da Estrela, num vale de origem glaciar. Dispõe de piscina com hidromassagem e duche vichy, num SPA de montanha único.",
        "region": "centro",
        "address": "Unhais da Serra, Castelo Branco",
        "location": {"lat": 40.2667, "lng": -7.6167},
        "tags": ["Aquadome", "Serra da Estrela", "glaciar", "Castelo Branco", "SPA montanha"],
        "metadata": {"district": "Castelo Branco", "near": "Serra da Estrela", "facilities": ["hidromassagem", "duche vichy"], "specialties": ["respiratório", "reumatismo"]}
    },
    {
        "name": "Termas de Vale da Mó",
        "description": "No concelho de Anadia, agarrada às faldas da Serra do Caramulo, a 250 metros de altitude, no meio de denso arvoredo, quase no extremo leste da Bairrada, encontram-se estas termas de ambiente sereno e bucólico.",
        "region": "centro",
        "address": "Vale da Mó, Aveiro",
        "location": {"lat": 40.4500, "lng": -8.3333},
        "tags": ["Serra do Caramulo", "Bairrada", "Aveiro", "arvoredo"],
        "metadata": {"district": "Aveiro", "altitude": "250m", "near": "Serra do Caramulo", "specialties": ["respiratório", "relaxamento"]}
    },
    {
        "name": "Termas de Vidago",
        "description": "A água mineral natural de Vidago, reconhecida pelas suas propriedades curativas, é usada em tratamentos e programas de saúde. Esta água é uma água única, premiada internacionalmente, num dos mais elegantes destinos termais de Portugal.",
        "region": "norte",
        "address": "Vidago, Vila Real",
        "location": {"lat": 41.6333, "lng": -7.5833},
        "tags": ["premiada", "elegante", "Vila Real", "propriedades curativas"],
        "metadata": {"district": "Vila Real", "water_type": "gasocarbónica", "recognition": "premiada internacionalmente", "specialties": ["digestivo", "metabolismo"]}
    },
    {
        "name": "Termas de Vimioso",
        "description": "As Termas de Vimioso estão localizadas no lugar de Maceira, freguesia e concelho de Vimioso e Distrito de Bragança. Em 2013 foi construído um moderno balneário que oferece tratamentos de qualidade no coração de Trás-os-Montes.",
        "region": "norte",
        "address": "Vimioso, Bragança",
        "location": {"lat": 41.5833, "lng": -6.5333},
        "tags": ["Trás-os-Montes", "moderno", "Bragança", "2013"],
        "metadata": {"district": "Bragança", "built": "2013", "specialties": ["reumatismo", "relaxamento"]}
    },
    {
        "name": "Termas de Vizela",
        "description": "Em Vizela a presença de fontes termais remonta ao século XVIII, sendo que hoje as Termas de Vizela estão dotadas de equipamento adequado às necessidades modernas, mantendo a tradição secular de cura pela água.",
        "region": "norte",
        "address": "Vizela, Braga",
        "location": {"lat": 41.3833, "lng": -8.3000},
        "tags": ["século XVIII", "moderno", "Braga", "tradição"],
        "metadata": {"district": "Braga", "first_reference": "séc. XVIII", "specialties": ["respiratório", "reumatismo"]}
    },
    {
        "name": "Termas do Carvalhal",
        "description": "As Termas do Carvalhal situam-se a cerca de 500 metros de altitude em plena Beira Alta, distrito de Viseu, concelho de Castro Daire, entre as bacias do Douro e do Vouga. Um ambiente de montanha com águas de qualidade excecional.",
        "region": "centro",
        "address": "Carvalhal, Viseu",
        "location": {"lat": 40.8833, "lng": -7.9500},
        "tags": ["Beira Alta", "montanha", "Viseu", "Castro Daire"],
        "metadata": {"district": "Viseu", "altitude": "500m", "specialties": ["reumatismo", "respiratório"]}
    },
    {
        "name": "Termas do Cró",
        "description": "A utilização das águas medicinais do Cró remonta à era romana, mas a referência mais antiga documentada data do Séc. XVIII, da autoria do médico Del' Rei D. João V. Um local de grande tradição histórica e terapêutica.",
        "region": "centro",
        "address": "Cró, Guarda",
        "location": {"lat": 40.2167, "lng": -7.0833},
        "tags": ["romano", "D. João V", "Guarda", "histórico"],
        "metadata": {"district": "Guarda", "origin": "romana", "first_doc": "séc. XVIII", "specialties": ["reumatismo", "pele"]}
    },
    {
        "name": "Termas do Estoril",
        "description": "A terapia das águas volta ao coração do Estoril numa unidade termal de excelência, assistida por um corpo clínico especializado e multidisciplinar. Wellness Center em frente ao mar, com piscina dinâmica, jacuzzi e sauna.",
        "region": "lisboa",
        "address": "Estoril, Lisboa",
        "location": {"lat": 38.7061, "lng": -9.3978},
        "tags": ["Estoril", "mar", "Wellness Center", "Lisboa", "luxo"],
        "metadata": {"district": "Lisboa", "location": "frente ao mar", "facilities": ["piscina", "jacuzzi", "sauna"], "specialties": ["respiratório", "bem-estar"]}
    },
    {
        "name": "Termas do Gerês",
        "description": "Situadas em pleno coração do Parque Nacional da Peneda-Gerês, rodeadas por lagos e montanhas de rara beleza, as Termas do Gerês agregam elementos únicos para uma experiência de bem-estar em plena natureza protegida.",
        "region": "norte",
        "address": "Gerês, Braga",
        "location": {"lat": 41.7333, "lng": -8.1667},
        "tags": ["Peneda-Gerês", "Parque Nacional", "lagos", "Braga", "natureza"],
        "metadata": {"district": "Braga", "location": "Parque Nacional Peneda-Gerês", "specialties": ["relaxamento", "respiratório"]}
    },
    {
        "name": "Termas do Vimeiro",
        "description": "As Termas do Vimeiro (Fonte dos Frades) estão situadas a meio caminho entre a povoação da Maceira e a Praia do Porto Novo, no Concelho de Torres Vedras. Focadas no tratamento terapêutico do aparelho digestivo e respiratório.",
        "region": "lisboa",
        "address": "Vimeiro, Lisboa",
        "location": {"lat": 39.1667, "lng": -9.3167},
        "tags": ["Fonte dos Frades", "Torres Vedras", "Lisboa", "digestivo", "respiratório"],
        "metadata": {"district": "Lisboa", "near": "Porto Novo", "specialties": ["digestivo", "respiratório"]}
    },
]

async def seed_termas():
    """Populate the database with Termas data"""
    print("🌊 A popular base de dados com Termas e Balneários de Portugal...")

    # Delete existing termas items
    result = await db.heritage_items.delete_many({"category": "termas"})
    print(f"   Removidos {result.deleted_count} itens existentes da categoria termas")

    # Insert new items
    items_to_insert = []
    for terma in TERMAS_DATA:
        item = {
            "id": str(uuid.uuid4()),
            "name": terma["name"],
            "description": terma["description"],
            "category": "termas",
            "subcategory": terma.get("subcategory"),
            "region": terma["region"],
            "location": terma.get("location"),
            "address": terma.get("address"),
            "image_url": terma.get("image_url"),
            "tags": terma.get("tags", []),
            "related_items": [],
            "metadata": terma.get("metadata", {}),
            "created_at": datetime.now(timezone.utc)
        }
        items_to_insert.append(item)

    if items_to_insert:
        await db.heritage_items.insert_many(items_to_insert)
        print(f"   ✅ Inseridos {len(items_to_insert)} itens de Termas e Balneários")

    # Count items
    count = await db.heritage_items.count_documents({"category": "termas"})
    print(f"   📊 Total de Termas na base de dados: {count}")

    print("\n✅ Base de dados populada com sucesso!")

if __name__ == "__main__":
    asyncio.run(seed_termas())
