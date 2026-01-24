#!/usr/bin/env python3
"""
SolMate Backend API Testing Suite
Tests critical API endpoints for the SolMate chess dApp
"""

import requests
import json
import time
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://chess-connect-4.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

class SolMateAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'SolMate-Test-Client/1.0'
        })
        self.test_results = []
        self.auth_token = None
        self.test_wallet = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"  # Test wallet address
        self.test_nonce = None
        
    def log_result(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if response_data and not success:
            print(f"   Response: {json.dumps(response_data, indent=2)}")
        
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details,
            'response': response_data
        })
        print()

    def make_request(self, method: str, endpoint: str, data: Dict = None, headers: Dict = None) -> tuple:
        """Make HTTP request and return (success, response_data, status_code)"""
        url = f"{API_BASE}{endpoint}"
        
        try:
            req_headers = self.session.headers.copy()
            if headers:
                req_headers.update(headers)
                
            if self.auth_token and 'Authorization' not in req_headers:
                req_headers['Authorization'] = f'Bearer {self.auth_token}'
            
            if method.upper() == 'GET':
                response = self.session.get(url, headers=req_headers)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data, headers=req_headers)
            elif method.upper() == 'PUT':
                response = self.session.put(url, json=data, headers=req_headers)
            elif method.upper() == 'DELETE':
                response = self.session.delete(url, headers=req_headers)
            else:
                return False, {"error": f"Unsupported method: {method}"}, 0
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}
            
            return response.status_code < 400, response_data, response.status_code
            
        except Exception as e:
            return False, {"error": str(e)}, 0

    def test_wallet_auth_nonce(self):
        """Test POST /api/auth/wallet-nonce - Generate nonce for wallet signing"""
        print("🔐 Testing Wallet Authentication - Nonce Generation")
        
        # Test with valid wallet
        success, data, status = self.make_request('POST', '/auth/wallet-nonce', {
            'wallet': self.test_wallet
        })
        
        if success and 'nonce' in data and 'messageToSign' in data:
            self.test_nonce = data['nonce']
            self.log_result(
                "Wallet Nonce Generation", 
                True, 
                f"Generated nonce with {data.get('expiresIn', 0)} seconds expiry"
            )
        else:
            self.log_result(
                "Wallet Nonce Generation", 
                False, 
                f"Status: {status}", 
                data
            )
        
        # Test with missing wallet
        success, data, status = self.make_request('POST', '/auth/wallet-nonce', {})
        expected_fail = status == 400 and 'error' in data
        self.log_result(
            "Wallet Nonce - Missing Wallet Validation", 
            expected_fail, 
            "Should return 400 for missing wallet"
        )

    def test_wallet_auth_verify(self):
        """Test POST /api/auth/wallet-verify - Verify signature and return JWT token"""
        print("🔐 Testing Wallet Authentication - Signature Verification")
        
        # Test with missing fields
        success, data, status = self.make_request('POST', '/auth/wallet-verify', {})
        expected_fail = status == 400 and 'error' in data
        self.log_result(
            "Wallet Verify - Missing Fields Validation", 
            expected_fail, 
            "Should return 400 for missing required fields"
        )
        
        # Test with invalid nonce
        success, data, status = self.make_request('POST', '/auth/wallet-verify', {
            'wallet': self.test_wallet,
            'nonce': 'invalid-nonce',
            'signature': 'fake-signature'
        })
        expected_fail = status == 401 and 'error' in data
        self.log_result(
            "Wallet Verify - Invalid Nonce", 
            expected_fail, 
            "Should return 401 for invalid nonce"
        )
        
        # Test with invalid signature (but valid nonce if we have one)
        if self.test_nonce:
            success, data, status = self.make_request('POST', '/auth/wallet-verify', {
                'wallet': self.test_wallet,
                'nonce': self.test_nonce,
                'signature': 'invalid-signature'
            })
            expected_fail = status == 401 and 'error' in data
            self.log_result(
                "Wallet Verify - Invalid Signature", 
                expected_fail, 
                "Should return 401 for invalid signature"
            )

    def test_nextauth_providers(self):
        """Test GET /api/auth/providers - Should list all OAuth providers"""
        print("🔐 Testing NextAuth Providers")
        
        success, data, status = self.make_request('GET', '/auth/providers')
        
        if success and isinstance(data, dict):
            # Check for expected providers
            expected_providers = ['credentials', 'google', 'facebook', 'twitter']
            found_providers = list(data.keys()) if data else []
            
            has_all_providers = all(provider in found_providers for provider in expected_providers)
            
            self.log_result(
                "NextAuth Providers Endpoint", 
                has_all_providers, 
                f"Found providers: {found_providers}"
            )
        else:
            self.log_result(
                "NextAuth Providers Endpoint", 
                False, 
                f"Status: {status}", 
                data
            )

    def test_user_signup(self):
        """Test POST /api/auth/signup - Should create user with email/password"""
        print("👤 Testing User Signup")
        
        # Test with valid data
        test_email = f"test_{int(time.time())}@example.com"
        success, data, status = self.make_request('POST', '/auth/signup', {
            'email': test_email,
            'password': 'testpassword123',
            'displayName': 'Test User'
        })
        
        signup_success = success and data.get('success') == True
        self.log_result(
            "User Signup - Valid Data", 
            signup_success, 
            f"Created account for {test_email}" if signup_success else f"Status: {status}",
            data if not signup_success else None
        )
        
        # Test with missing email
        success, data, status = self.make_request('POST', '/auth/signup', {
            'password': 'testpassword123'
        })
        expected_fail = status == 400 and 'error' in data
        self.log_result(
            "User Signup - Missing Email Validation", 
            expected_fail, 
            "Should return 400 for missing email"
        )
        
        # Test with weak password
        success, data, status = self.make_request('POST', '/auth/signup', {
            'email': f"test2_{int(time.time())}@example.com",
            'password': '123'
        })
        expected_fail = status == 400 and 'error' in data
        self.log_result(
            "User Signup - Weak Password Validation", 
            expected_fail, 
            "Should return 400 for weak password"
        )

    def test_bot_game_start(self):
        """Test POST /api/game/bot/start - Start a bot game"""
        print("🎮 Testing Bot Game - Start Game")
        
        # Test without authentication (should work for regular games)
        success, data, status = self.make_request('POST', '/game/bot/start', {
            'difficulty': 'easy',
            'isVipArena': False
        })
        
        game_started = success and 'gameId' in data and 'playerColor' in data
        if game_started:
            self.game_id = data['gameId']
        
        self.log_result(
            "Bot Game Start - Regular Game", 
            game_started, 
            f"Started game with ID: {data.get('gameId', 'N/A')}" if game_started else f"Status: {status}"
        )
        
        # Test with invalid difficulty
        success, data, status = self.make_request('POST', '/game/bot/start', {
            'difficulty': 'invalid',
            'isVipArena': False
        })
        expected_fail = status == 400 and 'error' in data
        self.log_result(
            "Bot Game Start - Invalid Difficulty", 
            expected_fail, 
            "Should return 400 for invalid difficulty"
        )
        
        # Test VIP Arena without authentication
        success, data, status = self.make_request('POST', '/game/bot/start', {
            'difficulty': 'easy',
            'isVipArena': True
        })
        expected_fail = status == 401 and 'error' in data
        self.log_result(
            "Bot Game Start - VIP Arena Auth Required", 
            expected_fail, 
            "Should return 401 for VIP Arena without auth"
        )

    def test_bot_game_move(self):
        """Test POST /api/game/bot/move - Make a move in bot game"""
        print("🎮 Testing Bot Game - Make Move")
        
        # First start a game to get a valid game ID
        success, data, status = self.make_request('POST', '/game/bot/start', {
            'difficulty': 'easy',
            'isVipArena': False
        })
        
        if success and 'gameId' in data:
            game_id = data['gameId']
            player_color = data.get('playerColor', 'w')
            
            # Choose appropriate move based on player color
            if player_color == 'w':
                # White player moves
                from_square, to_square = 'e2', 'e4'
            else:
                # Black player moves
                from_square, to_square = 'e7', 'e5'
            
            # Test valid move
            success, data, status = self.make_request('POST', '/game/bot/move', {
                'gameId': game_id,
                'from': from_square,
                'to': to_square
            })
            
            move_success = success and data.get('success') == True
            self.log_result(
                "Bot Game Move - Valid Move", 
                move_success, 
                f"Move {from_square}-{to_square} processed successfully" if move_success else f"Status: {status}",
                data if not move_success else None
            )
            
            # Test invalid move
            success, data, status = self.make_request('POST', '/game/bot/move', {
                'gameId': game_id,
                'from': 'a1',
                'to': 'h8'  # Invalid move
            })
            expected_fail = status == 400 and 'error' in data
            self.log_result(
                "Bot Game Move - Invalid Move", 
                expected_fail, 
                "Should return 400 for invalid move"
            )
        else:
            self.log_result(
                "Bot Game Move - Setup Failed", 
                False, 
                "Could not start game for move testing"
            )
        
        # Test with missing fields
        success, data, status = self.make_request('POST', '/game/bot/move', {
            'gameId': 'fake-id'
        })
        expected_fail = status == 400 and 'error' in data
        self.log_result(
            "Bot Game Move - Missing Fields", 
            expected_fail, 
            "Should return 400 for missing move fields"
        )

    def test_private_match_create(self):
        """Test POST /api/match/private with action='create' - Create private match"""
        print("🎯 Testing Private Match - Create")
        
        # Test without authentication
        success, data, status = self.make_request('POST', '/match/private', {
            'action': 'create'
        })
        expected_fail = status == 401 and 'error' in data
        self.log_result(
            "Private Match Create - Auth Required", 
            expected_fail, 
            "Should return 401 without authentication"
        )

    def test_private_match_join(self):
        """Test POST /api/match/private with action='join' - Join private match"""
        print("🎯 Testing Private Match - Join")
        
        # Test without authentication
        success, data, status = self.make_request('POST', '/match/private', {
            'action': 'join',
            'code': 'ABC123'
        })
        expected_fail = status == 401 and 'error' in data
        self.log_result(
            "Private Match Join - Auth Required", 
            expected_fail, 
            "Should return 401 without authentication"
        )

    def test_private_match_check(self):
        """Test POST /api/match/private with action='check' - Check match status"""
        print("🎯 Testing Private Match - Check Status")
        
        # Test without authentication
        success, data, status = self.make_request('POST', '/match/private', {
            'action': 'check',
            'code': 'ABC123'
        })
        expected_fail = status == 401 and 'error' in data
        self.log_result(
            "Private Match Check - Auth Required", 
            expected_fail, 
            "Should return 401 without authentication"
        )

    def test_api_root(self):
        """Test API root endpoint"""
        print("🏠 Testing API Root Endpoint")
        
        success, data, status = self.make_request('GET', '/')
        
        root_working = success and 'message' in data and 'version' in data
        self.log_result(
            "API Root Endpoint", 
            root_working, 
            f"API Version: {data.get('version', 'N/A')}" if root_working else f"Status: {status}"
        )

    def test_cors_headers(self):
        """Test CORS headers are properly set"""
        print("🌐 Testing CORS Headers")
        
        # Make an OPTIONS request
        try:
            response = self.session.options(f"{API_BASE}/")
            has_cors = (
                'Access-Control-Allow-Origin' in response.headers and
                'Access-Control-Allow-Methods' in response.headers and
                'Access-Control-Allow-Headers' in response.headers
            )
            
            self.log_result(
                "CORS Headers", 
                has_cors, 
                f"CORS headers present: {has_cors}"
            )
        except Exception as e:
            self.log_result(
                "CORS Headers", 
                False, 
                f"Error testing CORS: {str(e)}"
            )

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting SolMate Backend API Tests")
        print(f"🌐 Base URL: {BASE_URL}")
        print("=" * 60)
        
        # Test basic connectivity
        self.test_api_root()
        self.test_cors_headers()
        
        # Test wallet authentication (NEW - just fixed)
        self.test_wallet_auth_nonce()
        self.test_wallet_auth_verify()
        
        # Test NextAuth providers
        self.test_nextauth_providers()
        
        # Test user signup
        self.test_user_signup()
        
        # Test bot game APIs
        self.test_bot_game_start()
        self.test_bot_game_move()
        
        # Test private match APIs (NEW feature)
        self.test_private_match_create()
        self.test_private_match_join()
        self.test_private_match_check()
        
        # Print summary
        return self.print_summary()

    def print_summary(self):
        """Print test summary"""
        print("=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  ❌ {result['test']}: {result['details']}")
        
        print("\n" + "=" * 60)
        
        return passed_tests, failed_tests

if __name__ == "__main__":
    tester = SolMateAPITester()
    passed, failed = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if failed == 0 else 1)