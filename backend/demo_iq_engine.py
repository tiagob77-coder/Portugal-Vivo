"""
Demo: IQ Engine - Teste dos Módulos 1-3
"""
import asyncio
from iq_engine_base import IQEngine, POIProcessingData
from iq_module_m1_semantic import SemanticValidationModule
from iq_module_m2_cognitive import CognitiveInferenceModule
from iq_module_m3_image import ImageQualityModule

async def test_iq_engine():
    print("="*70)
    print("🧠 IQ ENGINE - TESTE DOS MÓDULOS 1-3")
    print("="*70)
    print()

    # Initialize engine
    engine = IQEngine()

    # Register modules
    engine.register_module(SemanticValidationModule(use_ai=False))
    engine.register_module(CognitiveInferenceModule())
    engine.register_module(ImageQualityModule())

    print("✅ Módulos registrados:\n")
    for module_type in engine.modules.keys():
        print(f"   • {module_type.value}")
    print()

    # Test POI 1: Bom Jesus do Monte
    print("-" * 70)
    print("📍 TESTE 1: Santuário do Bom Jesus do Monte (Braga)")
    print("-" * 70)

    poi1 = POIProcessingData(
        id="test-001",
        name="Santuário do Bom Jesus do Monte",
        description=(
            "O Santuário do Bom Jesus do Monte é um complexo religioso barroco "
            "localizado em Braga. Destaca-se pela sua monumental escadaria de "
            "589 degraus, que sobe 116 metros. A visita demora cerca de 2 horas. "
            "Ideal para visitar na primavera quando as flores estão em pleno esplendor. "
            "O acesso é moderado devido à subida, mas existe um funicular histórico. "
            "Património Mundial da UNESCO desde 2019."
        ),
        category="religioso",
        region="norte",
        location={"lat": 41.554500, "lng": -8.376900},
        address="Bom Jesus do Monte, 4715-056 Braga",
        image_url="https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Bom_Jesus_do_Monte_August_2014-2a.jpg/1200px-Bom_Jesus_do_Monte_August_2014-2a.jpg",
        tags=["UNESCO", "barroco", "escadaria", "funicular"],
        metadata={}
    )

    results1 = await engine.process_poi(poi1, tenant_id="braga")

    print()
    for result in results1:
        print(f"\n🔹 MÓDULO: {result.module.value}")
        print(f"   Status: {result.status.value}")
        print(f"   Score: {result.score:.1f}/100")
        print(f"   Confidence: {result.confidence:.2f}")
        print(f"   Execution: {result.execution_time_ms:.2f}ms")

        if result.data:
            print("   Dados extraídos:")
            for key, value in result.data.items():
                if isinstance(value, dict):
                    print(f"      • {key}:")
                    for k, v in value.items():
                        print(f"         - {k}: {v}")
                elif isinstance(value, list) and value:
                    print(f"      • {key}: {', '.join(map(str, value[:3]))}")
                else:
                    print(f"      • {key}: {value}")

        if result.warnings:
            print(f"   ⚠️  Warnings: {', '.join(result.warnings)}")

        if result.issues:
            print(f"   ❌ Issues: {', '.join(result.issues)}")

    # Calculate overall
    scores = [r.score for r in results1 if r.score is not None]
    overall = sum(scores) / len(scores) if scores else 0
    print(f"\n{'='*70}")
    print(f"📊 SCORE GERAL: {overall:.1f}/100")
    print(f"{'='*70}")

    # Test POI 2: Torre dos Clérigos (less complete)
    print("\n\n")
    print("-" * 70)
    print("📍 TESTE 2: Torre dos Clérigos (Porto) - Dados Incompletos")
    print("-" * 70)

    poi2 = POIProcessingData(
        id="test-002",
        name="Torre dos Clérigos",
        description="Torre barroca no Porto.",  # Short description
        category=None,  # No category
        region="norte",
        location={"lat": 41.145600, "lng": -8.614500},
        address="Rua dos Clérigos, Porto",
        image_url=None,  # No image
        tags=[],
        metadata={}
    )

    results2 = await engine.process_poi(poi2, tenant_id="porto")

    print()
    for result in results2:
        print(f"\n🔹 MÓDULO: {result.module.value}")
        print(f"   Status: {result.status.value}")
        print(f"   Score: {result.score:.1f}/100")

        if result.issues:
            print(f"   ❌ Issues: {', '.join(result.issues)}")

        if result.warnings:
            print(f"   ⚠️  Warnings: {', '.join(result.warnings)}")

    scores2 = [r.score for r in results2 if r.score is not None]
    overall2 = sum(scores2) / len(scores2) if scores2 else 0
    print(f"\n{'='*70}")
    print(f"📊 SCORE GERAL: {overall2:.1f}/100")
    print(f"{'='*70}")

    print("\n\n✅ TESTE DO IQ ENGINE COMPLETO!\n")

if __name__ == "__main__":
    asyncio.run(test_iq_engine())
