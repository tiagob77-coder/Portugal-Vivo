"""
Hybrid Recommendation Service
Sistema de Recomendação Híbrido: Algoritmo (40-50%) + Editorial (30-35%) + Comunidade (15-25%)
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any, Tuple
import random
from motor.motor_asyncio import AsyncIOMotorDatabase
from models.intent_models import (
    UserPreferences, TravelerProfile, ThematicAxis, Region,
    RecommendationSource, Recommendation, DiscoverySection, DiscoveryFeedItem,
    JourneyPhase
)

logger = logging.getLogger(__name__)


# ========================
# WEIGHT CONFIGURATION
# ========================

class RecommendationWeights:
    """Pesos configuráveis do sistema de recomendação"""

    # Pesos por fonte (devem somar 1.0)
    ALGORITHM_WEIGHT = 0.45      # 40-50%
    EDITORIAL_WEIGHT = 0.32      # 30-35%
    COMMUNITY_WEIGHT = 0.23      # 15-25%

    # Pesos de sinais de comportamento
    EXPLICIT_BEHAVIOR_WEIGHT = 0.4   # Avaliações, guardados, partilhas
    IMPLICIT_BEHAVIOR_WEIGHT = 0.35  # Tempo, padrões de navegação
    CONTEXTUAL_WEIGHT = 0.25         # Tempo, localização, perfil

    # Decaimento temporal
    RECENCY_DECAY_DAYS = 30  # Conteúdo mais antigo perde relevância

    # Diversidade
    MIN_DIVERSITY_SCORE = 0.3  # Mínimo de diversidade no feed
    MAX_SAME_CATEGORY = 3      # Máximo de itens da mesma categoria seguidos


# ========================
# ALGORITHM-BASED RECOMMENDATIONS
# ========================

class AlgorithmRecommender:
    """Recomendador baseado em algoritmo de personalização"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def get_recommendations(
        self,
        user_id: str,
        preferences: UserPreferences,
        limit: int = 20,
        exclude_ids: List[str] = []
    ) -> List[Recommendation]:
        """Gerar recomendações personalizadas baseadas em perfil e comportamento"""

        recommendations = []

        # 1. Obter histórico de interações do utilizador
        user_interactions = await self._get_user_interactions(user_id)

        # 2. Calcular perfil de interesse
        interest_profile = await self._calculate_interest_profile(preferences, user_interactions)

        # 3. Obter candidatos
        candidates = await self._get_candidates(
            interest_profile,
            exclude_ids,
            limit * 3  # Obter mais para depois filtrar
        )

        # 4. Pontuar cada candidato
        for candidate in candidates:
            score = await self._calculate_relevance_score(
                candidate,
                preferences,
                interest_profile,
                user_interactions
            )

            # Criar recomendação
            rec = Recommendation(
                content_type=candidate.get("_type", "heritage_item"),
                content_id=candidate.get("id", ""),
                content_name=candidate.get("name", ""),
                content_description=candidate.get("description", "")[:200],
                content_image=candidate.get("image_url"),
                source=RecommendationSource.ALGORITHM,
                source_weight=RecommendationWeights.ALGORITHM_WEIGHT,
                relevance_score=score,
                final_score=score * RecommendationWeights.ALGORITHM_WEIGHT,
                context_reason=self._generate_reason(candidate, preferences),
                journey_phase=JourneyPhase.DREAM,
                thematic_axis=self._map_to_thematic_axis(candidate.get("category")),
                region=self._map_to_region(candidate.get("region"))
            )
            recommendations.append(rec)

        # 5. Ordenar por score e aplicar diversidade
        recommendations = self._apply_diversity(recommendations, limit)

        return recommendations[:limit]

    async def _get_user_interactions(self, user_id: str) -> Dict[str, Any]:
        """Obter histórico de interações do utilizador"""

        # Visitas
        visits = await self.db.visits.find(
            {"user_id": user_id},
            {"_id": 0, "poi_id": 1, "category": 1, "region": 1, "timestamp": 1}
        ).sort("timestamp", -1).limit(100).to_list(100)

        # Favoritos
        user = await self.db.users.find_one({"user_id": user_id}, {"_id": 0, "favorites": 1})
        favorites = user.get("favorites", []) if user else []

        # Progressos
        progress = await self.db.user_progress.find_one({"user_id": user_id}, {"_id": 0})

        return {
            "visits": visits,
            "favorites": favorites,
            "progress": progress or {},
            "visit_count_by_category": self._count_by_field(visits, "category"),
            "visit_count_by_region": self._count_by_field(visits, "region")
        }

    async def _calculate_interest_profile(
        self,
        preferences: UserPreferences,
        interactions: Dict[str, Any]
    ) -> Dict[str, float]:
        """Calcular perfil de interesse combinando preferências explícitas e comportamento"""

        profile = {}

        # Interesses explícitos das preferências (peso 0.4)
        for theme in preferences.favorite_themes:
            profile[f"theme_{theme.value}"] = profile.get(f"theme_{theme.value}", 0) + 0.4

        for region in preferences.favorite_regions:
            profile[f"region_{region.value}"] = profile.get(f"region_{region.value}", 0) + 0.4

        # Perfis de viajante (peso 0.3)
        for traveler_type, weight in preferences.traveler_profiles.items():
            theme_mapping = self._traveler_to_themes(traveler_type)
            for theme in theme_mapping:
                profile[f"theme_{theme}"] = profile.get(f"theme_{theme}", 0) + (0.3 * weight)

        # Comportamento implícito (peso 0.3)
        category_counts = interactions.get("visit_count_by_category", {})
        total_visits = sum(category_counts.values()) or 1

        for category, count in category_counts.items():
            theme = self._category_to_theme(category)
            if theme:
                profile[f"theme_{theme}"] = profile.get(f"theme_{theme}", 0) + (0.3 * count / total_visits)

        region_counts = interactions.get("visit_count_by_region", {})
        total_region_visits = sum(region_counts.values()) or 1

        for region, count in region_counts.items():
            profile[f"region_{region}"] = profile.get(f"region_{region}", 0) + (0.3 * count / total_region_visits)

        # Normalizar scores
        max_score = max(profile.values()) if profile else 1
        return {k: v / max_score for k, v in profile.items()}

    async def _get_candidates(
        self,
        interest_profile: Dict[str, float],
        exclude_ids: List[str],
        limit: int
    ) -> List[Dict[str, Any]]:
        """Obter candidatos baseados no perfil de interesse"""

        # Construir query baseada nos interesses mais fortes
        top_interests = sorted(interest_profile.items(), key=lambda x: x[1], reverse=True)[:5]

        query = {"id": {"$nin": exclude_ids}}

        # Adicionar filtros por tema/região mais relevantes
        theme_filters = []
        region_filters = []

        for interest, score in top_interests:
            if interest.startswith("theme_"):
                theme = interest.replace("theme_", "")
                categories = self._theme_to_categories(theme)
                if categories:
                    theme_filters.extend(categories)
            elif interest.startswith("region_"):
                region = interest.replace("region_", "")
                region_filters.append(region)

        if theme_filters:
            query["category"] = {"$in": list(set(theme_filters))}
        if region_filters:
            query["region"] = {"$in": list(set(region_filters))}

        # Obter itens
        items = await self.db.heritage_items.find(
            query,
            {"_id": 0}
        ).limit(limit).to_list(limit)

        # Se poucos resultados, relaxar filtros
        if len(items) < limit // 2:
            items = await self.db.heritage_items.find(
                {"id": {"$nin": exclude_ids}},
                {"_id": 0}
            ).limit(limit).to_list(limit)

        return items

    async def _calculate_relevance_score(
        self,
        item: Dict[str, Any],
        preferences: UserPreferences,
        interest_profile: Dict[str, float],
        interactions: Dict[str, Any]
    ) -> float:
        """Calcular score de relevância para um item"""

        score = 0.0

        # Match com perfil de interesse (40%)
        category = item.get("category", "")
        theme = self._category_to_theme(category)
        if theme and f"theme_{theme}" in interest_profile:
            score += 0.4 * interest_profile[f"theme_{theme}"]

        region = item.get("region", "")
        if f"region_{region}" in interest_profile:
            score += 0.3 * interest_profile[f"region_{region}"]

        # Novidade (20%) - itens não visitados têm boost
        visited_ids = [v.get("poi_id") for v in interactions.get("visits", [])]
        if item.get("id") not in visited_ids:
            score += 0.2

        # Qualidade do conteúdo (10%)
        if item.get("image_url"):
            score += 0.05
        if len(item.get("description", "")) > 100:
            score += 0.05

        # Tags match (10%)
        user_interests = set(preferences.interests)
        item_tags = set(item.get("tags", []))
        if user_interests & item_tags:
            score += 0.1 * len(user_interests & item_tags) / len(user_interests or {1})

        return min(1.0, score)

    def _apply_diversity(
        self,
        recommendations: List[Recommendation],
        limit: int
    ) -> List[Recommendation]:
        """Aplicar filtro de diversidade para evitar monotonia"""

        # Ordenar por score
        sorted_recs = sorted(recommendations, key=lambda x: x.final_score, reverse=True)

        diverse_recs = []
        category_counts = {}

        for rec in sorted_recs:
            category = rec.thematic_axis.value if rec.thematic_axis else "other"

            # Verificar limite de categoria
            if category_counts.get(category, 0) < RecommendationWeights.MAX_SAME_CATEGORY:
                diverse_recs.append(rec)
                category_counts[category] = category_counts.get(category, 0) + 1

            if len(diverse_recs) >= limit:
                break

        return diverse_recs

    def _generate_reason(self, item: Dict[str, Any], preferences: UserPreferences) -> str:
        """Gerar razão contextual para a recomendação"""

        reasons = []

        # Match com perfil de viajante
        if preferences.primary_profile:
            profile_reasons = {
                TravelerProfile.NATURE_LOVER: "Perfeito para amantes da natureza",
                TravelerProfile.GASTRONOME: "Ideal para exploradores gastronómicos",
                TravelerProfile.CULTURE_SEEKER: "Para quem aprecia cultura",
                TravelerProfile.WELLNESS_SEEKER: "Ótimo para relaxar",
                TravelerProfile.ADVENTURE_SEEKER: "Para espíritos aventureiros",
            }
            if preferences.primary_profile in profile_reasons:
                reasons.append(profile_reasons[preferences.primary_profile])

        # Match com região favorita
        if item.get("region") in [r.value for r in preferences.favorite_regions]:
            reasons.append("Na sua região favorita")

        # Fallback
        if not reasons:
            reasons.append("Baseado no seu perfil")

        return reasons[0]

    def _map_to_thematic_axis(self, category: str) -> Optional[ThematicAxis]:
        """Mapear categoria para eixo temático"""
        mapping = {
            "termas_banhos": ThematicAxis.WELLNESS_THERMAL,
            "praias_fluviais": ThematicAxis.COASTAL_NAUTICAL,
            "surf": ThematicAxis.COASTAL_NAUTICAL,
            "miradouros": ThematicAxis.NATURE_ADVENTURE,
            "cascatas_pocos": ThematicAxis.NATURE_ADVENTURE,
            "rotas_tematicas": ThematicAxis.CULTURE_HERITAGE,
            "restaurantes_gastronomia": ThematicAxis.GASTRONOMY_WINES,
            "festas_romarias": ThematicAxis.RELIGIOUS,
            "musica_tradicional": ThematicAxis.CULTURE_HERITAGE,
            "aventura_natureza": ThematicAxis.NATURE_ADVENTURE,
            "natureza_especializada": ThematicAxis.NATURE_ADVENTURE,
            "produtores_dop": ThematicAxis.GASTRONOMY_WINES,
            "percursos_pedestres": ThematicAxis.NATURE_ADVENTURE,
            "arqueologia_geologia": ThematicAxis.CULTURE_HERITAGE,
            "arte_urbana": ThematicAxis.CULTURE_HERITAGE,
            "tabernas_historicas": ThematicAxis.GASTRONOMY_WINES,
            "oficios_artesanato": ThematicAxis.CULTURE_HERITAGE,
            "castelos": ThematicAxis.CULTURE_HERITAGE,
            "museus": ThematicAxis.CULTURE_HERITAGE,
            "ecovias_passadicos": ThematicAxis.NATURE_ADVENTURE,
            "mercados_feiras": ThematicAxis.GASTRONOMY_WINES,
            "fauna_autoctone": ThematicAxis.NATURE_ADVENTURE,
            "flora_autoctone": ThematicAxis.NATURE_ADVENTURE,
            "moinhos_azenhas": ThematicAxis.CULTURE_HERITAGE,
            "barragens_albufeiras": ThematicAxis.NATURE_ADVENTURE,
            "alojamentos_rurais": ThematicAxis.NATURE_ADVENTURE,
        }
        return mapping.get(category)

    def _map_to_region(self, region: str) -> Optional[Region]:
        """Mapear string para enum Region"""
        try:
            return Region(region)
        except ValueError:
            return None

    def _traveler_to_themes(self, traveler_type: str) -> List[str]:
        """Mapear tipo de viajante para temas"""
        mapping = {
            "nature_lover": ["nature_adventure"],
            "gastronome": ["gastronomy_wines"],
            "culture_seeker": ["culture_heritage"],
            "wellness_seeker": ["wellness_thermal"],
            "adventure_seeker": ["nature_adventure"],
            "spiritual": ["religious"],
        }
        return mapping.get(traveler_type, [])

    def _category_to_theme(self, category: str) -> Optional[str]:
        """Mapear categoria para tema"""
        mapping = {
            "termas_banhos": "wellness_thermal",
            "restaurantes_gastronomia": "gastronomy_wines",
            "tabernas_historicas": "gastronomy_wines",
            "produtores_dop": "gastronomy_wines",
            "festas_romarias": "religious",
            "aventura_natureza": "nature_adventure",
            "percursos_pedestres": "nature_adventure",
            "rotas_tematicas": "culture_heritage",
            "arte_urbana": "culture_heritage",
            "arqueologia_geologia": "culture_heritage",
            "castelos": "culture_heritage",
            "museus": "culture_heritage",
        }
        return mapping.get(category)

    def _theme_to_categories(self, theme: str) -> List[str]:
        """Mapear tema para categorias"""
        mapping = {
            "wellness_thermal": ["termas_banhos"],
            "gastronomy_wines": ["restaurantes_gastronomia", "produtores_dop", "tabernas_historicas", "mercados_feiras"],
            "nature_adventure": ["aventura_natureza", "percursos_pedestres", "miradouros", "cascatas_pocos", "natureza_especializada"],
            "culture_heritage": ["rotas_tematicas", "arte_urbana", "arqueologia_geologia", "musica_tradicional", "castelos", "museus"],
            "religious": ["festas_romarias"],
            "coastal_nautical": ["praias_fluviais", "surf"],
        }
        return mapping.get(theme, [])

    def _count_by_field(self, items: List[Dict], field: str) -> Dict[str, int]:
        """Contar itens por campo"""
        counts = {}
        for item in items:
            value = item.get(field)
            if value:
                counts[value] = counts.get(value, 0) + 1
        return counts


