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
        """Run all API tests as specified in the review request for 5678 POIs"""
        print("=" * 80)
        print("🇵🇹 PORTUGAL VIVO API TESTING - 5678 POIs IMPORT VERIFICATION")
        print("=" * 80)
        
        # 1. Health check - Should return {"status":"ok"}
        self.test_endpoint("GET", "/health", description="Health check endpoint")
        
        # 2. Statistics - Should return total_items > 5000, total_routes > 0, with categories array
        self.test_endpoint("GET", "/stats", description="Get API statistics - should show >5000 items")
        
        # 3. Categories - Should return array of categories like percursos_pedestres, castelos, museus, etc.
        self.test_endpoint("GET", "/categories", description="Get all heritage categories")
        
        # 4. Heritage items with limit=5 - Should return 5 heritage items with id, name, description, category, region, location fields
        self.test_endpoint("GET", "/heritage", params={"limit": 5}, 
                          description="Get 5 heritage items with required fields")
        
        # 5. Heritage by category castelos with limit=3 - Should return castelos items with proper descriptions
        self.test_endpoint("GET", "/heritage", params={"category": "castelos", "limit": 3}, 
                          description="Filter heritage by category 'castelos'")
        
        # 6. Heritage by category restaurantes_gastronomia with limit=3 - Should return restaurant items
        self.test_endpoint("GET", "/heritage", params={"category": "restaurantes_gastronomia", "limit": 3}, 
                          description="Filter heritage by category 'restaurantes_gastronomia'")
        
        # 7. Heritage by region norte with limit=3 - Should return items in Norte region
        self.test_endpoint("GET", "/heritage", params={"region": "norte", "limit": 3}, 
                          description="Filter heritage by region 'norte'")
        
        # 8. Regions - Should return array of regions
        self.test_endpoint("GET", "/regions", description="Get all regions")
        
        # 9. Heritage search for Gerês with limit=5 - Should return items mentioning Gerês
        self.test_endpoint("GET", "/heritage", params={"search": "Gerês", "limit": 5}, 
                          description="Search heritage items for 'Gerês'")
        
        # 10. POST nearby with coordinates - Should return nearby items
        nearby_data = {"latitude": 41.15, "longitude": -8.61, "radius_km": 50}
        self.test_endpoint("POST", "/nearby", json_data=nearby_data,
                          description="Find nearby POIs using coordinates")
        
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
        
        # Validate expected data for 5678 POIs import
        print(f"\n📊 DATA VALIDATION FOR 5678 POIs IMPORT:")
        
        for result in self.results:
            if result.get("success") and result.get("response_data"):
                endpoint = result["endpoint"]
                data = result["response_data"]
                
                if endpoint == "/health":
                    status = data.get("status", "")
                    expected_status = "ok" if "ok" in status.lower() else "healthy"
                    status_check = "✅" if status.lower() in ["ok", "healthy"] else "❌"
                    print(f"   {status_check} Health Status: Expected 'ok', Got '{status}'")
                    
                elif endpoint == "/stats" and isinstance(data, dict):
                    items = data.get("total_items", 0)
                    routes = data.get("total_routes", 0)
                    categories = data.get("categories", [])
                    
                    items_status = "✅" if items > 5000 else "❌"
                    routes_status = "✅" if routes > 0 else "❌"
                    categories_status = "✅" if isinstance(categories, list) and len(categories) > 0 else "❌"
                    
                    print(f"   {items_status} Heritage Items: Expected >5000, Got {items}")
                    print(f"   {routes_status} Routes: Expected >0, Got {routes}")
                    print(f"   {categories_status} Categories Array: Expected array, Got {len(categories) if isinstance(categories, list) else 'not array'}")
                    
                elif endpoint == "/categories" and isinstance(data, list):
                    # Check for expected categories
                    category_names = [cat.get("name", "") if isinstance(cat, dict) else str(cat) for cat in data]
                    expected_categories = ["percursos_pedestres", "castelos", "museus", "restaurantes_gastronomia"]
                    found_categories = [cat for cat in expected_categories if any(cat in name.lower() for name in category_names)]
                    
                    categories_status = "✅" if len(found_categories) >= 2 else "⚠️"
                    print(f"   {categories_status} Categories: Found {len(data)} categories, including {len(found_categories)} expected ones")
                    
                elif endpoint == "/regions" and isinstance(data, list):
                    # Check for Portuguese regions
                    region_names = [reg.get("name", "") if isinstance(reg, dict) else str(reg) for reg in data]
                    expected_regions = ["norte", "centro", "lisboa", "alentejo", "algarve", "acores", "madeira"]
                    found_regions = [reg for reg in expected_regions if any(reg in name.lower() for name in region_names)]
                    
                    regions_status = "✅" if len(found_regions) >= 5 else "⚠️"
                    print(f"   {regions_status} Regions: Found {len(data)} regions, including {len(found_regions)} expected Portuguese regions")
                    
                elif endpoint == "/heritage" and isinstance(data, list):
                    params = result.get("params", {})
                    limit = params.get("limit")
                    category = params.get("category")
                    region = params.get("region")
                    search = params.get("search")
                    
                    if limit == 5 and not category and not region and not search:
                        # Validate required fields for heritage items
                        required_fields = ["id", "name", "description", "category", "region", "location"]
                        items_with_all_fields = 0
                        gps_valid_items = 0
                        
                        for item in data:
                            if isinstance(item, dict):
                                has_all_fields = all(field in item for field in required_fields)
                                if has_all_fields:
                                    items_with_all_fields += 1
                                
                                # Check GPS coordinates for Portugal
                                location = item.get("location", {})
                                if isinstance(location, dict):
                                    lat = location.get("lat") or location.get("latitude")
                                    lng = location.get("lng") or location.get("longitude")
                                    if lat and lng:
                                        try:
                                            lat, lng = float(lat), float(lng)
                                            if 32 <= lat <= 42 and -31 <= lng <= -6:
                                                gps_valid_items += 1
                                        except (ValueError, TypeError):
                                            pass
                        
                        fields_status = "✅" if items_with_all_fields == len(data) else "⚠️"
                        gps_status = "✅" if gps_valid_items >= len(data) * 0.8 else "⚠️"
                        
                        print(f"   {fields_status} Heritage Fields: {items_with_all_fields}/{len(data)} items have all required fields")
                        print(f"   {gps_status} GPS Coordinates: {gps_valid_items}/{len(data)} items have valid Portugal coordinates")
                        
                    elif category:
                        category_status = "✅" if len(data) > 0 else "❌"
                        print(f"   {category_status} Category '{category}': Found {len(data)} items")
                        
                    elif region:
                        region_status = "✅" if len(data) > 0 else "❌"
                        print(f"   {region_status} Region '{region}': Found {len(data)} items")
                        
                    elif search:
                        search_status = "✅" if len(data) > 0 else "⚠️"
                        print(f"   {search_status} Search Results: Found {len(data)} items for '{search}'")
                    
                elif endpoint == "/nearby" and isinstance(data, list):
                    nearby_status = "✅" if len(data) > 0 else "⚠️"
                    print(f"   {nearby_status} Nearby POIs: Found {len(data)} items within 50km radius")

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