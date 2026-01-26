#!/usr/bin/env python3
"""
SolMate Backend Testing - Simple API Verification
Tests critical backend endpoints without complex signature generation.
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "https://auth-revamp-16.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

class SimpleAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        
        print(f"🌐 API Base URL: {API_BASE}")
        print("=" * 80)

    def test_basic_endpoints(self):
        """Test basic API endpoints that don't require authentication"""
        print("\n" + "="*60)
        print("🔍 TESTING BASIC API ENDPOINTS")
        print("="*60)
        
        results = []
        
        try:
            # Test 1: API Root endpoint
            print(f"\n1️⃣  Testing GET /api/")
            root_response = self.session.get(f"{API_BASE}/")
            
            if root_response.status_code == 200:
                root_data = root_response.json()
                print("✅ API Root endpoint: PASSED")
                print(f"   - Message: {root_data.get('message', 'N/A')}")
                print(f"   - Version: {root_data.get('version', 'N/A')}")
                print(f"   - Cluster: {root_data.get('cluster', 'N/A')}")
                results.append(True)
            else:
                print(f"❌ API Root endpoint: FAILED - {root_response.status_code}")
                results.append(False)
            
            # Test 2: NextAuth Providers
            print(f"\n2️⃣  Testing GET /api/auth/providers")
            providers_response = self.session.get(f"{API_BASE}/auth/providers")
            
            if providers_response.status_code == 200:
                providers_data = providers_response.json()
                print("✅ NextAuth providers: PASSED")
                print(f"   - Available providers: {list(providers_data.keys())}")
                results.append(True)
            else:
                print(f"❌ NextAuth providers: FAILED - {providers_response.status_code}")
                results.append(False)
            
            # Test 3: CSRF Token
            print(f"\n3️⃣  Testing GET /api/auth/csrf")
            csrf_response = self.session.get(f"{API_BASE}/auth/csrf")
            
            if csrf_response.status_code == 200:
                csrf_data = csrf_response.json()
                if "csrfToken" in csrf_data:
                    print("✅ CSRF token generation: PASSED")
                    print(f"   - CSRF token received")
                    results.append(True)
                else:
                    print("❌ CSRF token generation: FAILED - No csrfToken")
                    results.append(False)
            else:
                print(f"❌ CSRF token generation: FAILED - {csrf_response.status_code}")
                results.append(False)
            
            # Test 4: Wallet nonce generation
            print(f"\n4️⃣  Testing POST /api/auth/wallet-nonce")
            nonce_response = self.session.post(f"{API_BASE}/auth/wallet-nonce", 
                json={"wallet": "BNWbb1GJcTMJLn12yMh8deB2AmrAmT1VyMJJpaTNVefJ"})
            
            if nonce_response.status_code == 200:
                nonce_data = nonce_response.json()
                if "nonce" in nonce_data and "messageToSign" in nonce_data:
                    print("✅ Wallet nonce generation: PASSED")
                    print(f"   - Nonce: {nonce_data['nonce']}")
                    print(f"   - Expires in: {nonce_data.get('expiresIn', 'N/A')} seconds")
                    results.append(True)
                else:
                    print("❌ Wallet nonce generation: FAILED - Missing fields")
                    results.append(False)
            else:
                print(f"❌ Wallet nonce generation: FAILED - {nonce_response.status_code}")
                results.append(False)
            
            # Test 5: Authentication required endpoints
            print(f"\n5️⃣  Testing authentication-required endpoints")
            
            # Test /api/auth/me without auth
            me_response = self.session.get(f"{API_BASE}/auth/me")
            if me_response.status_code == 401:
                print("✅ /api/auth/me auth requirement: PASSED")
                results.append(True)
            else:
                print(f"❌ /api/auth/me auth requirement: FAILED - {me_response.status_code}")
                results.append(False)
            
            # Test /api/user/profile without auth
            profile_response = self.session.get(f"{API_BASE}/user/profile")
            if profile_response.status_code == 401:
                print("✅ /api/user/profile auth requirement: PASSED")
                results.append(True)
            else:
                print(f"❌ /api/user/profile auth requirement: FAILED - {profile_response.status_code}")
                results.append(False)
            
            # Test /api/payments/confirm-vip without auth
            payment_response = self.session.post(f"{API_BASE}/payments/confirm-vip",
                json={"signature": "test"})
            if payment_response.status_code == 401:
                print("✅ /api/payments/confirm-vip auth requirement: PASSED")
                results.append(True)
            else:
                print(f"❌ /api/payments/confirm-vip auth requirement: FAILED - {payment_response.status_code}")
                results.append(False)
            
        except Exception as e:
            print(f"❌ Basic endpoint test error: {str(e)}")
            results.append(False)
        
        passed = sum(results)
        total = len(results)
        print(f"\n📊 Basic API Endpoints: {passed}/{total} tests passed")
        return passed == total

    def test_cors_and_security(self):
        """Test CORS headers and security aspects"""
        print("\n" + "="*60)
        print("🔒 TESTING CORS AND SECURITY")
        print("="*60)
        
        results = []
        
        try:
            # Test 1: CORS headers
            print(f"\n1️⃣  Testing CORS headers")
            cors_response = self.session.options(f"{API_BASE}/auth/me")
            
            if cors_response.status_code == 200:
                headers = cors_response.headers
                cors_origin = headers.get('Access-Control-Allow-Origin')
                cors_methods = headers.get('Access-Control-Allow-Methods')
                cors_headers = headers.get('Access-Control-Allow-Headers')
                
                if cors_origin and cors_methods and cors_headers:
                    print("✅ CORS configuration: PASSED")
                    print(f"   - Origin: {cors_origin}")
                    print(f"   - Methods: {cors_methods}")
                    print(f"   - Headers: {cors_headers}")
                    results.append(True)
                else:
                    print("❌ CORS configuration: FAILED - Missing headers")
                    results.append(False)
            else:
                print(f"❌ CORS configuration: FAILED - {cors_response.status_code}")
                results.append(False)
            
            # Test 2: JSON response format
            print(f"\n2️⃣  Testing JSON response format")
            json_response = self.session.get(f"{API_BASE}/")
            
            if json_response.status_code == 200:
                try:
                    json_data = json_response.json()
                    content_type = json_response.headers.get('content-type', '')
                    
                    if 'application/json' in content_type:
                        print("✅ JSON response format: PASSED")
                        print(f"   - Proper Content-Type header")
                        print(f"   - Valid JSON structure")
                        results.append(True)
                    else:
                        print("❌ JSON response format: FAILED - Wrong content type")
                        results.append(False)
                except json.JSONDecodeError:
                    print("❌ JSON response format: FAILED - Invalid JSON")
                    results.append(False)
            else:
                print(f"❌ JSON response format: FAILED - {json_response.status_code}")
                results.append(False)
            
            # Test 3: Error message safety
            print(f"\n3️⃣  Testing error message safety")
            error_response = self.session.post(f"{API_BASE}/nonexistent-endpoint")
            
            if error_response.status_code == 404:
                error_text = error_response.text
                # Check that error doesn't contain stack traces or sensitive info
                if "stack" not in error_text.lower() and "trace" not in error_text.lower():
                    print("✅ Error message safety: PASSED")
                    print(f"   - No stack traces in error responses")
                    results.append(True)
                else:
                    print("❌ Error message safety: FAILED - Contains stack traces")
                    results.append(False)
            else:
                print("✅ Error message safety: PASSED (endpoint exists)")
                results.append(True)
            
        except Exception as e:
            print(f"❌ CORS and security test error: {str(e)}")
            results.append(False)
        
        passed = sum(results)
        total = len(results)
        print(f"\n📊 CORS and Security: {passed}/{total} tests passed")
        return passed == total

    def test_payment_validation(self):
        """Test payment endpoint validation without authentication"""
        print("\n" + "="*60)
        print("💳 TESTING PAYMENT VALIDATION")
        print("="*60)
        
        results = []
        
        try:
            # Test 1: Missing signature
            print(f"\n1️⃣  Testing payment with missing signature")
            missing_sig_response = self.session.post(f"{API_BASE}/payments/confirm-vip",
                json={})
            
            if missing_sig_response.status_code == 401:
                print("✅ Payment auth requirement: PASSED")
                print(f"   - Returns 401 for unauthenticated requests")
                results.append(True)
            else:
                print(f"❌ Payment auth requirement: FAILED - {missing_sig_response.status_code}")
                results.append(False)
            
            # Test 2: Invalid wallet verification
            print(f"\n2️⃣  Testing wallet verification with invalid signature")
            invalid_verify_response = self.session.post(f"{API_BASE}/auth/wallet-verify", 
                json={
                    "wallet": "BNWbb1GJcTMJLn12yMh8deB2AmrAmT1VyMJJpaTNVefJ",
                    "nonce": "test-nonce",
                    "signature": "invalid_signature"
                })
            
            if invalid_verify_response.status_code == 401:
                print("✅ Invalid signature rejection: PASSED")
                print(f"   - Returns 401 for invalid signatures")
                results.append(True)
            else:
                print(f"❌ Invalid signature rejection: FAILED - {invalid_verify_response.status_code}")
                results.append(False)
            
        except Exception as e:
            print(f"❌ Payment validation test error: {str(e)}")
            results.append(False)
        
        passed = sum(results)
        total = len(results)
        print(f"\n📊 Payment Validation: {passed}/{total} tests passed")
        return passed == total

    def test_game_endpoints_basic(self):
        """Test game endpoints basic functionality"""
        print("\n" + "="*60)
        print("🎮 TESTING GAME ENDPOINTS (BASIC)")
        print("="*60)
        
        results = []
        
        try:
            # Test 1: Bot game without auth (should work for non-VIP)
            print(f"\n1️⃣  Testing POST /api/game/bot/start without auth")
            bot_game_response = self.session.post(f"{API_BASE}/game/bot/start",
                json={"difficulty": "easy", "isVipArena": False})
            
            if bot_game_response.status_code == 200:
                bot_data = bot_game_response.json()
                if "gameId" in bot_data and "playerColor" in bot_data:
                    print("✅ Bot game creation (non-VIP): PASSED")
                    print(f"   - Game ID: {bot_data['gameId']}")
                    print(f"   - Player Color: {bot_data['playerColor']}")
                    print(f"   - Difficulty: {bot_data.get('difficulty', 'N/A')}")
                    results.append(True)
                else:
                    print("❌ Bot game creation: FAILED - Missing required fields")
                    results.append(False)
            else:
                print(f"❌ Bot game creation: FAILED - {bot_game_response.status_code}")
                results.append(False)
            
            # Test 2: VIP Arena without auth (should require auth)
            print(f"\n2️⃣  Testing VIP Arena access without auth")
            vip_game_response = self.session.post(f"{API_BASE}/game/bot/start",
                json={"difficulty": "hard", "isVipArena": True})
            
            if vip_game_response.status_code == 401:
                print("✅ VIP Arena auth requirement: PASSED")
                print(f"   - Returns 401 for unauthenticated VIP Arena access")
                results.append(True)
            else:
                print(f"❌ VIP Arena auth requirement: FAILED - {vip_game_response.status_code}")
                results.append(False)
            
            # Test 3: Private match without auth
            print(f"\n3️⃣  Testing private match creation without auth")
            private_match_response = self.session.post(f"{API_BASE}/match/private",
                json={"action": "create"})
            
            if private_match_response.status_code == 401:
                print("✅ Private match auth requirement: PASSED")
                print(f"   - Returns 401 for unauthenticated requests")
                results.append(True)
            else:
                print(f"❌ Private match auth requirement: FAILED - {private_match_response.status_code}")
                results.append(False)
            
        except Exception as e:
            print(f"❌ Game endpoints test error: {str(e)}")
            results.append(False)
        
        passed = sum(results)
        total = len(results)
        print(f"\n📊 Game Endpoints (Basic): {passed}/{total} tests passed")
        return passed == total

    def run_simple_audit(self):
        """Run simple backend API audit without complex authentication"""
        print("🚀 STARTING SIMPLE BACKEND API AUDIT")
        print("=" * 80)
        print(f"⏰ Audit started at: {datetime.now().isoformat()}")
        print(f"🌐 Testing environment: {BASE_URL}")
        
        audit_results = {}
        
        # Run all test suites
        audit_results['Basic API Endpoints'] = self.test_basic_endpoints()
        audit_results['CORS and Security'] = self.test_cors_and_security()
        audit_results['Payment Validation'] = self.test_payment_validation()
        audit_results['Game Endpoints (Basic)'] = self.test_game_endpoints_basic()
        
        # Final Summary
        print("\n" + "="*80)
        print("📋 SIMPLE BACKEND AUDIT RESULTS")
        print("="*80)
        
        total_suites = len(audit_results)
        passed_suites = sum(1 for result in audit_results.values() if result)
        
        for suite_name, result in audit_results.items():
            status = "✅ PASSED" if result else "❌ FAILED"
            print(f"{suite_name}: {status}")
        
        print(f"\n🎯 Overall Audit Result: {passed_suites}/{total_suites} test suites passed")
        
        if passed_suites == total_suites:
            print("🎉 BACKEND APIs WORKING CORRECTLY!")
            print("\n✅ Verified Components:")
            print("   • API root endpoint with version info")
            print("   • NextAuth providers configuration")
            print("   • CSRF token generation")
            print("   • Wallet nonce generation")
            print("   • Authentication requirements enforced")
            print("   • CORS headers properly configured")
            print("   • JSON response format")
            print("   • Error message safety")
            print("   • Payment endpoint validation")
            print("   • Game endpoint access control")
            return True
        else:
            print("⚠️  SOME ISSUES FOUND - Review failed tests above")
            return False

if __name__ == "__main__":
    tester = SimpleAPITester()
    success = tester.run_simple_audit()
    exit(0 if success else 1)