# ========================
# EDITORIAL RECOMMENDATIONS
# ========================

class EditorialRecommender:
    """Recomendador baseado em curadoria editorial"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def get_recommendations(
        self,
        preferences: UserPreferences,
        limit: int = 10,
        exclude_ids: List[str] = []
    ) -> List[Recommendation]:
        """Obter recomendações da curadoria editorial"""

        # Obter curadorias ativas e relevantes
        query = {
            "status": "published",
            "expires_at": {"$gt": datetime.now(timezone.utc)}
        }

        # Filtrar por região se preferências definidas
        if preferences.favorite_regions:
            query["region"] = {"$in": [r.value for r in preferences.favorite_regions]}

        curations = await self.db.editorial_curations.find(
            query,
            {"_id": 0}
        ).sort([("featured", -1), ("priority", -1)]).limit(limit * 2).to_list(limit * 2)

        # Se poucas curadorias, obter todas publicadas
        if len(curations) < limit // 2:
            curations = await self.db.editorial_curations.find(
                {"status": "published"},
                {"_id": 0}
            ).sort([("featured", -1), ("priority", -1)]).limit(limit * 2).to_list(limit * 2)

        recommendations = []

        for curation in curations:
            # Obter itens da curadoria
            item_ids = curation.get("items", [])
            for item_id in item_ids:
                if item_id in exclude_ids:
                    continue

                item = await self.db.heritage_items.find_one({"id": item_id}, {"_id": 0})
                if not item:
                    continue

                # Calcular score editorial
                editorial_score = self._calculate_editorial_score(curation)

                rec = Recommendation(
                    content_type="heritage_item",
                    content_id=item["id"],
                    content_name=item["name"],
                    content_description=item.get("description", "")[:200],
                    content_image=item.get("image_url"),
                    source=RecommendationSource.EDITORIAL,
                    source_weight=RecommendationWeights.EDITORIAL_WEIGHT,
                    editorial_score=editorial_score,
                    final_score=editorial_score * RecommendationWeights.EDITORIAL_WEIGHT,
                    context_reason=f"Escolha de {curation.get('curator_name', 'curador')}: {curation.get('title', '')}",
                    journey_phase=JourneyPhase.DREAM,
                    thematic_axis=self._map_theme(curation.get("theme")),
                    region=self._map_region(curation.get("region"))
                )
                recommendations.append(rec)

                if len(recommendations) >= limit:
                    break

            if len(recommendations) >= limit:
                break

        return recommendations

    def _calculate_editorial_score(self, curation: Dict[str, Any]) -> float:
        """Calcular score editorial"""
        score = 0.5  # Base

        if curation.get("featured"):
            score += 0.3

        # Boost por engagement
        views = curation.get("views", 0)
        if views > 1000:
            score += 0.1
        elif views > 100:
            score += 0.05

        likes = curation.get("likes", 0)
        if likes > 100:
            score += 0.1
        elif likes > 10:
            score += 0.05

        return min(1.0, score)

    def _map_theme(self, theme: Optional[str]) -> Optional[ThematicAxis]:
        try:
            return ThematicAxis(theme) if theme else None
        except ValueError:
            return None

    def _map_region(self, region: Optional[str]) -> Optional[Region]:
        try:
            return Region(region) if region else None
        except ValueError:
            return None


# ========================
# COMMUNITY RECOMMENDATIONS
# ========================

class CommunityRecommender:
    """Recomendador baseado em descoberta comunitária"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def get_recommendations(
        self,
        preferences: UserPreferences,
        limit: int = 10,
        exclude_ids: List[str] = []
    ) -> List[Recommendation]:
        """Obter recomendações da comunidade (trending, novidades, validação social)"""

        recommendations = []

        # 1. Trending - itens com crescimento recente de visitas
        trending = await self._get_trending_items(limit // 2, exclude_ids)

        for item, score in trending:
            rec = Recommendation(
                content_type="heritage_item",
                content_id=item["id"],
                content_name=item["name"],
                content_description=item.get("description", "")[:200],
                content_image=item.get("image_url"),
                source=RecommendationSource.COMMUNITY,
                source_weight=RecommendationWeights.COMMUNITY_WEIGHT,
                community_score=score,
                final_score=score * RecommendationWeights.COMMUNITY_WEIGHT,
                context_reason="Em tendência na comunidade",
                journey_phase=JourneyPhase.DREAM
            )
            recommendations.append(rec)

        # 2. Novidades - itens com boas avaliações recentes
        novelties = await self._get_novel_items(limit // 2, exclude_ids + [r.content_id for r in recommendations])

        for item, score in novelties:
            rec = Recommendation(
                content_type="heritage_item",
                content_id=item["id"],
                content_name=item["name"],
                content_description=item.get("description", "")[:200],
                content_image=item.get("image_url"),
                source=RecommendationSource.COMMUNITY,
                source_weight=RecommendationWeights.COMMUNITY_WEIGHT,
                community_score=score,
                final_score=score * RecommendationWeights.COMMUNITY_WEIGHT,
                context_reason="Descoberta recente da comunidade",
                journey_phase=JourneyPhase.DREAM
            )
            recommendations.append(rec)

        return recommendations

    async def _get_trending_items(
        self,
        limit: int,
        exclude_ids: List[str]
    ) -> List[Tuple[Dict[str, Any], float]]:
        """Obter itens em tendência"""

        # Contar visitas dos últimos 7 dias
        week_ago = datetime.now(timezone.utc) - timedelta(days=7)

        pipeline = [
            {"$match": {"timestamp": {"$gte": week_ago}}},
            {"$group": {"_id": "$poi_id", "visit_count": {"$sum": 1}}},
            {"$sort": {"visit_count": -1}},
            {"$limit": limit * 2}
        ]

        trending_ids = await self.db.visits.aggregate(pipeline).to_list(limit * 2)

        results = []
        for trend in trending_ids:
            if trend["_id"] in exclude_ids:
                continue

            item = await self.db.heritage_items.find_one({"id": trend["_id"]}, {"_id": 0})
            if item:
                # Score baseado em visitas (normalizado)
                score = min(1.0, trend["visit_count"] / 50)
                results.append((item, score))

        return results[:limit]

    async def _get_novel_items(
        self,
        limit: int,
        exclude_ids: List[str]
    ) -> List[Tuple[Dict[str, Any], float]]:
        """Obter itens novos ou redescobertos"""

        # Itens com poucas visitas mas boa avaliação
        # Ou itens recentemente adicionados

        month_ago = datetime.now(timezone.utc) - timedelta(days=30)

        # Itens recentes
        recent_items = await self.db.heritage_items.find(
            {
                "created_at": {"$gte": month_ago},
                "id": {"$nin": exclude_ids}
            },
            {"_id": 0}
        ).limit(limit).to_list(limit)

        results = []
        for item in recent_items:
            # Score de novidade
            score = 0.7  # Boost para itens novos
            results.append((item, score))

        # Se poucos resultados, adicionar itens aleatórios pouco visitados
        if len(results) < limit:
            remaining = limit - len(results)
            random_items = await self.db.heritage_items.find(
                {"id": {"$nin": exclude_ids + [r[0]["id"] for r in results]}},
                {"_id": 0}
            ).limit(remaining * 3).to_list(remaining * 3)

            # Selecionar aleatoriamente
            if random_items:
                selected = random.sample(random_items, min(remaining, len(random_items)))
                for item in selected:
                    results.append((item, 0.5))

        return results[:limit]


# ========================
# HYBRID RECOMMENDATION SERVICE
# ========================

class HybridRecommendationService:
    """Serviço de Recomendação Híbrido - Combina as três fontes"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.algorithm = AlgorithmRecommender(db)
        self.editorial = EditorialRecommender(db)
        self.community = CommunityRecommender(db)

    async def get_discovery_feed(
        self,
        user_id: str,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        limit: int = 30
    ) -> List[DiscoveryFeedItem]:
        """Gerar feed de descoberta personalizado"""

        # Obter preferências do utilizador
        preferences = await self._get_user_preferences(user_id)

        # Calcular limites por fonte
        algo_limit = int(limit * RecommendationWeights.ALGORITHM_WEIGHT)
        editorial_limit = int(limit * RecommendationWeights.EDITORIAL_WEIGHT)
        community_limit = limit - algo_limit - editorial_limit

        # Obter recomendações de cada fonte em paralelo
        algo_recs = await self.algorithm.get_recommendations(user_id, preferences, algo_limit)
        editorial_recs = await self.editorial.get_recommendations(preferences, editorial_limit)
        community_recs = await self.community.get_recommendations(preferences, community_limit)

        # Combinar e ordenar
        all_recs = algo_recs + editorial_recs + community_recs

        # Calcular score final combinado
        for rec in all_recs:
            rec.final_score = (
                rec.relevance_score * RecommendationWeights.ALGORITHM_WEIGHT +
                rec.editorial_score * RecommendationWeights.EDITORIAL_WEIGHT +
                rec.community_score * RecommendationWeights.COMMUNITY_WEIGHT
            )

        # Ordenar por score final
        all_recs.sort(key=lambda x: x.final_score, reverse=True)

        # Converter para feed items
        feed_items = []
        for i, rec in enumerate(all_recs):
            section = self._determine_section(rec)

            feed_item = DiscoveryFeedItem(
                section=section,
                content_type=rec.content_type,
                content_id=rec.content_id,
                content_data={
                    "name": rec.content_name,
                    "description": rec.content_description,
                    "image_url": rec.content_image,
                    "source": rec.source.value,
                    "reason": rec.context_reason
                },
                position=i,
                section_position=0,  # Seria calculado por secção
                relevance_score=rec.final_score,
                reason=rec.context_reason
            )
            feed_items.append(feed_item)

        return feed_items

    async def _get_user_preferences(self, user_id: str) -> UserPreferences:
        """Obter ou criar preferências do utilizador"""

        prefs_doc = await self.db.user_preferences.find_one(
            {"user_id": user_id},
            {"_id": 0}
        )

        if prefs_doc:
            return UserPreferences(**prefs_doc)

        # Criar preferências padrão
        default_prefs = UserPreferences(user_id=user_id)
        await self.db.user_preferences.insert_one(default_prefs.dict())

        return default_prefs

    def _determine_section(self, rec: Recommendation) -> DiscoverySection:
        """Determinar secção do feed baseada na fonte"""

        if rec.source == RecommendationSource.ALGORITHM:
            return DiscoverySection.FOR_YOU
        elif rec.source == RecommendationSource.EDITORIAL:
            return DiscoverySection.EDITORIAL_PICKS
        else:
            return DiscoverySection.TRENDING


# Factory function
def create_recommendation_service(db: AsyncIOMotorDatabase) -> HybridRecommendationService:
    """Criar instância do serviço de recomendação"""
    return HybridRecommendationService(db)
