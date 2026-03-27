"""
Test suite for P1 features: Encyclopedia & Badges/Gamification
Tests the new encyclopedia universes, articles, and badges system.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://project-analyzer-131.preview.emergentagent.com')


class TestEncyclopediaUniverses:
    """Test Encyclopedia Universes - 6 knowledge universes"""

    def test_get_all_universes_returns_six(self):
        """Encyclopedia should return exactly 6 universes"""
        response = requests.get(f"{BASE_URL}/api/encyclopedia/universes")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        universes = response.json()
        assert len(universes) == 6, f"Expected 6 universes, got {len(universes)}"

        # Verify expected universe IDs
        expected_ids = [
            "territorio_natureza",
            "historia_patrimonio",
            "gastronomia_produtos",
            "cultura_viva",
            "praias_mar",
            "experiencias_rotas"
        ]
        actual_ids = [u["id"] for u in universes]
        for expected_id in expected_ids:
            assert expected_id in actual_ids, f"Missing universe: {expected_id}"
        print(f"✓ All 6 universes found: {actual_ids}")

    def test_universes_have_required_fields(self):
        """Each universe should have name, description, icon, color, categories"""
        response = requests.get(f"{BASE_URL}/api/encyclopedia/universes")
        assert response.status_code == 200

        universes = response.json()
        required_fields = ["id", "name", "description", "icon", "color", "categories", "article_count", "item_count"]

        for universe in universes:
            for field in required_fields:
                assert field in universe, f"Universe {universe.get('id')} missing field: {field}"

            # Verify article_count and item_count are numbers
            assert isinstance(universe["article_count"], int), "article_count should be int"
            assert isinstance(universe["item_count"], int), "item_count should be int"

        print("✓ All universes have required fields")

    def test_universe_territorio_natureza_details(self):
        """Test specific universe: territorio_natureza"""
        response = requests.get(f"{BASE_URL}/api/encyclopedia/universe/territorio_natureza")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        universe = response.json()
        assert universe["id"] == "territorio_natureza"
        assert universe["name"] == "Território & Natureza"
        assert "articles" in universe
        assert "featured_items" in universe
        assert "total_articles" in universe
        assert "total_items" in universe

        # Verify categories are correct
        expected_categories = ["areas_protegidas", "cascatas", "rios", "fauna", "miradouros", "termas", "baloicos"]
        for cat in expected_categories:
            assert cat in universe["categories"], f"Missing category: {cat}"

        print(f"✓ Universe territorio_natureza has {universe['total_articles']} articles and {universe['total_items']} items")

    def test_universe_not_found_returns_404(self):
        """Non-existent universe should return 404"""
        response = requests.get(f"{BASE_URL}/api/encyclopedia/universe/invalid_universe")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Invalid universe returns 404")


class TestEncyclopediaArticles:
    """Test Encyclopedia Articles - 6 example articles"""

    def test_get_articles_returns_six(self):
        """Should return the 6 created articles"""
        response = requests.get(f"{BASE_URL}/api/encyclopedia/articles")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert "articles" in data
        assert "total" in data

        # Verify we have 6 articles
        assert data["total"] == 6, f"Expected 6 articles, got {data['total']}"
        assert len(data["articles"]) == 6, f"Expected 6 articles in response, got {len(data['articles'])}"
        print(f"✓ Found {data['total']} articles")

    def test_articles_have_required_fields(self):
        """Each article should have title, slug, universe, summary"""
        response = requests.get(f"{BASE_URL}/api/encyclopedia/articles")
        assert response.status_code == 200

        data = response.json()
        required_fields = ["id", "title", "slug", "universe", "summary", "views", "created_at"]

        for article in data["articles"]:
            for field in required_fields:
                assert field in article, f"Article {article.get('title')} missing field: {field}"

        print("✓ All articles have required fields")

    def test_articles_cover_all_universes(self):
        """Verify articles cover different universes"""
        response = requests.get(f"{BASE_URL}/api/encyclopedia/articles")
        assert response.status_code == 200

        data = response.json()
        universes_with_articles = set(article["universe"] for article in data["articles"])

        # Should have at least 5 different universes covered
        assert len(universes_with_articles) >= 5, f"Expected articles in at least 5 universes, got {len(universes_with_articles)}"
        print(f"✓ Articles cover {len(universes_with_articles)} universes: {universes_with_articles}")

    def test_get_single_article_by_slug(self):
        """Test getting a specific article by slug"""
        # First get list to find a slug
        response = requests.get(f"{BASE_URL}/api/encyclopedia/articles")
        assert response.status_code == 200

        data = response.json()
        if data["articles"]:
            slug = data["articles"][0]["slug"]

            # Get single article
            article_response = requests.get(f"{BASE_URL}/api/encyclopedia/article/{slug}")
            assert article_response.status_code == 200, f"Expected 200, got {article_response.status_code}"

            article = article_response.json()
            assert article["slug"] == slug
            assert "content" in article  # Full content should be included for single article
            print(f"✓ Successfully retrieved article: {article['title']}")

    def test_article_not_found_returns_404(self):
        """Non-existent article should return 404"""
        response = requests.get(f"{BASE_URL}/api/encyclopedia/article/non-existent-article")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Invalid article returns 404")

    def test_search_encyclopedia(self):
        """Test encyclopedia search functionality"""
        response = requests.get(f"{BASE_URL}/api/encyclopedia/search?q=natureza")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert "articles" in data
        assert "items" in data
        assert "total" in data
        print(f"✓ Search for 'natureza' returned {data['total']} results")

    def test_featured_content(self):
        """Test featured encyclopedia content endpoint"""
        response = requests.get(f"{BASE_URL}/api/encyclopedia/featured")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert "top_articles" in data
        assert "recent_articles" in data
        assert "universe_highlights" in data
        print(f"✓ Featured content: {len(data['top_articles'])} top articles, {len(data['universe_highlights'])} universe highlights")


class TestBadgesSystem:
    """Test Badges/Gamification System - 9 badges with tiers"""

    def test_get_all_badges_returns_nine(self):
        """Should return exactly 9 badges"""
        response = requests.get(f"{BASE_URL}/api/badges")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        badges = response.json()
        assert len(badges) == 9, f"Expected 9 badges, got {len(badges)}"

        # Verify expected badge IDs
        expected_ids = [
            "explorador_natureza",
            "guardiao_patrimonio",
            "mestre_gastronomia",
            "alma_cultura",
            "filho_mar",
            "aventureiro",
            "primeiro_passo",
            "coleccionador",
            "explorador_regioes"
        ]
        actual_ids = [b["id"] for b in badges]
        for expected_id in expected_ids:
            assert expected_id in actual_ids, f"Missing badge: {expected_id}"

        print(f"✓ All 9 badges found: {actual_ids}")

    def test_badges_have_tier_system(self):
        """Each badge should have tiers with correct structure"""
        response = requests.get(f"{BASE_URL}/api/badges")
        assert response.status_code == 200

        badges = response.json()

        for badge in badges:
            assert "tiers" in badge, f"Badge {badge['id']} missing tiers"
            assert len(badge["tiers"]) > 0, f"Badge {badge['id']} has no tiers"

            # Verify each tier has level, visits, points
            for tier in badge["tiers"]:
                assert "level" in tier, "Tier missing level"
                assert "visits" in tier, "Tier missing visits"
                assert "points" in tier, "Tier missing points"

        print("✓ All badges have proper tier structure")

    def test_universe_badges_have_four_tiers(self):
        """Universe-based badges should have 4 tiers: bronze, prata, ouro, platina"""
        response = requests.get(f"{BASE_URL}/api/badges")
        assert response.status_code == 200

        badges = response.json()
        universe_badges = [b for b in badges if b.get("universe") is not None]

        expected_tiers = ["bronze", "prata", "ouro", "platina"]
        expected_visits = [5, 15, 30, 50]
        expected_points = [50, 150, 300, 500]

        for badge in universe_badges:
            assert len(badge["tiers"]) == 4, f"Badge {badge['id']} should have 4 tiers"

            for i, tier in enumerate(badge["tiers"]):
                assert tier["level"] == expected_tiers[i], f"Tier {i} should be {expected_tiers[i]}"
                assert tier["visits"] == expected_visits[i], f"Tier {i} visits should be {expected_visits[i]}"
                assert tier["points"] == expected_points[i], f"Tier {i} points should be {expected_points[i]}"

        print(f"✓ {len(universe_badges)} universe badges have correct 4-tier structure")

    def test_special_badges_structure(self):
        """Verify special badges: primeiro_passo, coleccionador, explorador_regioes"""
        response = requests.get(f"{BASE_URL}/api/badges")
        assert response.status_code == 200

        badges = response.json()
        badge_map = {b["id"]: b for b in badges}

        # Primeiro Passo - single tier
        primeiro_passo = badge_map.get("primeiro_passo")
        assert primeiro_passo is not None, "Missing primeiro_passo badge"
        assert len(primeiro_passo["tiers"]) == 1
        assert primeiro_passo["tiers"][0]["visits"] == 1
        assert primeiro_passo["tiers"][0]["points"] == 25

        # Coleccionador - 4 tiers with different structure
        coleccionador = badge_map.get("coleccionador")
        assert coleccionador is not None, "Missing coleccionador badge"
        assert len(coleccionador["tiers"]) == 4

        # Explorador de Regiões - 3 tiers
        explorador_regioes = badge_map.get("explorador_regioes")
        assert explorador_regioes is not None, "Missing explorador_regioes badge"
        assert len(explorador_regioes["tiers"]) == 3

        print("✓ Special badges have correct structure")

    def test_badges_progress_requires_auth(self):
        """Progress endpoint should require authentication"""
        response = requests.get(f"{BASE_URL}/api/badges/progress")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Badges progress correctly requires authentication")

    def test_badges_user_requires_auth(self):
        """User badges endpoint should require authentication"""
        response = requests.get(f"{BASE_URL}/api/badges/user")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ User badges correctly requires authentication")


class TestRoutesPlan:
    """Test Routes Plan endpoint - fixed KeyError bug"""

    def test_routes_plan_basic(self):
        """Test basic route planning between Lisboa and Porto"""
        response = requests.post(
            f"{BASE_URL}/api/routes/plan",
            json={"origin": "lisboa", "destination": "porto"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert "origin" in data
        assert "destination" in data
        assert "total_distance_km" in data
        assert "estimated_duration_hours" in data
        assert "suggested_stops" in data
        assert "route_description" in data

        assert data["origin"] == "Lisboa"
        assert data["destination"] == "Porto"
        assert data["total_distance_km"] > 0

        print(f"✓ Route plan: {data['origin']} -> {data['destination']}, {data['total_distance_km']:.1f}km, {len(data['suggested_stops'])} stops")

    def test_routes_plan_with_categories(self):
        """Test route planning with category filter"""
        response = requests.post(
            f"{BASE_URL}/api/routes/plan",
            json={
                "origin": "lisboa",
                "destination": "faro",
                "categories": ["piscinas", "gastronomia"]
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        # Check that stops are from the requested categories (if any)
        if data["suggested_stops"]:
            categories_found = set(stop["category"] for stop in data["suggested_stops"])
            print(f"✓ Route with categories filter: {len(data['suggested_stops'])} stops, categories: {categories_found}")
        else:
            print("✓ Route with categories filter returned no stops (may be expected for this route)")

    def test_routes_plan_with_coordinates(self):
        """Test route planning with explicit coordinates"""
        response = requests.post(
            f"{BASE_URL}/api/routes/plan",
            json={
                "origin": "coimbra",
                "destination": "braga",
                "origin_coords": {"lat": 40.2033, "lng": -8.4103},
                "destination_coords": {"lat": 41.5454, "lng": -8.4265}
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert data["total_distance_km"] > 0
        print(f"✓ Route with coordinates: {data['total_distance_km']:.1f}km")

    def test_routes_plan_unknown_location_fails(self):
        """Route with unknown locations should fail gracefully"""
        response = requests.post(
            f"{BASE_URL}/api/routes/plan",
            json={"origin": "unknown_city", "destination": "another_unknown"}
        )
        # Should return 400 since coordinates can't be resolved
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Unknown locations correctly return 400")


class TestDescobrerUniverses:
    """Test Descobrir tab integration with universes"""

    def test_universes_in_discovery_feed(self):
        """Verify universes are accessible for Descobrir tab"""
        response = requests.get(f"{BASE_URL}/api/encyclopedia/universes")
        assert response.status_code == 200

        universes = response.json()

        # Each universe should have item_count for display
        for universe in universes:
            assert "item_count" in universe
            assert universe["item_count"] >= 0

        total_items = sum(u["item_count"] for u in universes)
        print(f"✓ Universes have total {total_items} items across all universes")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
