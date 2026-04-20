"""
Teste completo dos módulos M9-M11 (Enriquecimento)
"""
import asyncio
from iq_engine_base import POIProcessingData
from iq_module_m9_enrichment import DataEnrichmentModule
from iq_module_m11_description import DescriptionGenerationModule
import os

async def test_enrichment_modules():
    print("="*80)
    print("🎨 TESTE DOS MÓDULOS DE ENRIQUECIMENTO (M9-M11)")
    print("="*80)
    print()

    # Initialize modules
    google_key = os.environ.get('GOOGLE_MAPS_API_KEY')
    llm_key = os.environ.get('EMERGENT_LLM_KEY')

    enrichment_module = DataEnrichmentModule(google_places_key=google_key)
    description_module = DescriptionGenerationModule(llm_api_key=llm_key)

    # Test POI with complete metadata
    print("📍 TESTE 1: POI com metadados completos")
    print("-" * 80)

    poi1 = POIProcessingData(
        id="test-enrichment-001",
        name="Livraria Lello",
        description="Livraria histórica no Porto. Telefone: +351 222 002 037. "
                   "Email: geral@livrarialello.pt. Website: www.livrarialello.pt. "
                   "Aberto de segunda a sábado, 9h30-19h00. Entrada: 5€.",
        category="cultural",
        region="norte",
        location={"lat": 41.146896, "lng": -8.614646},
        address="Rua das Carmelitas 144, 4050-161 Porto",
        tags=["livraria", "histórico", "arte-nova", "Harry Potter"],
        metadata={
            "year_founded": "1906",
            "architect": "Xavier Esteves"
        }
    )

    # Test M9 - Enrichment
    print("\n🔍 M9 - Data Enrichment:")
    result_m9 = await enrichment_module.process(poi1)

    print(f"   Status: {result_m9.status.value}")
    print(f"   Score: {result_m9.score}/100")
    print(f"   Sources used: {result_m9.data.get('sources_used', [])}")
    print(f"   Fields added: {result_m9.data.get('fields_added', [])}")

    if result_m9.data.get('enriched_fields'):
        print("\n   Dados Enriquecidos:")
        for key, value in result_m9.data['enriched_fields'].items():
            if isinstance(value, list):
                print(f"      • {key}: {len(value)} items")
            else:
                print(f"      • {key}: {str(value)[:100]}")

    # Test M11 - Description Generation
    print("\n\n📝 M11 - Description Generation:")

    # Test with short description
    poi_short = POIProcessingData(
        id="test-desc-001",
        name="Castelo de Guimarães",
        description="Castelo histórico.",  # Too short
        category="cultural",
        region="norte",
        location={"lat": 41.446896, "lng": -8.292287},
        tags=["castelo", "medieval", "UNESCO"]
    )

    result_m11 = await description_module.process(poi_short)

    print(f"   Status: {result_m11.status.value}")
    print(f"   Score: {result_m11.score}/100")
    print(f"   Method: {result_m11.data.get('method_used')}")
    print(f"   Original length: {result_m11.data.get('original_length')}")
    print(f"   Generated length: {result_m11.data.get('generated_length')}")
    print(f"\n   Original: {result_m11.data.get('original_description')}")
    print(f"   Generated: {result_m11.data.get('generated_description')}")

    # Test with generic description
    print("\n\n" + "-"*80)
    print("📍 TESTE 2: POI com descrição genérica")
    print("-" * 80)

    poi_generic = POIProcessingData(
        id="test-desc-002",
        name="Ponte de Lima",
        description="Local bonito e interessante. Vale a pena visitar.",  # Too generic
        category="natureza",
        region="norte",
        location={"lat": 41.767, "lng": -8.583},
        tags=["ponte", "rio", "vila"]
    )

    result_generic = await description_module.process(poi_generic)

    print("\n📝 M11 - Description Generation:")
    print(f"   Status: {result_generic.status.value}")
    print(f"   Score: {result_generic.score}/100")
    print(f"   Reason: {result_generic.data.get('improvement_reason')}")
    print(f"\n   Original: {result_generic.data.get('original_description')}")
    print(f"   Generated: {result_generic.data.get('generated_description')}")

    # Summary
    print("\n\n" + "="*80)
    print("📊 RESUMO DOS TESTES")
    print("="*80)
    print("\nM9 - Data Enrichment:")
    print(f"   ✅ Extraction from metadata: {'phone' in result_m9.data.get('enriched_fields', {})}")
    print(f"   ✅ Extraction from description: {'phone_from_text' in result_m9.data.get('enriched_fields', {})}")
    print(f"   ✅ Score: {result_m9.score}/100")

    print("\nM11 - Description Generation:")
    print(f"   ✅ Short description improved: {result_m11.data.get('generated_length', 0) > result_m11.data.get('original_length', 0)}")
    print(f"   ✅ Generic description improved: {len(result_generic.data.get('generated_description', '')) > 50}")
    print(f"   ✅ Within 300 char limit: {result_m11.data.get('within_limit', False)}")

    print("\n✅ TESTES COMPLETOS!\n")

if __name__ == "__main__":
    asyncio.run(test_enrichment_modules())
