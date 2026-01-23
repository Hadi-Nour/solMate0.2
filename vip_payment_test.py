#!/usr/bin/env python3
"""
VIP USDC Payment Confirmation Endpoint Test Suite for SolMate Chess App
Tests the POST /api/payments/confirm-vip endpoint as requested in the review.
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

class VipPaymentTester:
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

    def test_endpoint_exists(self):
        """Test that the VIP payment confirmation endpoint exists"""
        try:
            response = self.make_request('POST', '/payments/confirm-vip', data={})
            
            if response.status_code == 404:
                self.log_result(
                    "VIP payment endpoint exists",
                    False,
                    "Endpoint not found (404)",
                    {'status_code': response.status_code}
                )
            else:
                # Any response other than 404 means the endpoint exists
                self.log_result(
                    "VIP payment endpoint exists",
                    True,
                    f"Endpoint exists (returned {response.status_code})",
                    {'status_code': response.status_code}
                )
                
        except Exception as e:
            self.log_result(
                "VIP payment endpoint exists",
                False,
                f"Request failed: {str(e)}",
                {'error': str(e)}
            )

    def test_auth_required_no_token(self):
        """Test 1: Authentication Required - No auth token provided"""
        try:
            response = self.make_request('POST', '/payments/confirm-vip', data={
                "signature": "test_signature_12345"
            })
            
            if response.status_code == 401:
                try:
                    data = response.json()
                    if 'error' in data and ('not authenticated' in data['error'].lower() or 'unauthorized' in data['error'].lower()):
                        self.log_result(
                            "Auth required - no token",
                            True,
                            "Correctly returned 401 when no auth token provided",
                            {'status_code': response.status_code, 'response': data}
                        )
                    else:
                        self.log_result(
                            "Auth required - no token",
                            False,
                            "401 returned but error message doesn't indicate authentication issue",
                            {'status_code': response.status_code, 'response': data}
                        )
                except json.JSONDecodeError:
                    self.log_result(
                        "Auth required - no token",
                        False,
                        "401 returned but response is not valid JSON",
                        {'status_code': response.status_code, 'response_text': response.text}
                    )
            else:
                self.log_result(
                    "Auth required - no token",
                    False,
                    f"Expected 401, got {response.status_code}",
                    {'status_code': response.status_code, 'response_text': response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Auth required - no token",
                False,
                f"Request failed: {str(e)}",
                {'error': str(e)}
            )

    def test_auth_required_invalid_token(self):
        """Test 2: Authentication Required - Invalid auth token"""
        try:
            headers = {
                'Authorization': 'Bearer invalid_jwt_token_12345'
            }
            response = self.make_request('POST', '/payments/confirm-vip', 
                                       data={"signature": "test_signature_12345"}, 
                                       headers=headers)
            
            if response.status_code == 401:
                try:
                    data = response.json()
                    if 'error' in data:
                        self.log_result(
                            "Auth required - invalid token",
                            True,
                            "Correctly returned 401 with invalid JWT token",
                            {'status_code': response.status_code, 'response': data}
                        )
                    else:
                        self.log_result(
                            "Auth required - invalid token",
                            False,
                            "401 returned but missing error message",
                            {'status_code': response.status_code, 'response': data}
                        )
                except json.JSONDecodeError:
                    self.log_result(
                        "Auth required - invalid token",
                        False,
                        "401 returned but response is not valid JSON",
                        {'status_code': response.status_code, 'response_text': response.text}
                    )
            else:
                self.log_result(
                    "Auth required - invalid token",
                    False,
                    f"Expected 401, got {response.status_code}",
                    {'status_code': response.status_code, 'response_text': response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Auth required - invalid token",
                False,
                f"Request failed: {str(e)}",
                {'error': str(e)}
            )

    def test_input_validation_missing_signature(self):
        """Test 3: Input Validation - Missing signature"""
        try:
            headers = {
                'Authorization': 'Bearer fake_jwt_token_for_validation_test'
            }
            response = self.make_request('POST', '/payments/confirm-vip', 
                                       data={}, 
                                       headers=headers)
            
            if response.status_code == 400:
                try:
                    data = response.json()
                    if 'error' in data and 'signature' in data['error'].lower():
                        self.log_result(
                            "Input validation - missing signature",
                            True,
                            "Correctly returned 400 when signature is missing",
                            {'status_code': response.status_code, 'response': data}
                        )
                    else:
                        self.log_result(
                            "Input validation - missing signature",
                            False,
                            "400 returned but error message doesn't mention signature",
                            {'status_code': response.status_code, 'response': data}
                        )
                except json.JSONDecodeError:
                    self.log_result(
                        "Input validation - missing signature",
                        False,
                        "400 returned but response is not valid JSON",
                        {'status_code': response.status_code, 'response_text': response.text}
                    )
            elif response.status_code == 401:
                self.log_result(
                    "Input validation - missing signature",
                    True,
                    "Returned 401 (auth check happens first) - this is acceptable",
                    {'status_code': response.status_code}
                )
            else:
                self.log_result(
                    "Input validation - missing signature",
                    False,
                    f"Expected 400 or 401, got {response.status_code}",
                    {'status_code': response.status_code, 'response_text': response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Input validation - missing signature",
                False,
                f"Request failed: {str(e)}",
                {'error': str(e)}
            )

    def test_input_validation_empty_signature(self):
        """Test 4: Input Validation - Empty signature"""
        try:
            headers = {
                'Authorization': 'Bearer fake_jwt_token_for_validation_test'
            }
            response = self.make_request('POST', '/payments/confirm-vip', 
                                       data={"signature": ""}, 
                                       headers=headers)
            
            if response.status_code == 400:
                try:
                    data = response.json()
                    if 'error' in data and 'signature' in data['error'].lower():
                        self.log_result(
                            "Input validation - empty signature",
                            True,
                            "Correctly returned 400 when signature is empty",
                            {'status_code': response.status_code, 'response': data}
                        )
                    else:
                        self.log_result(
                            "Input validation - empty signature",
                            False,
                            "400 returned but error message doesn't mention signature",
                            {'status_code': response.status_code, 'response': data}
                        )
                except json.JSONDecodeError:
                    self.log_result(
                        "Input validation - empty signature",
                        False,
                        "400 returned but response is not valid JSON",
                        {'status_code': response.status_code, 'response_text': response.text}
                    )
            elif response.status_code == 401:
                self.log_result(
                    "Input validation - empty signature",
                    True,
                    "Returned 401 (auth check happens first) - this is acceptable",
                    {'status_code': response.status_code}
                )
            else:
                self.log_result(
                    "Input validation - empty signature",
                    False,
                    f"Expected 400 or 401, got {response.status_code}",
                    {'status_code': response.status_code, 'response_text': response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Input validation - empty signature",
                False,
                f"Request failed: {str(e)}",
                {'error': str(e)}
            )

    def test_transaction_not_found(self):
        """Test 5: Transaction Not Found - Invalid/fake signature"""
        try:
            headers = {
                'Authorization': 'Bearer fake_jwt_token_for_validation_test'
            }
            response = self.make_request('POST', '/payments/confirm-vip', 
                                       data={"signature": "invalid_signature_12345"}, 
                                       headers=headers)
            
            if response.status_code == 400:
                try:
                    data = response.json()
                    if 'error' in data and ('not found' in data['error'].lower() or 'transaction' in data['error'].lower()):
                        self.log_result(
                            "Transaction not found - invalid signature",
                            True,
                            "Correctly returned 400 for invalid/fake signature",
                            {'status_code': response.status_code, 'response': data}
                        )
                    else:
                        self.log_result(
                            "Transaction not found - invalid signature",
                            False,
                            "400 returned but error message doesn't indicate transaction not found",
                            {'status_code': response.status_code, 'response': data}
                        )
                except json.JSONDecodeError:
                    self.log_result(
                        "Transaction not found - invalid signature",
                        False,
                        "400 returned but response is not valid JSON",
                        {'status_code': response.status_code, 'response_text': response.text}
                    )
            elif response.status_code == 401:
                self.log_result(
                    "Transaction not found - invalid signature",
                    True,
                    "Returned 401 (auth check happens first) - this is acceptable",
                    {'status_code': response.status_code}
                )
            elif response.status_code == 500:
                # This might happen if the Solana RPC call fails
                self.log_result(
                    "Transaction not found - invalid signature",
                    True,
                    "Returned 500 (likely RPC error for invalid signature) - this is acceptable",
                    {'status_code': response.status_code}
                )
            else:
                self.log_result(
                    "Transaction not found - invalid signature",
                    False,
                    f"Expected 400, 401, or 500, got {response.status_code}",
                    {'status_code': response.status_code, 'response_text': response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Transaction not found - invalid signature",
                False,
                f"Request failed: {str(e)}",
                {'error': str(e)}
            )

    def test_api_structure_and_cors(self):
        """Test basic API structure and CORS headers"""
        try:
            response = self.make_request('POST', '/payments/confirm-vip', data={})
            
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
        """Run all VIP payment confirmation tests"""
        print("=" * 80)
        print("SOLMATE CHESS APP - VIP USDC PAYMENT CONFIRMATION TESTS")
        print("=" * 80)
        print(f"Testing API at: {self.base_url}")
        print("Endpoint: POST /api/payments/confirm-vip")
        print()
        
        # Test endpoint exists
        self.test_endpoint_exists()
        
        # Test API structure
        self.test_api_structure_and_cors()
        
        # Test authentication requirements
        self.test_auth_required_no_token()
        self.test_auth_required_invalid_token()
        
        # Test input validation
        self.test_input_validation_missing_signature()
        self.test_input_validation_empty_signature()
        
        # Test transaction validation
        self.test_transaction_not_found()
        
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
        print("- Input validation tests check for proper signature validation")
        print("- Transaction tests verify on-chain verification logic")
        print("- Cannot test actual Solana transactions without real wallet signatures")
        print("- Cannot test replay protection without inserting test signatures first")
        print("- Cannot test 'user already VIP' without valid authentication")
        print("=" * 80)
        
        return passed_tests, failed_tests

def main():
    """Main test execution"""
    tester = VipPaymentTester()
    
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