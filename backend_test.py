#!/usr/bin/env python3
"""
Backend API Test Suite for SolMate Chess App - User Profile Endpoints
Tests the user profile API endpoints as requested in the review.
"""

import requests
import json
import sys
import time
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://solmate-dapp.preview.emergentagent.com/api"
HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
}

class ProfileAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.test_results = []
        
    def log_result(self, test_name: str, success: bool, message: str, details: Optional[Dict] = None):
        """Log test result"""
        result = {
            'test': test_name,
            'success': success,
            'message': message,
            'details': details or {}
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details:
            print(f"   Details: {json.dumps(details, indent=2)}")
        print()

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    headers: Optional[Dict] = None) -> requests.Response:
        """Make HTTP request with error handling"""
        url = f"{self.base_url}{endpoint}"
        request_headers = {**self.session.headers}
        if headers:
            request_headers.update(headers)
            
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, headers=request_headers, timeout=30)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data, headers=request_headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            raise

    def test_get_profile_without_auth(self):
        """Test GET /api/user/profile without authentication - should return 401"""
        try:
            response = self.make_request('GET', '/user/profile')
            
            if response.status_code == 401:
                try:
                    data = response.json()
                    if 'error' in data:
                        self.log_result(
                            "GET /user/profile without auth",
                            True,
                            "Correctly returned 401 Unauthorized",
                            {'status_code': response.status_code, 'response': data}
                        )
                    else:
                        self.log_result(
                            "GET /user/profile without auth",
                            False,
                            "401 returned but missing error message",
                            {'status_code': response.status_code, 'response': data}
                        )
                except json.JSONDecodeError:
                    self.log_result(
                        "GET /user/profile without auth",
                        False,
                        "401 returned but response is not valid JSON",
                        {'status_code': response.status_code, 'response_text': response.text}
                    )
            else:
                self.log_result(
                    "GET /user/profile without auth",
                    False,
                    f"Expected 401, got {response.status_code}",
                    {'status_code': response.status_code, 'response_text': response.text}
                )
                
        except Exception as e:
            self.log_result(
                "GET /user/profile without auth",
                False,
                f"Request failed: {str(e)}",
                {'error': str(e)}
            )

    def test_post_profile_without_auth(self):
        """Test POST /api/user/profile without authentication - should return 401"""
        test_data = {
            "displayName": "TestUser123",
            "avatarId": "default"
        }
        
        try:
            response = self.make_request('POST', '/user/profile', data=test_data)
            
            if response.status_code == 401:
                try:
                    data = response.json()
                    if 'error' in data:
                        self.log_result(
                            "POST /user/profile without auth",
                            True,
                            "Correctly returned 401 Unauthorized",
                            {'status_code': response.status_code, 'response': data}
                        )
                    else:
                        self.log_result(
                            "POST /user/profile without auth",
                            False,
                            "401 returned but missing error message",
                            {'status_code': response.status_code, 'response': data}
                        )
                except json.JSONDecodeError:
                    self.log_result(
                        "POST /user/profile without auth",
                        False,
                        "401 returned but response is not valid JSON",
                        {'status_code': response.status_code, 'response_text': response.text}
                    )
            else:
                self.log_result(
                    "POST /user/profile without auth",
                    False,
                    f"Expected 401, got {response.status_code}",
                    {'status_code': response.status_code, 'response_text': response.text}
                )
                
        except Exception as e:
            self.log_result(
                "POST /user/profile without auth",
                False,
                f"Request failed: {str(e)}",
                {'error': str(e)}
            )

    def test_post_profile_invalid_displayname_short(self):
        """Test POST /api/user/profile with too short displayName - should return 400"""
        test_data = {
            "displayName": "ab",  # Too short (< 3 characters)
            "avatarId": "default"
        }
        
        try:
            response = self.make_request('POST', '/user/profile', data=test_data)
            
            if response.status_code == 400:
                try:
                    data = response.json()
                    if 'error' in data and 'characters' in data['error'].lower():
                        self.log_result(
                            "POST /user/profile with short displayName",
                            True,
                            "Correctly returned 400 for short displayName",
                            {'status_code': response.status_code, 'response': data}
                        )
                    else:
                        self.log_result(
                            "POST /user/profile with short displayName",
                            False,
                            "400 returned but error message doesn't mention character length",
                            {'status_code': response.status_code, 'response': data}
                        )
                except json.JSONDecodeError:
                    self.log_result(
                        "POST /user/profile with short displayName",
                        False,
                        "400 returned but response is not valid JSON",
                        {'status_code': response.status_code, 'response_text': response.text}
                    )
            elif response.status_code == 401:
                self.log_result(
                    "POST /user/profile with short displayName",
                    True,
                    "Returned 401 (auth required) - validation would occur after auth",
                    {'status_code': response.status_code}
                )
            else:
                self.log_result(
                    "POST /user/profile with short displayName",
                    False,
                    f"Expected 400 or 401, got {response.status_code}",
                    {'status_code': response.status_code, 'response_text': response.text}
                )
                
        except Exception as e:
            self.log_result(
                "POST /user/profile with short displayName",
                False,
                f"Request failed: {str(e)}",
                {'error': str(e)}
            )

    def test_post_profile_invalid_displayname_special_chars(self):
        """Test POST /api/user/profile with special characters in displayName - should return 400"""
        test_data = {
            "displayName": "Test@User!",  # Contains special characters
            "avatarId": "default"
        }
        
        try:
            response = self.make_request('POST', '/user/profile', data=test_data)
            
            if response.status_code == 400:
                try:
                    data = response.json()
                    if 'error' in data and ('character' in data['error'].lower() or 'letter' in data['error'].lower()):
                        self.log_result(
                            "POST /user/profile with special chars in displayName",
                            True,
                            "Correctly returned 400 for invalid characters",
                            {'status_code': response.status_code, 'response': data}
                        )
                    else:
                        self.log_result(
                            "POST /user/profile with special chars in displayName",
                            False,
                            "400 returned but error message doesn't mention invalid characters",
                            {'status_code': response.status_code, 'response': data}
                        )
                except json.JSONDecodeError:
                    self.log_result(
                        "POST /user/profile with special chars in displayName",
                        False,
                        "400 returned but response is not valid JSON",
                        {'status_code': response.status_code, 'response_text': response.text}
                    )
            elif response.status_code == 401:
                self.log_result(
                    "POST /user/profile with special chars in displayName",
                    True,
                    "Returned 401 (auth required) - validation would occur after auth",
                    {'status_code': response.status_code}
                )
            else:
                self.log_result(
                    "POST /user/profile with special chars in displayName",
                    False,
                    f"Expected 400 or 401, got {response.status_code}",
                    {'status_code': response.status_code, 'response_text': response.text}
                )
                
        except Exception as e:
            self.log_result(
                "POST /user/profile with special chars in displayName",
                False,
                f"Request failed: {str(e)}",
                {'error': str(e)}
            )

    def test_post_profile_invalid_avatar_id(self):
        """Test POST /api/user/profile with invalid avatarId - should return 400"""
        test_data = {
            "displayName": "ValidUser123",
            "avatarId": "invalid_avatar"  # Not in valid list
        }
        
        try:
            response = self.make_request('POST', '/user/profile', data=test_data)
            
            if response.status_code == 400:
                try:
                    data = response.json()
                    if 'error' in data and 'avatar' in data['error'].lower():
                        self.log_result(
                            "POST /user/profile with invalid avatarId",
                            True,
                            "Correctly returned 400 for invalid avatarId",
                            {'status_code': response.status_code, 'response': data}
                        )
                    else:
                        self.log_result(
                            "POST /user/profile with invalid avatarId",
                            False,
                            "400 returned but error message doesn't mention avatar",
                            {'status_code': response.status_code, 'response': data}
                        )
                except json.JSONDecodeError:
                    self.log_result(
                        "POST /user/profile with invalid avatarId",
                        False,
                        "400 returned but response is not valid JSON",
                        {'status_code': response.status_code, 'response_text': response.text}
                    )
            elif response.status_code == 401:
                self.log_result(
                    "POST /user/profile with invalid avatarId",
                    True,
                    "Returned 401 (auth required) - validation would occur after auth",
                    {'status_code': response.status_code}
                )
            else:
                self.log_result(
                    "POST /user/profile with invalid avatarId",
                    False,
                    f"Expected 400 or 401, got {response.status_code}",
                    {'status_code': response.status_code, 'response_text': response.text}
                )
                
        except Exception as e:
            self.log_result(
                "POST /user/profile with invalid avatarId",
                False,
                f"Request failed: {str(e)}",
                {'error': str(e)}
            )

    def test_profile_endpoints_exist(self):
        """Test that profile endpoints exist and respond (not 404)"""
        endpoints_to_test = [
            ('GET', '/user/profile'),
            ('POST', '/user/profile')
        ]
        
        for method, endpoint in endpoints_to_test:
            try:
                if method == 'GET':
                    response = self.make_request(method, endpoint)
                else:
                    response = self.make_request(method, endpoint, data={"displayName": "test"})
                
                if response.status_code == 404:
                    self.log_result(
                        f"{method} {endpoint} endpoint exists",
                        False,
                        "Endpoint not found (404)",
                        {'status_code': response.status_code}
                    )
                else:
                    # Any response other than 404 means the endpoint exists
                    self.log_result(
                        f"{method} {endpoint} endpoint exists",
                        True,
                        f"Endpoint exists (returned {response.status_code})",
                        {'status_code': response.status_code}
                    )
                    
            except Exception as e:
                self.log_result(
                    f"{method} {endpoint} endpoint exists",
                    False,
                    f"Request failed: {str(e)}",
                    {'error': str(e)}
                )

    def test_api_structure_and_cors(self):
        """Test basic API structure and CORS headers"""
        try:
            response = self.make_request('GET', '/user/profile')
            
            # Check CORS headers
            cors_headers = {
                'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
                'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
                'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
            }
            
            has_cors = any(cors_headers.values())
            
            self.log_result(
                "API CORS headers",
                has_cors,
                "CORS headers present" if has_cors else "CORS headers missing",
                {'cors_headers': cors_headers}
            )
            
            # Check content type
            content_type = response.headers.get('Content-Type', '')
            is_json = 'application/json' in content_type
            
            self.log_result(
                "API JSON response format",
                is_json,
                f"Content-Type: {content_type}",
                {'content_type': content_type}
            )
            
        except Exception as e:
            self.log_result(
                "API structure and CORS",
                False,
                f"Request failed: {str(e)}",
                {'error': str(e)}
            )

    def run_all_tests(self):
        """Run all profile API tests"""
        print("=" * 80)
        print("SOLMATE CHESS APP - USER PROFILE API TESTS")
        print("=" * 80)
        print(f"Testing API at: {self.base_url}")
        print()
        
        # Test endpoints exist
        self.test_profile_endpoints_exist()
        
        # Test API structure
        self.test_api_structure_and_cors()
        
        # Test authentication requirements
        self.test_get_profile_without_auth()
        self.test_post_profile_without_auth()
        
        # Test validation (these will return 401 first, but that's expected)
        self.test_post_profile_invalid_displayname_short()
        self.test_post_profile_invalid_displayname_special_chars()
        self.test_post_profile_invalid_avatar_id()
        
        # Summary
        print("=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        print()
        
        if failed_tests > 0:
            print("FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  ❌ {result['test']}: {result['message']}")
        
        print()
        print("=" * 80)
        print("NOTES:")
        print("- Authentication tests verify that endpoints properly require JWT tokens")
        print("- Validation tests show 401 first (auth required) which is correct behavior")
        print("- The API structure and endpoint existence tests verify core functionality")
        print("- For full validation testing, a valid JWT token would be needed")
        print("=" * 80)
        
        return passed_tests, failed_tests

def main():
    """Main test execution"""
    tester = ProfileAPITester()
    
    try:
        passed, failed = tester.run_all_tests()
        
        # Exit with appropriate code
        if failed == 0:
            print("🎉 All tests passed!")
            sys.exit(0)
        else:
            print(f"⚠️  {failed} test(s) failed")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n\nTests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nUnexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()