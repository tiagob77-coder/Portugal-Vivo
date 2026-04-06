#!/usr/bin/env python3
"""
Backend API Testing for Portugal Vivo
Tests the 3 new features: Search, Encyclopedia, and General endpoints
"""

import asyncio
import aiohttp
import json
import sys
from typing import Dict, Any, List

# Backend URL from environment
BACKEND_URL = "https://portugal-vivo-3.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
    
    def add_result(self, test_name: str, passed: bool, message: str, details: Dict = None):
        self.results.append({
            "test": test_name,
            "passed": passed,
            "message": message,
            "details": details or {}
        })
        if passed:
            self.passed += 1
        else:
            self.failed += 1
    
    def print_summary(self):
        print(f"\n{'='*60}")
        print(f"TEST SUMMARY")
        print(f"{'='*60}")
        print(f"✅ PASSED: {self.passed}")
        print(f"❌ FAILED: {self.failed}")
        print(f"TOTAL: {self.passed + self.failed}")
        print(f"{'='*60}")
        
        if self.failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.results:
                if not result["passed"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        print(f"\n✅ PASSED TESTS:")
        for result in self.results:
            if result["passed"]:
                print(f"  - {result['test']}: {result['message']}")

async def make_request(session: aiohttp.ClientSession, method: str, url: str, **kwargs) -> Dict[str, Any]:
    """Make HTTP request and return response data"""
    try:
        async with session.request(method, url, **kwargs) as response:
            text = await response.text()
            try:
                data = json.loads(text) if text else {}
            except json.JSONDecodeError:
                data = {"raw_response": text}
            
            return {
                "status": response.status,
                "data": data,
                "headers": dict(response.headers)
            }
    except Exception as e:
        return {
            "status": 0,
            "data": {"error": str(e)},
            "headers": {}
        }

async def test_search_endpoints(session: aiohttp.ClientSession, test_result: TestResult):
    """Test all search endpoints"""
    print("\n🔍 TESTING SEARCH ENDPOINTS")
    print("-" * 40)
    
    # 1. POST /api/search with body {"query":"castelo","limit":5}
    search_data = {"query": "castelo", "limit": 5}
    response = await make_request(session, "POST", f"{API_BASE}/search", json=search_data)
    
    if response["status"] == 200:
        results = response["data"].get("results", [])
        if results and len(results) > 0:
            # Check if results have "type":"poi" field
            has_poi_type = all(result.get("type") == "poi" for result in results)
            if has_poi_type:
                test_result.add_result(
                    "POST /api/search (castelo)", True,
                    f"✅ Returns {len(results)} results with type='poi'",
                    {"results_count": len(results), "sample_result": results[0] if results else None}
                )
            else:
                test_result.add_result(
                    "POST /api/search (castelo)", False,
                    "❌ Results missing 'type':'poi' field",
                    {"results": results[:2]}
                )
        else:
            test_result.add_result(
                "POST /api/search (castelo)", False,
                "❌ No results returned",
                {"response": response["data"]}
            )
    else:
        test_result.add_result(
            "POST /api/search (castelo)", False,
            f"❌ HTTP {response['status']}: {response['data']}",
            {"response": response}
        )
    
    # 2. GET /api/search/global?q=praia&limit=5
    response = await make_request(session, "GET", f"{API_BASE}/search/global?q=praia&limit=5")
    
    if response["status"] == 200:
        results = response["data"].get("results", [])
        test_result.add_result(
            "GET /api/search/global (praia)", True,
            f"✅ Returns {len(results)} results",
            {"results_count": len(results), "total": response["data"].get("total", 0)}
        )
    else:
        test_result.add_result(
            "GET /api/search/global (praia)", False,
            f"❌ HTTP {response['status']}: {response['data']}",
            {"response": response}
        )
    
    # 3. GET /api/search/suggestions?q=serra
    response = await make_request(session, "GET", f"{API_BASE}/search/suggestions?q=serra")
    
    if response["status"] == 200:
        suggestions = response["data"].get("suggestions", [])
        test_result.add_result(
            "GET /api/search/suggestions (serra)", True,
            f"✅ Returns {len(suggestions)} suggestions",
            {"suggestions_count": len(suggestions), "suggestions": suggestions[:3]}
        )
    else:
        test_result.add_result(
            "GET /api/search/suggestions (serra)", False,
            f"❌ HTTP {response['status']}: {response['data']}",
            {"response": response}
        )
    
    # 4. GET /api/search/popular
    response = await make_request(session, "GET", f"{API_BASE}/search/popular")
    
    if response["status"] == 200:
        popular = response["data"]
        test_result.add_result(
            "GET /api/search/popular", True,
            "✅ Returns popular searches array",
            {"popular_data": popular}
        )
    else:
        test_result.add_result(
            "GET /api/search/popular", False,
            f"❌ HTTP {response['status']}: {response['data']}",
            {"response": response}
        )
    
    # 5. POST /api/search with body {"query":"gerês","limit":5} - Check image_url
    search_data = {"query": "gerês", "limit": 5}
    response = await make_request(session, "POST", f"{API_BASE}/search", json=search_data)
    
    if response["status"] == 200:
        results = response["data"].get("results", [])
        if results:
            # Check if all results have image_url
            has_image_urls = all(result.get("image_url") for result in results)
            if has_image_urls:
                test_result.add_result(
                    "POST /api/search (gerês) - image_url", True,
                    f"✅ All {len(results)} results have image_url",
                    {"results_with_images": len(results)}
                )
            else:
                missing_images = [r for r in results if not r.get("image_url")]
                test_result.add_result(
                    "POST /api/search (gerês) - image_url", False,
                    f"❌ {len(missing_images)} results missing image_url",
                    {"missing_images_count": len(missing_images)}
                )
        else:
            test_result.add_result(
                "POST /api/search (gerês) - image_url", False,
                "❌ No results returned for gerês",
                {"response": response["data"]}
            )
    else:
        test_result.add_result(
            "POST /api/search (gerês) - image_url", False,
            f"❌ HTTP {response['status']}: {response['data']}",
            {"response": response}
        )

async def test_encyclopedia_endpoints(session: aiohttp.ClientSession, test_result: TestResult):
    """Test encyclopedia endpoints"""
    print("\n📚 TESTING ENCYCLOPEDIA ENDPOINTS")
    print("-" * 40)
    
    # 1. GET /api/encyclopedia/articles?limit=3 - Check body field
    response = await make_request(session, "GET", f"{API_BASE}/encyclopedia/articles?limit=3")
    
    if response["status"] == 200:
        articles = response["data"].get("articles", [])
        if articles:
            # Check if articles have non-empty "body" field (not "NO BODY")
            articles_with_body = []
            articles_without_body = []
            
            for article in articles:
                body = article.get("body") or article.get("content", "")
                if body and body != "NO BODY" and len(body.strip()) > 0:
                    articles_with_body.append(article)
                else:
                    articles_without_body.append(article)
            
            if len(articles_with_body) == len(articles):
                test_result.add_result(
                    "GET /api/encyclopedia/articles - body field", True,
                    f"✅ All {len(articles)} articles have non-empty body",
                    {"articles_with_body": len(articles_with_body)}
                )
            else:
                test_result.add_result(
                    "GET /api/encyclopedia/articles - body field", False,
                    f"❌ {len(articles_without_body)} articles have empty/missing body",
                    {"articles_without_body": len(articles_without_body)}
                )
        else:
            test_result.add_result(
                "GET /api/encyclopedia/articles - body field", False,
                "❌ No articles returned",
                {"response": response["data"]}
            )
    else:
        test_result.add_result(
            "GET /api/encyclopedia/articles - body field", False,
            f"❌ HTTP {response['status']}: {response['data']}",
            {"response": response}
        )
    
    # 2. GET /api/encyclopedia/articles?limit=3 - Check image_url
    response = await make_request(session, "GET", f"{API_BASE}/encyclopedia/articles?limit=3")
    
    if response["status"] == 200:
        articles = response["data"].get("articles", [])
        if articles:
            articles_with_images = [a for a in articles if a.get("image_url")]
            if len(articles_with_images) == len(articles):
                test_result.add_result(
                    "GET /api/encyclopedia/articles - image_url", True,
                    f"✅ All {len(articles)} articles have image_url",
                    {"articles_with_images": len(articles_with_images)}
                )
            else:
                test_result.add_result(
                    "GET /api/encyclopedia/articles - image_url", False,
                    f"❌ {len(articles) - len(articles_with_images)} articles missing image_url",
                    {"articles_without_images": len(articles) - len(articles_with_images)}
                )
        else:
            test_result.add_result(
                "GET /api/encyclopedia/articles - image_url", False,
                "❌ No articles returned",
                {"response": response["data"]}
            )
    else:
        test_result.add_result(
            "GET /api/encyclopedia/articles - image_url", False,
            f"❌ HTTP {response['status']}: {response['data']}",
            {"response": response}
        )
    
    # 3. GET /api/encyclopedia/articles?limit=3 - Check reading_time field
    response = await make_request(session, "GET", f"{API_BASE}/encyclopedia/articles?limit=3")
    
    if response["status"] == 200:
        articles = response["data"].get("articles", [])
        if articles:
            articles_with_reading_time = [a for a in articles if "reading_time" in a]
            if len(articles_with_reading_time) == len(articles):
                test_result.add_result(
                    "GET /api/encyclopedia/articles - reading_time", True,
                    f"✅ All {len(articles)} articles have reading_time field",
                    {"articles_with_reading_time": len(articles_with_reading_time)}
                )
            else:
                test_result.add_result(
                    "GET /api/encyclopedia/articles - reading_time", False,
                    f"❌ {len(articles) - len(articles_with_reading_time)} articles missing reading_time",
                    {"articles_without_reading_time": len(articles) - len(articles_with_reading_time)}
                )
        else:
            test_result.add_result(
                "GET /api/encyclopedia/articles - reading_time", False,
                "❌ No articles returned",
                {"response": response["data"]}
            )
    else:
        test_result.add_result(
            "GET /api/encyclopedia/articles - reading_time", False,
            f"❌ HTTP {response['status']}: {response['data']}",
            {"response": response}
        )
    
    # 4. GET /api/encyclopedia/universes - Should return 6 universes with article counts
    response = await make_request(session, "GET", f"{API_BASE}/encyclopedia/universes")
    
    if response["status"] == 200:
        universes = response["data"]
        if isinstance(universes, list) and len(universes) == 6:
            # Check if all universes have article_count
            universes_with_counts = [u for u in universes if "article_count" in u]
            if len(universes_with_counts) == 6:
                test_result.add_result(
                    "GET /api/encyclopedia/universes", True,
                    f"✅ Returns 6 universes with article counts",
                    {"universes_count": len(universes), "sample_universe": universes[0] if universes else None}
                )
            else:
                test_result.add_result(
                    "GET /api/encyclopedia/universes", False,
                    f"❌ {6 - len(universes_with_counts)} universes missing article_count",
                    {"universes_without_counts": 6 - len(universes_with_counts)}
                )
        else:
            test_result.add_result(
                "GET /api/encyclopedia/universes", False,
                f"❌ Expected 6 universes, got {len(universes) if isinstance(universes, list) else 'non-list'}",
                {"universes": universes}
            )
    else:
        test_result.add_result(
            "GET /api/encyclopedia/universes", False,
            f"❌ HTTP {response['status']}: {response['data']}",
            {"response": response}
        )

async def test_general_endpoints(session: aiohttp.ClientSession, test_result: TestResult):
    """Test general endpoints"""
    print("\n🏥 TESTING GENERAL ENDPOINTS")
    print("-" * 40)
    
    # 1. GET /api/health - Should return ok
    response = await make_request(session, "GET", f"{API_BASE}/health")
    
    if response["status"] == 200:
        status = response["data"].get("status")
        if status == "ok" or status == "healthy":
            test_result.add_result(
                "GET /api/health", True,
                f"✅ Returns status: {status}",
                {"health_data": response["data"]}
            )
        else:
            test_result.add_result(
                "GET /api/health", False,
                f"❌ Expected status 'ok', got '{status}'",
                {"health_data": response["data"]}
            )
    else:
        test_result.add_result(
            "GET /api/health", False,
            f"❌ HTTP {response['status']}: {response['data']}",
            {"response": response}
        )
    
    # 2. GET /api/stats - total_items >= 5678
    response = await make_request(session, "GET", f"{API_BASE}/stats")
    
    if response["status"] == 200:
        total_items = response["data"].get("total_items", 0)
        if total_items >= 5678:
            test_result.add_result(
                "GET /api/stats", True,
                f"✅ total_items = {total_items} (>= 5678)",
                {"stats_data": response["data"]}
            )
        else:
            test_result.add_result(
                "GET /api/stats", False,
                f"❌ total_items = {total_items} (< 5678)",
                {"stats_data": response["data"]}
            )
    else:
        test_result.add_result(
            "GET /api/stats", False,
            f"❌ HTTP {response['status']}: {response['data']}",
            {"response": response}
        )
    
    # 3. GET /api/heritage?limit=2 - Each item has non-empty image_url
    response = await make_request(session, "GET", f"{API_BASE}/heritage?limit=2")
    
    if response["status"] == 200:
        # Handle both list and dict responses
        data = response["data"]
        if isinstance(data, list):
            items = data
        else:
            items = data.get("items", [])
        
        if items:
            items_with_images = [item for item in items if item.get("image_url")]
            if len(items_with_images) == len(items):
                test_result.add_result(
                    "GET /api/heritage - image_url", True,
                    f"✅ All {len(items)} items have non-empty image_url",
                    {"items_with_images": len(items_with_images)}
                )
            else:
                test_result.add_result(
                    "GET /api/heritage - image_url", False,
                    f"❌ {len(items) - len(items_with_images)} items missing image_url",
                    {"items_without_images": len(items) - len(items_with_images)}
                )
        else:
            test_result.add_result(
                "GET /api/heritage - image_url", False,
                "❌ No heritage items returned",
                {"response": response["data"]}
            )
    else:
        test_result.add_result(
            "GET /api/heritage - image_url", False,
            f"❌ HTTP {response['status']}: {response['data']}",
            {"response": response}
        )

async def main():
    """Main test runner"""
    print("🚀 STARTING PORTUGAL VIVO BACKEND TESTS")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"API Base: {API_BASE}")
    
    test_result = TestResult()
    
    # Create HTTP session with timeout
    timeout = aiohttp.ClientTimeout(total=30)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        # Test all endpoint groups
        await test_search_endpoints(session, test_result)
        await test_encyclopedia_endpoints(session, test_result)
        await test_general_endpoints(session, test_result)
    
    # Print final summary
    test_result.print_summary()
    
    # Exit with appropriate code
    sys.exit(0 if test_result.failed == 0 else 1)

if __name__ == "__main__":
    asyncio.run(main())