"""
assign_images.py — Atribuir imagens Unsplash curadas a todos os POIs
Cada categoria tem um pool de 8-12 imagens de alta qualidade.
A atribuição é determinística (baseada no hash do nome do POI).
"""

import asyncio
import hashlib
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# ─── Pools de imagens por categoria (Unsplash, 800px, alta qualidade) ────────

IMAGE_POOLS = {
    # ── Natureza ─────────────────────────────────────────────────────
    "percursos_pedestres": [
        "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80",
        "https://images.unsplash.com/photo-1501554728187-ce583db33af7?w=800&q=80",
        "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
        "https://images.unsplash.com/photo-1542202229-7d93c33f5d07?w=800&q=80",
        "https://images.unsplash.com/photo-1510227272981-4a1a3f40b867?w=800&q=80",
        "https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=800&q=80",
        "https://images.unsplash.com/photo-1445217143695-467124038776?w=800&q=80",
        "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80",
        "https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800&q=80",
        "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80",
    ],
    "ecovias_passadicos": [
        "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80",
        "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80",
        "https://images.unsplash.com/photo-1510227272981-4a1a3f40b867?w=800&q=80",
        "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
        "https://images.unsplash.com/photo-1501554728187-ce583db33af7?w=800&q=80",
        "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80",
        "https://images.unsplash.com/photo-1542202229-7d93c33f5d07?w=800&q=80",
        "https://images.unsplash.com/photo-1445217143695-467124038776?w=800&q=80",
    ],
    "aventura_natureza": [
        "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80",
        "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80",
        "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
        "https://images.unsplash.com/photo-1540390769625-2fc3f8b1d50c?w=800&q=80",
        "https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=800&q=80",
        "https://images.unsplash.com/photo-1502481851512-e9e2529bfbf9?w=800&q=80",
        "https://images.unsplash.com/photo-1445217143695-467124038776?w=800&q=80",
        "https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800&q=80",
    ],
    "natureza_especializada": [
        "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
        "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80",
        "https://images.unsplash.com/photo-1542202229-7d93c33f5d07?w=800&q=80",
        "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80",
        "https://images.unsplash.com/photo-1502481851512-e9e2529bfbf9?w=800&q=80",
        "https://images.unsplash.com/photo-1518173946687-a1e009054e498?w=800&q=80",
        "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80",
        "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80",
    ],
    "fauna_autoctone": [
        "https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=800&q=80",
        "https://images.unsplash.com/photo-1504006833117-8886a355efbf?w=800&q=80",
        "https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=800&q=80",
        "https://images.unsplash.com/photo-1425082661507-d979f2e68fa4?w=800&q=80",
        "https://images.unsplash.com/photo-1549480017-d76466a4b7e8?w=800&q=80",
        "https://images.unsplash.com/photo-1535338454528-1b22a7dd8fdd?w=800&q=80",
        "https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?w=800&q=80",
        "https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=800&q=80",
    ],
    "flora_autoctone": [
        "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80",
        "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=800&q=80",
        "https://images.unsplash.com/photo-1518173946687-a1e009054e498?w=800&q=80",
        "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80",
        "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80",
        "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
        "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=800&q=80",
        "https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=800&q=80",
    ],
    "flora_botanica": [
        "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=800&q=80",
        "https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=800&q=80",
        "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=800&q=80",
        "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80",
        "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80",
        "https://images.unsplash.com/photo-1518173946687-a1e009054e498?w=800&q=80",
        "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80",
        "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
    ],
    "biodiversidade_avistamentos": [
        "https://images.unsplash.com/photo-1504545102780-26774c1bb073?w=800&q=80",
        "https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=800&q=80",
        "https://images.unsplash.com/photo-1425082661507-d979f2e68fa4?w=800&q=80",
        "https://images.unsplash.com/photo-1535338454528-1b22a7dd8fdd?w=800&q=80",
        "https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?w=800&q=80",
        "https://images.unsplash.com/photo-1549480017-d76466a4b7e8?w=800&q=80",
        "https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=800&q=80",
        "https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=800&q=80",
    ],
    "miradouros": [
        "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
        "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80",
        "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80",
        "https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800&q=80",
        "https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=800&q=80",
        "https://images.unsplash.com/photo-1540390769625-2fc3f8b1d50c?w=800&q=80",
        "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80",
        "https://images.unsplash.com/photo-1445217143695-467124038776?w=800&q=80",
    ],
    "barragens_albufeiras": [
        "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800&q=80",
        "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80",
        "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80",
        "https://images.unsplash.com/photo-1502481851512-e9e2529bfbf9?w=800&q=80",
        "https://images.unsplash.com/photo-1518173946687-a1e009054e498?w=800&q=80",
        "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80",
        "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
        "https://images.unsplash.com/photo-1542202229-7d93c33f5d07?w=800&q=80",
    ],
    "cascatas_pocos": [
        "https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=800&q=80",
        "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=800&q=80",
        "https://images.unsplash.com/photo-1475113548554-5a36f1f523d6?w=800&q=80",
        "https://images.unsplash.com/photo-1462275646964-a0e3c11f18a6?w=800&q=80",
        "https://images.unsplash.com/photo-1501554728187-ce583db33af7?w=800&q=80",
        "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800&q=80",
        "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80",
        "https://images.unsplash.com/photo-1518173946687-a1e009054e498?w=800&q=80",
    ],
    "praias_fluviais": [
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
        "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80",
        "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80",
        "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800&q=80",
        "https://images.unsplash.com/photo-1501554728187-ce583db33af7?w=800&q=80",
        "https://images.unsplash.com/photo-1462275646964-a0e3c11f18a6?w=800&q=80",
        "https://images.unsplash.com/photo-1502481851512-e9e2529bfbf9?w=800&q=80",
        "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80",
    ],
    "arqueologia_geologia": [
        "https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?w=800&q=80",
        "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&q=80",
        "https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800&q=80",
        "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
        "https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=800&q=80",
        "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80",
        "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80",
        "https://images.unsplash.com/photo-1445217143695-467124038776?w=800&q=80",
    ],
    "moinhos_azenhas": [
        "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800&q=80",
        "https://images.unsplash.com/photo-1600786705579-08b369d25d7d?w=800&q=80",
        "https://images.unsplash.com/photo-1542202229-7d93c33f5d07?w=800&q=80",
        "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
        "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80",
        "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80",
        "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80",
        "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80",
    ],
    # ── História & Património ────────────────────────────────────────
    "castelos": [
        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
        "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&q=80",
        "https://images.unsplash.com/photo-1533154683836-84ea7a0bc310?w=800&q=80",
        "https://images.unsplash.com/photo-1568393691622-c7ba131d63b4?w=800&q=80",
        "https://images.unsplash.com/photo-1599946347371-68eb71b16afc?w=800&q=80",
        "https://images.unsplash.com/photo-1562616895-62ab12f81f2e?w=800&q=80",
        "https://images.unsplash.com/photo-1537572263443-91a0e27d78e2?w=800&q=80",
        "https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800&q=80",
        "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80",
        "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=800&q=80",
    ],
    "palacios_solares": [
        "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&q=80",
        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
        "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=800&q=80",
        "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",
        "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80",
        "https://images.unsplash.com/photo-1562616895-62ab12f81f2e?w=800&q=80",
        "https://images.unsplash.com/photo-1568393691622-c7ba131d63b4?w=800&q=80",
        "https://images.unsplash.com/photo-1537572263443-91a0e27d78e2?w=800&q=80",
    ],
    "museus": [
        "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&q=80",
        "https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=800&q=80",
        "https://images.unsplash.com/photo-1566127444979-b3d2b654e3d7?w=800&q=80",
        "https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800&q=80",
        "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800&q=80",
        "https://images.unsplash.com/photo-1565060299509-21eb15a78a6d?w=800&q=80",
        "https://images.unsplash.com/photo-1544967082-d9d25d867d66?w=800&q=80",
        "https://images.unsplash.com/photo-1574958269340-fa927503f3dd?w=800&q=80",
    ],
    "oficios_artesanato": [
        "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=800&q=80",
        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
        "https://images.unsplash.com/photo-1568288796888-a0fa7b6ebd17?w=800&q=80",
        "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&q=80",
        "https://images.unsplash.com/photo-1501366062246-723b4d3e4eb6?w=800&q=80",
        "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=800&q=80",
        "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80",
        "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",
    ],
    "termas_banhos": [
        "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80",
        "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80",
        "https://images.unsplash.com/photo-1515362655824-9a74989f318e?w=800&q=80",
        "https://images.unsplash.com/photo-1560185007-c5ca9d2c014d?w=800&q=80",
        "https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=800&q=80",
        "https://images.unsplash.com/photo-1501554728187-ce583db33af7?w=800&q=80",
        "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800&q=80",
        "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80",
    ],
    "patrimonio_ferroviario": [
        "https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=800&q=80",
        "https://images.unsplash.com/photo-1527259456336-0631e09aa1e5?w=800&q=80",
        "https://images.unsplash.com/photo-1494515843206-f3117d3f51b7?w=800&q=80",
        "https://images.unsplash.com/photo-1536599018102-9f803c140fc1?w=800&q=80",
        "https://images.unsplash.com/photo-1517578323247-bbb66b32eec0?w=800&q=80",
        "https://images.unsplash.com/photo-1568393691622-c7ba131d63b4?w=800&q=80",
        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
        "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&q=80",
    ],
    "arte_urbana": [
        "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&q=80",
        "https://images.unsplash.com/photo-1570561477977-32d429ab3da4?w=800&q=80",
        "https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?w=800&q=80",
        "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=800&q=80",
        "https://images.unsplash.com/photo-1561059488-916d69792237?w=800&q=80",
        "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&q=80",
        "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800&q=80",
        "https://images.unsplash.com/photo-1574958269340-fa927503f3dd?w=800&q=80",
    ],
    # ── Gastronomia ──────────────────────────────────────────────────
    "restaurantes_gastronomia": [
        "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
        "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
        "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80",
        "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80",
        "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=800&q=80",
        "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=80",
        "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&q=80",
        "https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?w=800&q=80",
        "https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=800&q=80",
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
    ],
    "tabernas_historicas": [
        "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&q=80",
        "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80",
        "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80",
        "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=800&q=80",
        "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
        "https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?w=800&q=80",
        "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=80",
        "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
    ],
    "mercados_feiras": [
        "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800&q=80",
        "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80",
        "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=800&q=80",
        "https://images.unsplash.com/photo-1534723452862-4c874018d66d?w=800&q=80",
        "https://images.unsplash.com/photo-1502481851512-e9e2529bfbf9?w=800&q=80",
        "https://images.unsplash.com/photo-1566576721346-d4a3b4eaeb55?w=800&q=80",
        "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80",
        "https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=800&q=80",
    ],
    "produtores_dop": [
        "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80",
        "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800&q=80",
        "https://images.unsplash.com/photo-1534723452862-4c874018d66d?w=800&q=80",
        "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=800&q=80",
        "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800&q=80",
        "https://images.unsplash.com/photo-1566576721346-d4a3b4eaeb55?w=800&q=80",
        "https://images.unsplash.com/photo-1502481851512-e9e2529bfbf9?w=800&q=80",
        "https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=800&q=80",
    ],
    "agroturismo_enoturismo": [
        "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800&q=80",
        "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&q=80",
        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
        "https://images.unsplash.com/photo-1543418219-44e30b057fea?w=800&q=80",
        "https://images.unsplash.com/photo-1516594915307-8f71508eb698?w=800&q=80",
        "https://images.unsplash.com/photo-1474722883778-792e7990302f?w=800&q=80",
        "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",
        "https://images.unsplash.com/photo-1566576721346-d4a3b4eaeb55?w=800&q=80",
    ],
    "pratos_tipicos": [
        "https://images.unsplash.com/photo-1591107576521-87091dc07797?w=800&q=80",
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
        "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
        "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80",
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80",
        "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80",
        "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80",
        "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&q=80",
    ],
    "docaria_regional": [
        "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800&q=80",
        "https://images.unsplash.com/photo-1486427944544-d2c246c4df14?w=800&q=80",
        "https://images.unsplash.com/photo-1464195244916-405fa0a82545?w=800&q=80",
        "https://images.unsplash.com/photo-1550617931-e17a7b70dce2?w=800&q=80",
        "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80",
        "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80",
        "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&q=80",
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80",
    ],
    "sopas_tipicas": [
        "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80",
        "https://images.unsplash.com/photo-1591107576521-87091dc07797?w=800&q=80",
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80",
        "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80",
        "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80",
        "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&q=80",
        "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
    ],
    # ── Cultura ──────────────────────────────────────────────────────
    "musica_tradicional": [
        "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&q=80",
        "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80",
        "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=80",
        "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&q=80",
        "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800&q=80",
        "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&q=80",
        "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=800&q=80",
        "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80",
    ],
    "festivais_musica": [
        "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80",
        "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=80",
        "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&q=80",
        "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&q=80",
        "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80",
        "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800&q=80",
        "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=800&q=80",
        "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80",
    ],
    "festas_romarias": [
        "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80",
        "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80",
        "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=80",
        "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&q=80",
        "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&q=80",
        "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80",
        "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800&q=80",
        "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=800&q=80",
    ],
    # ── Mar & Praias ─────────────────────────────────────────────────
    "surf": [
        "https://images.unsplash.com/photo-1502680390548-bdbac40b3e1a?w=800&q=80",
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
        "https://images.unsplash.com/photo-1455729552457-5c322b38ea2f?w=800&q=80",
        "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80",
        "https://images.unsplash.com/photo-1500930287596-c1ecaa210012?w=800&q=80",
        "https://images.unsplash.com/photo-1530053969600-caed2596d242?w=800&q=80",
        "https://images.unsplash.com/photo-1476673160081-cf065607f449?w=800&q=80",
        "https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?w=800&q=80",
    ],
    "praias_bandeira_azul": [
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
        "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80",
        "https://images.unsplash.com/photo-1476673160081-cf065607f449?w=800&q=80",
        "https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?w=800&q=80",
        "https://images.unsplash.com/photo-1502680390548-bdbac40b3e1a?w=800&q=80",
        "https://images.unsplash.com/photo-1455729552457-5c322b38ea2f?w=800&q=80",
        "https://images.unsplash.com/photo-1500930287596-c1ecaa210012?w=800&q=80",
        "https://images.unsplash.com/photo-1530053969600-caed2596d242?w=800&q=80",
        "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&q=80",
        "https://images.unsplash.com/photo-1520454974749-611b7248ffdb?w=800&q=80",
    ],
    # ── Experiências ─────────────────────────────────────────────────
    "rotas_tematicas": [
        "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
        "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80",
        "https://images.unsplash.com/photo-1501554728187-ce583db33af7?w=800&q=80",
        "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
        "https://images.unsplash.com/photo-1542202229-7d93c33f5d07?w=800&q=80",
        "https://images.unsplash.com/photo-1445217143695-467124038776?w=800&q=80",
        "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80",
        "https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800&q=80",
    ],
    "grande_expedicao": [
        "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80",
        "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
        "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80",
        "https://images.unsplash.com/photo-1501554728187-ce583db33af7?w=800&q=80",
        "https://images.unsplash.com/photo-1445217143695-467124038776?w=800&q=80",
        "https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800&q=80",
        "https://images.unsplash.com/photo-1542202229-7d93c33f5d07?w=800&q=80",
        "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
    ],
    "perolas_portugal": [
        "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&q=80",
        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
        "https://images.unsplash.com/photo-1568393691622-c7ba131d63b4?w=800&q=80",
        "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",
        "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
        "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80",
        "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
    ],
    "alojamentos_rurais": [
        "https://images.unsplash.com/photo-1600786705579-08b369d25d7d?w=800&q=80",
        "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80",
        "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",
        "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80",
        "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=800&q=80",
        "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800&q=80",
        "https://images.unsplash.com/photo-1541004995602-70e19f0cd714?w=800&q=80",
        "https://images.unsplash.com/photo-1474722883778-792e7990302f?w=800&q=80",
    ],
    "parques_campismo": [
        "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80",
        "https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=800&q=80",
        "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=800&q=80",
        "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
        "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80",
        "https://images.unsplash.com/photo-1501554728187-ce583db33af7?w=800&q=80",
        "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80",
        "https://images.unsplash.com/photo-1542202229-7d93c33f5d07?w=800&q=80",
    ],
    "pousadas_juventude": [
        "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80",
        "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80",
        "https://images.unsplash.com/photo-1600786705579-08b369d25d7d?w=800&q=80",
        "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",
        "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=800&q=80",
        "https://images.unsplash.com/photo-1541004995602-70e19f0cd714?w=800&q=80",
        "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80",
        "https://images.unsplash.com/photo-1474722883778-792e7990302f?w=800&q=80",
    ],
    "farois": [
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80",
        "https://images.unsplash.com/photo-1476673160081-cf065607f449?w=800&q=80",
        "https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?w=800&q=80",
        "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80",
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
        "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&q=80",
        "https://images.unsplash.com/photo-1520454974749-611b7248ffdb?w=800&q=80",
        "https://images.unsplash.com/photo-1530053969600-caed2596d242?w=800&q=80",
    ],
    "entidades_operadores": [
        "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80",
        "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80",
        "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
        "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&q=80",
        "https://images.unsplash.com/photo-1568393691622-c7ba131d63b4?w=800&q=80",
        "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=800&q=80",
        "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",
    ],
    "agentes_turisticos": [
        "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80",
        "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80",
        "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
        "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&q=80",
        "https://images.unsplash.com/photo-1568393691622-c7ba131d63b4?w=800&q=80",
        "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=800&q=80",
        "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",
    ],
}

