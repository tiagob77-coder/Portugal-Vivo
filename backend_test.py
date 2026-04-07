#!/usr/bin/env python3
"""
Backend API Testing for Portugal Vivo
Tests the main endpoints as requested in the review.
"""

import requests
import json
import time
from typing import Dict, Any

# Get backend URL from frontend .env
BACKEND_URL = "https://portugal-vivo-3.preview.emergentagent.com/api"

def test_endpoint(method: str, endpoint: str, data: Dict[Any, Any] = None, expected_status: int = 200) -> Dict[str, Any]:
    """Test a single endpoint and return results"""
    url = f"{BACKEND_URL}{endpoint}"
    start_time = time.time()
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, timeout=10)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, timeout=10)
        else:
            return {"error": f"Unsupported method: {method}"}
        
        response_time = time.time() - start_time
        
        result = {
            "endpoint": endpoint,
            "method": method,
            "status_code": response.status_code,
            "response_time": round(response_time, 3),
            "success": response.status_code == expected_status,
            "url": url
        }
        
        if response.status_code == expected_status:
            try:
                result["data"] = response.json()
            except json.JSONDecodeError:
                result["data"] = response.text
        else:
            result["error"] = f"Expected {expected_status}, got {response.status_code}"
            try:
                result["error_details"] = response.json()
            except:
                result["error_details"] = response.text
                
        return result
        
    except requests.exceptions.Timeout:
        return {
            "endpoint": endpoint,
            "method": method,
            "error": "Request timeout (>10s)",
            "success": False,
            "response_time": ">10.0"
        }
    except requests.exceptions.RequestException as e:
        return {
            "endpoint": endpoint,
            "method": method,
            "error": f"Request failed: {str(e)}",
            "success": False,
            "response_time": "N/A"
        }

def validate_coordinates(lat: float, lng: float) -> bool:
    """Validate GPS coordinates for Portugal"""
    # Portugal coordinates: lat between 32-42, lng between -31 to -6
    return 32 <= lat <= 42 and -31 <= lng <= -6

