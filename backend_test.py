#!/usr/bin/env python3
"""
Backend API Testing for Portuguese Cultural Heritage API (Património Vivo de Portugal)
Tests all the main API endpoints to verify functionality.
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
    
    # Fallback to localhost
    return "http://localhost:8001/api"

BACKEND_URL = get_backend_url()
print(f"Testing backend at: {BACKEND_URL}")

class APITester:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.results = []
        
    def test_endpoint(self, method: str, endpoint: str, expected_status: int = 200, 
                     params: Optional[Dict] = None, description: str = "") -> Dict[str, Any]:
        """Test a single API endpoint"""
        url = f"{self.base_url}{endpoint}"
        
        try:
            print(f"\n🔍 Testing {method} {endpoint}")
            if params:
                print(f"   Parameters: {params}")
            
            response = self.session.request(method, url, params=params, timeout=30)
            
            result = {
                "endpoint": endpoint,
                "method": method,
                "url": url,
                "status_code": response.status_code,
                "expected_status": expected_status,
                "success": response.status_code == expected_status,
                "description": description,
                "timestamp": datetime.now().isoformat(),
                "params": params
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
                "params": params
            }
            print(f"   ❌ REQUEST FAILED - {str(e)}")
            
        self.results.append(result)
        return result
    
    def run_all_tests(self):
        """Run all API tests as specified in the review request"""
        print("=" * 80)
        print("🇵🇹 PORTUGUESE CULTURAL HERITAGE API TESTING")
        print("=" * 80)
        
        # 1. Health check
        self.test_endpoint("GET", "/health", description="Health check endpoint")
        
        # 2. Statistics
        stats_result = self.test_endpoint("GET", "/stats", description="Get API statistics")
        
        # 3. Categories (should return 20)
        categories_result = self.test_endpoint("GET", "/categories", description="Get all heritage categories")
        
        # 4. Regions (should return 7)
        regions_result = self.test_endpoint("GET", "/regions", description="Get all regions")
        
        # 5. Heritage items
        heritage_result = self.test_endpoint("GET", "/heritage", description="Get heritage items")
        
        # 6. Heritage by category (lendas)
        self.test_endpoint("GET", "/heritage", params={"category": "lendas"}, 
                          description="Filter heritage by category 'lendas'")
        
        # 7. Heritage by region (norte)
        self.test_endpoint("GET", "/heritage", params={"region": "norte"}, 
                          description="Filter heritage by region 'norte'")
        
        # 8. Single heritage item (get ID from heritage list if available)
        heritage_id = None
        if heritage_result.get("success") and heritage_result.get("response_data"):
            items = heritage_result["response_data"]
            if items and len(items) > 0:
                heritage_id = items[0].get("id")
                if heritage_id:
                    self.test_endpoint("GET", f"/heritage/{heritage_id}", 
                                     description=f"Get single heritage item with ID: {heritage_id}")
                else:
                    print("   ⚠️  No heritage item ID found in response")
            else:
                print("   ⚠️  No heritage items returned to test single item endpoint")
        
        # 9. Routes (should return 20)
        self.test_endpoint("GET", "/routes", description="Get thematic routes")
        
        # 10. Map items
        self.test_endpoint("GET", "/map/items", description="Get heritage items with locations for map")
        
        return self.results
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 80)
        print("📋 TEST SUMMARY")
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
        
        # Validate expected data counts
        print(f"\n📊 DATA VALIDATION:")
        for result in self.results:
            if result.get("success") and result.get("response_data"):
                endpoint = result["endpoint"]
                data = result["response_data"]
                
                if endpoint == "/categories" and isinstance(data, list):
                    expected = 20
                    actual = len(data)
                    status = "✅" if actual == expected else "⚠️"
                    print(f"   {status} Categories: Expected {expected}, Got {actual}")
                    
                elif endpoint == "/regions" and isinstance(data, list):
                    expected = 7
                    actual = len(data)
                    status = "✅" if actual == expected else "⚠️"
                    print(f"   {status} Regions: Expected {expected}, Got {actual}")
                    
                elif endpoint == "/stats" and isinstance(data, dict):
                    items = data.get("total_items", 0)
                    routes = data.get("total_routes", 0)
                    expected_items = 254
                    expected_routes = 20
                    
                    items_status = "✅" if items == expected_items else "⚠️"
                    routes_status = "✅" if routes == expected_routes else "⚠️"
                    
                    print(f"   {items_status} Heritage Items: Expected {expected_items}, Got {items}")
                    print(f"   {routes_status} Routes: Expected {expected_routes}, Got {routes}")

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