#!/usr/bin/env python3
"""
Backend API Testing for Portugal Vivo API after importing 5678 POIs from Excel
Tests the core endpoints that are critical for the heritage discovery platform.
"""

import requests
import json
import os
from datetime import datetime
from typing import Dict, List, Any, Optional

# Get backend URL from environment
def get_backend_url():
    """Get the backend URL from frontend .env file"""
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                    url = line.split('=', 1)[1].strip()
                    return f"{url}/api"
    except Exception as e:
        print(f"Error reading frontend .env: {e}")
    
    # Fallback to localhost as specified in review request
    return "http://localhost:8001/api"

BACKEND_URL = get_backend_url()
print(f"Testing backend at: {BACKEND_URL}")

class APITester:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.results = []
        
    def test_endpoint(self, method: str, endpoint: str, expected_status: int = 200, 
                     params: Optional[Dict] = None, json_data: Optional[Dict] = None, 
                     description: str = "") -> Dict[str, Any]:
        """Test a single API endpoint"""
        url = f"{self.base_url}{endpoint}"
        
        try:
            print(f"\n🔍 Testing {method} {endpoint}")
            if params:
                print(f"   Parameters: {params}")
            if json_data:
                print(f"   JSON Body: {json_data}")
            
            response = self.session.request(method, url, params=params, json=json_data, timeout=30)
            
            result = {
                "endpoint": endpoint,
                "method": method,
                "url": url,
                "status_code": response.status_code,
                "expected_status": expected_status,
                "success": response.status_code == expected_status,
                "description": description,
                "timestamp": datetime.now().isoformat(),
                "params": params,
                "json_data": json_data
            }
            
            if response.status_code == expected_status:
                try:
                    data = response.json()
                    result["response_data"] = data
                    result["data_type"] = type(data).__name__
                    
                    if isinstance(data, list):
                        result["item_count"] = len(data)
                    elif isinstance(data, dict):
                        result["response_keys"] = list(data.keys())
                        
                    print(f"   ✅ SUCCESS - Status: {response.status_code}")
                    if isinstance(data, list):
                        print(f"   📊 Returned {len(data)} items")
                    elif isinstance(data, dict) and 'total_items' in data:
                        print(f"   📊 Stats: {data.get('total_items', 0)} items, {data.get('total_routes', 0)} routes")
                    elif isinstance(data, dict) and 'status' in data:
                        print(f"   📊 Status: {data.get('status')}")
                        
                except json.JSONDecodeError:
                    result["response_text"] = response.text
                    print(f"   ⚠️  Non-JSON response: {response.text[:100]}")
            else:
                result["error"] = f"Expected {expected_status}, got {response.status_code}"
                result["response_text"] = response.text
                print(f"   ❌ FAILED - Expected: {expected_status}, Got: {response.status_code}")
                print(f"   Error: {response.text[:200]}")
                
        except requests.exceptions.RequestException as e:
            result = {
                "endpoint": endpoint,
                "method": method,
                "url": url,
                "success": False,
                "error": str(e),
                "description": description,
                "timestamp": datetime.now().isoformat(),
                "params": params,
                "json_data": json_data
            }
            print(f"   ❌ REQUEST FAILED - {str(e)}")
            
        self.results.append(result)
        return result
    
    def run_all_tests(self):
        """Run all API tests as specified in the review request - IMAGE ASSIGNMENT VERIFICATION"""
        print("=" * 80)
        print("🇵🇹 PORTUGAL VIVO API TESTING - IMAGE ASSIGNMENT VERIFICATION")
        print("=" * 80)
        
        # 1. Health check - Should return {"status":"ok"}
        self.test_endpoint("GET", "/health", description="Health check endpoint - should return 'ok'")
        
        # 2. Statistics - Should return total_items >= 5678
        self.test_endpoint("GET", "/stats", description="Get API statistics - should show total_items >= 5678")
        
        # 3. Categories - Should return categories with proper IDs matching new subcategory system
        self.test_endpoint("GET", "/categories", description="Get all heritage categories with proper IDs")
        
        # 4. Heritage by category castelos with limit=3 - Each item MUST have non-empty image_url with Unsplash URL
        self.test_endpoint("GET", "/heritage", params={"category": "castelos", "limit": 3}, 
                          description="CRITICAL: castelos items MUST have non-empty image_url with unsplash.com")
        
        # 5. Heritage by category restaurantes_gastronomia with limit=3 - Each item MUST have non-empty image_url
        self.test_endpoint("GET", "/heritage", params={"category": "restaurantes_gastronomia", "limit": 3}, 
                          description="CRITICAL: restaurantes_gastronomia items MUST have non-empty image_url")
        
        # 6. Heritage by category surf with limit=3 - Each item MUST have non-empty image_url
        self.test_endpoint("GET", "/heritage", params={"category": "surf", "limit": 3}, 
                          description="CRITICAL: surf items MUST have non-empty image_url")
        
        # 7. Heritage by category percursos_pedestres with limit=3 - Each item MUST have non-empty image_url
        self.test_endpoint("GET", "/heritage", params={"category": "percursos_pedestres", "limit": 3}, 
                          description="CRITICAL: percursos_pedestres items MUST have non-empty image_url")
        
        # 8. Map items with categories=castelos - Should return items with image_url
        self.test_endpoint("GET", "/map/items", params={"categories": "castelos"}, 
                          description="Map items for castelos should have image_url")
        
        return self.results
    
    def print_summary(self):
        """Print test summary with validation for 5678 POIs import"""
        print("\n" + "=" * 80)
        print("📋 TEST SUMMARY - PORTUGAL VIVO API")
        print("=" * 80)
        
        total_tests = len(self.results)
        successful_tests = sum(1 for r in self.results if r.get("success", False))
        failed_tests = total_tests - successful_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Successful: {successful_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(successful_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print(f"\n🚨 FAILED TESTS:")
            for result in self.results:
                if not result.get("success", False):
                    print(f"   • {result['method']} {result['endpoint']} - {result.get('error', 'Unknown error')}")
        
        # Validate expected data for IMAGE ASSIGNMENT VERIFICATION
        print(f"\n📊 CRITICAL IMAGE ASSIGNMENT VALIDATION:")
        
        for result in self.results:
            if result.get("success") and result.get("response_data"):
                endpoint = result["endpoint"]
                data = result["response_data"]
                params = result.get("params", {})
                
                if endpoint == "/health":
                    status = data.get("status", "")
                    status_check = "✅" if status.lower() == "ok" else "❌"
                    print(f"   {status_check} Health Status: Expected 'ok', Got '{status}'")
                    
                elif endpoint == "/stats" and isinstance(data, dict):
                    items = data.get("total_items", 0)
                    items_status = "✅" if items >= 5678 else "❌"
                    print(f"   {items_status} Heritage Items: Expected >=5678, Got {items}")
                    
                elif endpoint == "/categories" and isinstance(data, list):
                    # Check for expected categories with proper IDs
                    category_names = [cat.get("id", cat.get("name", "")) if isinstance(cat, dict) else str(cat) for cat in data]
                    expected_categories = ["percursos_pedestres", "castelos", "restaurantes_gastronomia", "surf"]
                    found_categories = [cat for cat in expected_categories if any(cat in name.lower() for name in category_names)]
                    
                    categories_status = "✅" if len(found_categories) >= 3 else "❌"
                    print(f"   {categories_status} Categories: Found {len(data)} categories, including {len(found_categories)}/4 expected ones")
                    
                elif endpoint == "/heritage" and isinstance(data, list):
                    category = params.get("category")
                    
                    if category in ["castelos", "restaurantes_gastronomia", "surf", "percursos_pedestres"]:
                        # CRITICAL: Validate image_url for each item
                        items_with_image = 0
                        items_with_unsplash = 0
                        items_with_location = 0
                        items_with_category = 0
                        items_with_region = 0
                        
                        for item in data:
                            if isinstance(item, dict):
                                # Check image_url
                                image_url = item.get("image_url", "")
                                if image_url and image_url.strip():
                                    items_with_image += 1
                                    if "unsplash.com" in image_url.lower():
                                        items_with_unsplash += 1
                                
                                # Check location
                                location = item.get("location", {})
                                if isinstance(location, dict):
                                    lat = location.get("lat") or location.get("latitude")
                                    lng = location.get("lng") or location.get("longitude")
                                    if lat and lng:
                                        try:
                                            lat, lng = float(lat), float(lng)
                                            if 32 <= lat <= 42 and -31 <= lng <= -6:
                                                items_with_location += 1
                                        except (ValueError, TypeError):
                                            pass
                                
                                # Check category and region
                                if item.get("category"):
                                    items_with_category += 1
                                if item.get("region"):
                                    items_with_region += 1
                        
                        total_items = len(data)
                        image_status = "✅" if items_with_image == total_items else "❌"
                        unsplash_status = "✅" if items_with_unsplash == total_items else "❌"
                        location_status = "✅" if items_with_location >= total_items * 0.8 else "⚠️"
                        category_status = "✅" if items_with_category == total_items else "❌"
                        region_status = "✅" if items_with_region == total_items else "❌"
                        
                        print(f"   🔍 CATEGORY '{category}' VALIDATION:")
                        print(f"     {image_status} Image URLs: {items_with_image}/{total_items} items have non-empty image_url")
                        print(f"     {unsplash_status} Unsplash URLs: {items_with_unsplash}/{total_items} items have unsplash.com URLs")
                        print(f"     {location_status} GPS Coordinates: {items_with_location}/{total_items} items have valid Portugal coordinates")
                        print(f"     {category_status} Category Field: {items_with_category}/{total_items} items have category")
                        print(f"     {region_status} Region Field: {items_with_region}/{total_items} items have region")
                        
                        # Show sample image URLs for verification
                        if data and isinstance(data[0], dict):
                            sample_image = data[0].get("image_url", "")
                            if sample_image:
                                print(f"     📸 Sample Image URL: {sample_image[:80]}...")
                    
                elif endpoint == "/map/items" and isinstance(data, list):
                    category = params.get("categories")
                    if category == "castelos":
                        items_with_image = sum(1 for item in data if isinstance(item, dict) and item.get("image_url", "").strip())
                        total_items = len(data)
                        map_image_status = "✅" if items_with_image >= total_items * 0.8 else "❌"
                        print(f"   {map_image_status} Map Items (castelos): {items_with_image}/{total_items} items have image_url")

def main():
    """Main test execution"""
    tester = APITester(BACKEND_URL)
    
    try:
        results = tester.run_all_tests()
        tester.print_summary()
        
        # Save detailed results to file
        with open('/app/test_results_detailed.json', 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        print(f"\n💾 Detailed results saved to: /app/test_results_detailed.json")
        
        return results
        
    except Exception as e:
        print(f"\n🚨 CRITICAL ERROR during testing: {e}")
        import traceback
        traceback.print_exc()
        return []

if __name__ == "__main__":
    main()