def main():
    """Run all tests for Portugal Vivo endpoints"""
    print("🇵🇹 PORTUGAL VIVO - Backend API Testing")
    print("=" * 60)
    print(f"Backend URL: {BACKEND_URL}")
    print()
    
    tests = []
    
    # 1. Health Check - GET /api/health
    print("1️⃣  Testing Health Check...")
    health_result = test_endpoint("GET", "/health")
    tests.append(health_result)
    
    if health_result["success"]:
        data = health_result["data"]
        if isinstance(data, dict) and data.get("status") == "ok":
            print("   ✅ Health check returns status 'ok'")
        else:
            print(f"   ❌ Health check returned unexpected data: {data}")
            health_result["validation_error"] = "Status should be 'ok'"
    else:
        print(f"   ❌ Health check failed: {health_result.get('error', 'Unknown error')}")
    
    print()
    
    # 2. Encyclopedia Universes - GET /api/encyclopedia/universes
    print("2️⃣  Testing Encyclopedia Universes...")
    universes_result = test_endpoint("GET", "/encyclopedia/universes")
    tests.append(universes_result)
    
    if universes_result["success"]:
        data = universes_result["data"]
        if isinstance(data, list) and len(data) == 6:
            print(f"   ✅ Returns exactly 6 universes as expected")
            # Check if historia_patrimonio universe exists
            historia_found = any(u.get("id") == "historia_patrimonio" for u in data)
            if historia_found:
                print("   ✅ 'historia_patrimonio' universe found")
            else:
                print("   ❌ 'historia_patrimonio' universe not found")
                universes_result["validation_error"] = "historia_patrimonio universe missing"
        else:
            print(f"   ❌ Expected 6 universes, got {len(data) if isinstance(data, list) else 'non-list'}")
            universes_result["validation_error"] = f"Expected 6 universes, got {len(data) if isinstance(data, list) else type(data)}"
    else:
        print(f"   ❌ Encyclopedia universes failed: {universes_result.get('error', 'Unknown error')}")
    
    print()
    
    # 3. Encyclopedia Items for historia_patrimonio - GET /api/encyclopedia/universe/historia_patrimonio/items
    print("3️⃣  Testing Encyclopedia Items for historia_patrimonio...")
    items_result = test_endpoint("GET", "/encyclopedia/universe/historia_patrimonio/items")
    tests.append(items_result)
    
    if items_result["success"]:
        data = items_result["data"]
        if isinstance(data, dict) and "items" in data and "total" in data:
            items_count = len(data["items"])
            total_count = data["total"]
            print(f"   ✅ Returns proper structure with {items_count} items, total: {total_count}")
            
            # Validate some items have required fields
            if items_count > 0:
                sample_item = data["items"][0]
                required_fields = ["id", "name", "category", "region"]
                missing_fields = [field for field in required_fields if field not in sample_item]
                if not missing_fields:
                    print("   ✅ Items have required fields (id, name, category, region)")
                else:
                    print(f"   ❌ Items missing required fields: {missing_fields}")
                    items_result["validation_error"] = f"Missing fields: {missing_fields}"
                
                # Check coordinates if location exists
                if "location" in sample_item and sample_item["location"]:
                    location = sample_item["location"]
                    if "coordinates" in location and len(location["coordinates"]) == 2:
                        lng, lat = location["coordinates"]
                        if validate_coordinates(lat, lng):
                            print(f"   ✅ GPS coordinates valid for Portugal: {lat}, {lng}")
                        else:
                            print(f"   ❌ Invalid GPS coordinates: {lat}, {lng}")
                            items_result["validation_error"] = f"Invalid coordinates: {lat}, {lng}"
            else:
                print("   ⚠️  No items returned to validate")
        else:
            print(f"   ❌ Expected structure {{ items: [], total: N }}, got: {type(data)}")
            items_result["validation_error"] = f"Wrong structure, expected dict with 'items' and 'total'"
    else:
        print(f"   ❌ Encyclopedia items failed: {items_result.get('error', 'Unknown error')}")
    
    print()
    
    # 4. Map Items - GET /api/map/items
    print("4️⃣  Testing Map Items...")
    map_result = test_endpoint("GET", "/map/items")
    tests.append(map_result)
    
    if map_result["success"]:
        data = map_result["data"]
        if isinstance(data, list):
            items_count = len(data)
            print(f"   ✅ Returns {items_count} POIs for map display")
            
            # Validate coordinates in first few items
            valid_coords = 0
            invalid_coords = 0
            for i, item in enumerate(data[:5]):  # Check first 5 items
                if "location" in item and item["location"]:
                    location = item["location"]
                    if "coordinates" in location and len(location["coordinates"]) == 2:
                        lng, lat = location["coordinates"]
                        if validate_coordinates(lat, lng):
                            valid_coords += 1
                        else:
                            invalid_coords += 1
                            print(f"   ❌ Invalid coordinates in item {i}: {lat}, {lng}")
            
            if valid_coords > 0 and invalid_coords == 0:
                print(f"   ✅ All checked coordinates valid for Portugal ({valid_coords} items)")
            elif invalid_coords > 0:
                map_result["validation_error"] = f"Found {invalid_coords} items with invalid coordinates"
        else:
            print(f"   ❌ Expected list of POIs, got: {type(data)}")
            map_result["validation_error"] = f"Expected list, got {type(data)}"
    else:
        print(f"   ❌ Map items failed: {map_result.get('error', 'Unknown error')}")
    
    print()
    
    # Summary
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    total_tests = len(tests)
    successful_tests = sum(1 for test in tests if test["success"])
    failed_tests = total_tests - successful_tests
    
    print(f"Total Tests: {total_tests}")
    print(f"✅ Successful: {successful_tests}")
    print(f"❌ Failed: {failed_tests}")
    print()
    
    # Response time analysis
    response_times = [test["response_time"] for test in tests if isinstance(test.get("response_time"), (int, float))]
    if response_times:
        avg_response_time = sum(response_times) / len(response_times)
        max_response_time = max(response_times)
        print(f"⏱️  Average Response Time: {avg_response_time:.3f}s")
        print(f"⏱️  Max Response Time: {max_response_time:.3f}s")
        
        if max_response_time < 5.0:
            print("✅ All responses under 5s requirement")
        else:
            print("❌ Some responses exceeded 5s requirement")
    
    print()
    
    # Detailed results
    print("📋 DETAILED RESULTS")
    print("=" * 60)
    for i, test in enumerate(tests, 1):
        status = "✅ PASS" if test["success"] else "❌ FAIL"
        print(f"{i}. {test['method']} {test['endpoint']} - {status}")
        print(f"   Status: {test.get('status_code', 'N/A')}")
        print(f"   Time: {test.get('response_time', 'N/A')}s")
        
        if not test["success"]:
            print(f"   Error: {test.get('error', 'Unknown')}")
        
        if "validation_error" in test:
            print(f"   Validation: ❌ {test['validation_error']}")
        
        print()
    
    # Return overall success
    return failed_tests == 0

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)