# Fallback genérico para categorias sem pool
FALLBACK_IMAGES = [
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
    "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&q=80",
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
    "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80",
    "https://images.unsplash.com/photo-1600786705579-08b369d25d7d?w=800&q=80",
]


def get_image_for_poi(name: str, category: str) -> str:
    """Deterministically select an image based on POI name hash."""
    pool = IMAGE_POOLS.get(category, FALLBACK_IMAGES)
    h = int(hashlib.md5(name.encode()).hexdigest(), 16)
    return pool[h % len(pool)]


async def assign_all_images():
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]

    total = await db.heritage_items.count_documents({})
    print(f"Atribuindo imagens a {total} POIs...")

    cursor = db.heritage_items.find({}, {"_id": 1, "name": 1, "category": 1})
    batch = []
    updated = 0

    async for doc in cursor:
        name = doc.get("name", "")
        category = doc.get("category", "")
        image_url = get_image_for_poi(name, category)

        batch.append(
            {
                "filter": {"_id": doc["_id"]},
                "update": {"$set": {"image_url": image_url}},
            }
        )

        if len(batch) >= 500:
            from pymongo import UpdateOne
            ops = [UpdateOne(b["filter"], b["update"]) for b in batch]
            result = await db.heritage_items.bulk_write(ops)
            updated += result.modified_count
            print(f"  ✅ {updated}/{total} atualizados")
            batch = []

    if batch:
        from pymongo import UpdateOne
        ops = [UpdateOne(b["filter"], b["update"]) for b in batch]
        result = await db.heritage_items.bulk_write(ops)
        updated += result.modified_count

    print(f"\n🎉 {updated} POIs atualizados com imagens!")

    # Verify
    sample = await db.heritage_items.find_one({"image_url": {"$ne": ""}})
    if sample:
        print(f"Exemplo: {sample['name']} → {sample['image_url']}")

    client.close()


if __name__ == "__main__":
    asyncio.run(assign_all_images())
