"""
Excel POI Parser - Importação da Base de Dados
Parser para importar 4000+ POIs do ficheiro Excel fornecido
"""
import pandas as pd
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
from datetime import datetime, timezone
from slugify import slugify
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ExcelPOIParser:
    """Parser para importar POIs do Excel"""

    def __init__(self, excel_file: str, mongo_url: str = "mongodb://localhost:27017"):
        self.excel_file = excel_file
        self.client = AsyncIOMotorClient(mongo_url)
        self.stats = {
            "total_rows": 0,
            "imported": 0,
            "skipped": 0,
            "errors": 0
        }

    async def parse_and_import(self, tenant_id: str, sheet_name: str = None):
        """Parse Excel e importar para tenant database"""

        logger.info(f"📊 Iniciando importação do Excel: {self.excel_file}")

        try:
            # Read Excel
            if sheet_name:
                df = pd.read_excel(self.excel_file, sheet_name=sheet_name)
            else:
                df = pd.read_excel(self.excel_file)

            self.stats["total_rows"] = len(df)
            logger.info(f"   Total de linhas: {len(df)}")
            logger.info(f"   Colunas: {list(df.columns)}")

            # Get tenant database
            db_name = f"tenant_{slugify(tenant_id, separator='_')}_db"
            db = self.client[db_name]

            # Process each row
            pois_to_insert = []

            for idx, row in df.iterrows():
                try:
                    poi = self._convert_row_to_poi(row, idx)
                    if poi:
                        pois_to_insert.append(poi)
                        self.stats["imported"] += 1
                    else:
                        self.stats["skipped"] += 1

                    # Batch insert every 100 POIs
                    if len(pois_to_insert) >= 100:
                        await db.heritage_items.insert_many(pois_to_insert)
                        logger.info(f"   ✅ Importados {self.stats['imported']} POIs...")
                        pois_to_insert = []

                except Exception as e:
                    logger.error(f"   ❌ Erro na linha {idx}: {e}")
                    self.stats["errors"] += 1

            # Insert remaining POIs
            if pois_to_insert:
                await db.heritage_items.insert_many(pois_to_insert)

            logger.info(f"\n{'='*80}")
            logger.info("📊 IMPORTAÇÃO COMPLETA")
            logger.info(f"{'='*80}")
            logger.info(f"   Total linhas: {self.stats['total_rows']}")
            logger.info(f"   ✅ Importados: {self.stats['imported']}")
            logger.info(f"   ⏭️  Ignorados: {self.stats['skipped']}")
            logger.info(f"   ❌ Erros: {self.stats['errors']}")
            logger.info(f"{'='*80}\n")

            return self.stats

        except Exception as e:
            logger.error(f"Erro ao processar Excel: {e}")
            raise
        finally:
            self.client.close()

    def _convert_row_to_poi(self, row, idx: int) -> dict:
        """Convert Excel row to POI document"""

        # Required fields check
        poi_name = row.get('POI Name') or row.get('Name') or row.get('name')

        if pd.isna(poi_name) or not str(poi_name).strip():
            logger.warning(f"   ⚠️  Linha {idx}: Nome ausente, ignorando")
            return None

        # Extract coordinates from regional codes
        coordinates = self._extract_coordinates(row)

        # Build POI document
        poi = {
            "id": str(uuid.uuid4()),
            "name": str(poi_name).strip(),
            "description": self._get_field(row, ['Notes', 'Description', 'description']),
            "category": self._map_category(row),
            "subcategory": None,
            "region": self._extract_region(row),
            "location": coordinates,
            "address": None,  # Will be enriched later
            "image_url": None,  # Will be enriched later
            "tags": self._extract_tags(row),
            "metadata": self._extract_metadata(row),
            "related_items": [],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "source": "excel_import",
            "iq_score": None,  # Will be calculated by IQ Engine
            "iq_processed": False
        }

        return poi

    def _get_field(self, row, possible_names: list) -> str:
        """Get field value from multiple possible column names"""
        for name in possible_names:
            if name in row and not pd.isna(row[name]):
                value = str(row[name]).strip()
                if value and value != 'nan':
                    return value
        return ""

    def _map_category(self, row) -> str:
        """Map Excel category to PV categories"""
        category_field = self._get_field(row, ['Category', 'Categoria', 'Type'])

        if not category_field:
            return "outros"

        category_lower = category_field.lower()

        # Mapping table
        category_map = {
            "festa": "festas_romarias",
            "festival": "festas_romarias",
            "natureza": "aventura_natureza",
            "nature": "aventura_natureza",
            "museu": "museus",
            "museum": "museus",
            "gastronomia": "restaurantes_gastronomia",
            "restaurante": "restaurantes_gastronomia",
            "parque": "natureza_especializada",
            "park": "natureza_especializada",
            "rio": "barragens_albufeiras",
            "river": "barragens_albufeiras",
            "aldeia": "rotas_tematicas",
            "vila": "rotas_tematicas",
            "percurso": "percursos_pedestres",
            "trilho": "percursos_pedestres",
            "trail": "percursos_pedestres",
            "piscina": "praias_fluviais",
            "praia": "praias_fluviais",
            "miradouro": "miradouros",
            "viewpoint": "miradouros",
            "cascata": "cascatas_pocos",
            "waterfall": "cascatas_pocos",
            "religioso": "festas_romarias",
            "igreja": "festas_romarias",
            "chapel": "festas_romarias",
            "castelo": "castelos",
            "terma": "termas_banhos",
            "artesanato": "oficios_artesanato",
            "surf": "surf",
        }

        for key, value in category_map.items():
            if key in category_lower:
                return value

        return "outros"

    def _extract_region(self, row) -> str:
        """Extract region from row data"""
        # Check for regional code columns (NORTE_001, CENTRO_002, etc.)
        for col in row.index:
            col_str = str(col).upper()
            if 'NORTE' in col_str and not pd.isna(row[col]):
                return "norte"
            elif 'CENTRO' in col_str and not pd.isna(row[col]):
                return "centro"
            elif 'SUL' in col_str or 'ALENTEJO' in col_str and not pd.isna(row[col]):
                return "sul"
            elif 'LISBOA' in col_str and not pd.isna(row[col]):
                return "lisboa"
            elif 'ALGARVE' in col_str and not pd.isna(row[col]):
                return "algarve"

        # Check State field
        state = self._get_field(row, ['State', 'Region', 'Região'])
        if state:
            state_lower = state.lower()
            if any(x in state_lower for x in ['braga', 'porto', 'viana', 'vila real']):
                return "norte"
            elif any(x in state_lower for x in ['coimbra', 'aveiro', 'viseu']):
                return "centro"
            elif any(x in state_lower for x in ['lisboa', 'sintra']):
                return "lisboa"
            elif 'algarve' in state_lower or 'faro' in state_lower:
                return "algarve"

        return "portugal"

    def _extract_coordinates(self, row) -> dict:
        """Extract coordinates from regional code columns"""
        # Look for regional columns with coordinates
        # Format example: NORTE_001, CENTRO_005, etc.

        # For now, return None (will be geocoded later by M5)
        # In real implementation, parse regional codes or use Google Maps
        return None

    def _extract_tags(self, row) -> list:
        """Extract tags from row"""
        tags = []

        # Add category as tag
        category = self._get_field(row, ['Category', 'Categoria'])
        if category:
            tags.append(category.lower())

        # Add rarity if exists
        rarity = self._get_field(row, ['Rarity', 'Raridade'])
        if rarity and rarity != '0':
            tags.append(f"rarity_{rarity}")

        # Add emoji as tag (creative!)
        emoji = self._get_field(row, ['Emoji'])
        if emoji:
            tags.append("visual_featured")

        return tags[:10]  # Limit to 10 tags

    def _extract_metadata(self, row) -> dict:
        """Extract additional metadata"""
        metadata = {}

        # Duration
        duration = self._get_field(row, ['Duration', 'Duração'])
        if duration:
            metadata["duration"] = duration

        # Rarity
        rarity = self._get_field(row, ['Rarity'])
        if rarity:
            metadata["rarity"] = rarity

        # State
        state = self._get_field(row, ['State'])
        if state:
            metadata["state"] = state

        # Emoji (for gamification)
        emoji = self._get_field(row, ['Emoji'])
        if emoji:
            metadata["emoji"] = emoji

        # Add all regional codes
        for col in row.index:
            if any(region in str(col).upper() for region in ['NORTE', 'CENTRO', 'SUL', 'LISBOA', 'ALGARVE']):
                if not pd.isna(row[col]):
                    metadata[str(col)] = str(row[col])

        return metadata

# CLI usage
async def main():
    import sys

    if len(sys.argv) < 2:
        print("Uso: python excel_poi_parser.py <ficheiro.xlsx> [tenant_id] [sheet_name]")
        print("\nExemplo:")
        print("  python excel_poi_parser.py PortugalVivo_BaseDados_POI_v19.xlsx braga")
        return

    excel_file = sys.argv[1]
    tenant_id = sys.argv[2] if len(sys.argv) > 2 else "portugal"
    sheet_name = sys.argv[3] if len(sys.argv) > 3 else None

    parser = ExcelPOIParser(excel_file)
    stats = await parser.parse_and_import(tenant_id, sheet_name)

    print("\n✅ Importação concluída!")
    print(f"   POIs importados: {stats['imported']}")
    print(f"   Tenant: {tenant_id}")

if __name__ == "__main__":
    asyncio.run(main())
