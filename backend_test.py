#!/usr/bin/env python3
"""
Backend API Testing for Portugal Vivo Specialized Modules
Tests all specialized module endpoints as requested in the review.
"""

import asyncio
import aiohttp
import json
import sys
from typing import Dict, Any, List
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://project-analyzer-131.preview.emergentagent.com/api"

class PortugalVivoTester:
    def __init__(self):
        self.session = None
        self.results = []
        self.total_tests = 0
        self.passed_tests = 0
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            headers={"User-Agent": "PortugalVivo-Tester/1.0"}
        )
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_test(self, endpoint: str, expected_count: Any, actual_result: Any, passed: bool, details: str = ""):
        """Log test result"""
        self.total_tests += 1
        if passed:
            self.passed_tests += 1
            
        result = {
            "endpoint": endpoint,
            "expected": expected_count,
            "actual": actual_result,
            "passed": passed,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.results.append(result)
        
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} {endpoint} - Expected: {expected_count}, Got: {actual_result}")
        if details:
            print(f"    Details: {details}")
    
    async def test_endpoint(self, method: str, endpoint: str, expected_count: Any = None, 
                          data: Dict = None, check_fields: List[str] = None) -> Dict[str, Any]:
        """Test a single endpoint"""
        url = f"{BACKEND_URL}{endpoint}"
        
        try:
            if method.upper() == "GET":
                async with self.session.get(url) as response:
                    result = await self._process_response(response, endpoint, expected_count, check_fields)
            elif method.upper() == "POST":
                async with self.session.post(url, json=data) as response:
                    result = await self._process_response(response, endpoint, expected_count, check_fields)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return result
            
        except Exception as e:
            error_msg = f"Request failed: {str(e)}"
            self.log_test(endpoint, expected_count, "ERROR", False, error_msg)
            return {"error": error_msg}
    
    async def _process_response(self, response, endpoint: str, expected_count: Any, check_fields: List[str]) -> Dict[str, Any]:
        """Process HTTP response"""
        if response.status != 200:
            error_msg = f"HTTP {response.status}"
            try:
                error_data = await response.json()
                error_msg += f": {error_data.get('detail', 'Unknown error')}"
            except:
                error_msg += f": {await response.text()}"
            
            self.log_test(endpoint, expected_count, f"HTTP {response.status}", False, error_msg)
            return {"error": error_msg, "status": response.status}
        
        try:
            data = await response.json()
        except Exception as e:
            error_msg = f"Invalid JSON response: {str(e)}"
            self.log_test(endpoint, expected_count, "INVALID_JSON", False, error_msg)
            return {"error": error_msg}
        
        # Validate response structure and count
        return self._validate_response(data, endpoint, expected_count, check_fields)
    
    def _validate_response(self, data: Any, endpoint: str, expected_count: Any, check_fields: List[str]) -> Dict[str, Any]:
        """Validate response data"""
        details = []
        
        # Check if it's an array response
        if isinstance(data, list):
            actual_count = len(data)
            passed = True
            
            if expected_count is not None:
                if isinstance(expected_count, int):
                    passed = actual_count == expected_count
                elif isinstance(expected_count, str) and expected_count.startswith(">="):
                    min_count = int(expected_count[2:])
                    passed = actual_count >= min_count
                    
            # Check required fields in first item
            if data and check_fields:
                first_item = data[0]
                missing_fields = [field for field in check_fields if field not in first_item]
                if missing_fields:
                    details.append(f"Missing fields: {missing_fields}")
                    passed = False
                else:
                    details.append(f"All required fields present: {check_fields}")
                    
            self.log_test(endpoint, expected_count, actual_count, passed, "; ".join(details))
            return {"count": actual_count, "data": data, "passed": passed}
            
        # Check if it's an object with specific structure
        elif isinstance(data, dict):
            if "total" in data and "trails" in data:
                # Trails endpoint special case
                actual_count = data["total"]
                passed = True
                
                if expected_count and expected_count.startswith(">="):
                    min_count = int(expected_count[2:])
                    passed = actual_count >= min_count
                    
                # Check trail fields
                if data["trails"] and check_fields:
                    first_trail = data["trails"][0]
                    missing_fields = [field for field in check_fields if field not in first_trail]
                    if missing_fields:
                        details.append(f"Missing trail fields: {missing_fields}")
                        passed = False
                    else:
                        details.append(f"All trail fields present: {check_fields}")
                        
                    # Check image_url populated
                    if "image_url" in check_fields:
                        has_images = all(trail.get("image_url") for trail in data["trails"][:5])
                        if has_images:
                            details.append("Image URLs populated")
                        else:
                            details.append("Some trails missing image_url")
                            
                self.log_test(endpoint, expected_count, actual_count, passed, "; ".join(details))
                return {"count": actual_count, "data": data, "passed": passed}
                
            elif "overview" in data:
                # Dashboard endpoint
                passed = True
                details.append("Dashboard object with overview key found")
                self.log_test(endpoint, "dashboard object", "dashboard object", passed, "; ".join(details))
                return {"data": data, "passed": passed}
                
            else:
                # Generic object response
                passed = True
                details.append(f"Object response with keys: {list(data.keys())}")
                self.log_test(endpoint, "object", "object", passed, "; ".join(details))
                return {"data": data, "passed": passed}
        
        # Unexpected response format
        self.log_test(endpoint, expected_count, type(data).__name__, False, f"Unexpected response type: {type(data)}")
        return {"data": data, "passed": False}

    async def run_all_tests(self):
        """Run all specialized module tests"""
        print("🧪 Starting Portugal Vivo Specialized Modules Testing")
        print(f"🔗 Backend URL: {BACKEND_URL}")
        print("=" * 80)
        
        # Test 1: Costa API - Coastal zones
        await self.test_endpoint("GET", "/costa/", 10)
        
        # Test 2: Economy API - Markets
        await self.test_endpoint("GET", "/economy/markets", 5)
        
        # Test 3: Geo-Prehistoria API - Archaeological sites
        await self.test_endpoint("GET", "/geo-prehistoria/sites", 12)
        
        # Test 4: Marine API - Marine spots
        await self.test_endpoint("GET", "/marine/spots", 10)
        
        # Test 5: Infrastructure API - Infrastructure items
        await self.test_endpoint("GET", "/infrastructure/list", 14)
        
        # Test 6: Maritime Culture API - Maritime culture events
        await self.test_endpoint("GET", "/maritime-culture/events", 14)
        
        # Test 7: Gastronomy API - Gastronomy items
        await self.test_endpoint("GET", "/gastronomy/items", 14)
        
        # Test 8: Flora-Fauna API - Flora species
        await self.test_endpoint("GET", "/flora-fauna/flora", ">=8")
        
        # Test 9: Flora-Fauna API - Fauna species
        await self.test_endpoint("GET", "/flora-fauna/fauna", ">=8")
        
        # Test 10: Trails API - Trails with specific requirements
        trail_fields = ["id", "name", "description", "region", "difficulty", "distance_km", "image_url"]
        await self.test_endpoint("GET", "/trails?limit=5", ">=600", check_fields=trail_fields)
        
        # Test 11: Admin Dashboard API
        await self.test_endpoint("GET", "/admin/dashboard")
        
        # Test 12: AI Itinerary API
        itinerary_data = {
            "duration": "1dia",
            "theme": "natureza",
            "lat": 41.15,
            "lng": -8.61,
            "radius_km": 30.0
        }
        await self.test_endpoint("POST", "/ai/itinerary", data=itinerary_data)
        
        print("=" * 80)
        print(f"🏁 Testing Complete: {self.passed_tests}/{self.total_tests} tests passed")
        
        if self.passed_tests == self.total_tests:
            print("🎉 All tests PASSED!")
        else:
            print(f"⚠️  {self.total_tests - self.passed_tests} tests FAILED")
            
        return self.results

async def main():
    """Main test runner"""
    async with PortugalVivoTester() as tester:
        results = await tester.run_all_tests()
        
        # Print detailed results
        print("\n" + "=" * 80)
        print("📊 DETAILED TEST RESULTS")
        print("=" * 80)
        
        failed_tests = [r for r in results if not r["passed"]]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  • {test['endpoint']}: {test['details']}")
        
        passed_tests = [r for r in results if r["passed"]]
        if passed_tests:
            print(f"\n✅ PASSED TESTS ({len(passed_tests)}):")
            for test in passed_tests:
                print(f"  • {test['endpoint']}: Expected {test['expected']}, Got {test['actual']}")
        
        # Return exit code
        return 0 if len(failed_tests) == 0 else 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)