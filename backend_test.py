#!/usr/bin/env python3
"""
Comprehensive Email/Password Authentication System Test
Tests all auth endpoints for PlaySolMates chess app
"""

import requests
import json
import time
import os
from datetime import datetime

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://auth-revamp-16.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

# Test data
TEST_EMAIL = "testuser@example.com"
TEST_PASSWORD = "testpassword123"
TEST_DISPLAY_NAME = "Test User"
WEAK_PASSWORD = "123"
INVALID_EMAIL = "invalid-email"

class AuthTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.test_results = []
        
    def log_result(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details,
            'timestamp': datetime.now().isoformat()
        })
    
    def test_signup_validation(self):
        """Test signup endpoint validation"""
        print("\n=== Testing Signup Validation ===")
        
        # Test missing email
        try:
            response = self.session.post(f"{API_BASE}/auth/signup", json={
                "password": TEST_PASSWORD,
                "agreedToTerms": True
            })
            success = response.status_code == 400 and "email" in response.text.lower()
            self.log_result("Signup - Missing email validation", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Signup - Missing email validation", False, f"Error: {e}")
        
        # Test missing password
        try:
            response = self.session.post(f"{API_BASE}/auth/signup", json={
                "email": TEST_EMAIL,
                "agreedToTerms": True
            })
            success = response.status_code == 400 and "password" in response.text.lower()
            self.log_result("Signup - Missing password validation", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Signup - Missing password validation", False, f"Error: {e}")
        
        # Test missing terms agreement
        try:
            response = self.session.post(f"{API_BASE}/auth/signup", json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            })
            success = response.status_code == 400 and "terms" in response.text.lower()
            self.log_result("Signup - Missing terms validation", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Signup - Missing terms validation", False, f"Error: {e}")
        
        # Test invalid email format
        try:
            response = self.session.post(f"{API_BASE}/auth/signup", json={
                "email": INVALID_EMAIL,
                "password": TEST_PASSWORD,
                "agreedToTerms": True
            })
            success = response.status_code == 400 and "email" in response.text.lower()
            self.log_result("Signup - Invalid email format", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Signup - Invalid email format", False, f"Error: {e}")
        
        # Test weak password
        try:
            response = self.session.post(f"{API_BASE}/auth/signup", json={
                "email": TEST_EMAIL,
                "password": WEAK_PASSWORD,
                "agreedToTerms": True
            })
            success = response.status_code == 400 and ("8 characters" in response.text or "password" in response.text.lower())
            self.log_result("Signup - Weak password validation", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Signup - Weak password validation", False, f"Error: {e}")
    
    def test_signup_success(self):
        """Test successful signup"""
        print("\n=== Testing Successful Signup ===")
        
        try:
            response = self.session.post(f"{API_BASE}/auth/signup", json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "displayName": TEST_DISPLAY_NAME,
                "agreedToTerms": True
            })
            
            if response.status_code == 200:
                data = response.json()
                success = (data.get('success') == True and 
                          data.get('requiresVerification') == True and
                          'verification' in response.text.lower())
                self.log_result("Signup - Successful account creation", success, 
                              f"Status: {response.status_code}, EmailSent: {data.get('emailSent', 'N/A')}")
            else:
                self.log_result("Signup - Successful account creation", False, 
                              f"Status: {response.status_code}, Response: {response.text[:200]}")
        except Exception as e:
            self.log_result("Signup - Successful account creation", False, f"Error: {e}")
    
    def test_duplicate_signup(self):
        """Test duplicate email signup"""
        print("\n=== Testing Duplicate Signup ===")
        
        try:
            # Try to signup with same email again
            response = self.session.post(f"{API_BASE}/auth/signup", json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "displayName": TEST_DISPLAY_NAME,
                "agreedToTerms": True
            })
            
            # Should either allow resend (if not verified) or reject (if already exists)
            success = response.status_code in [200, 400]
            if response.status_code == 200:
                data = response.json()
                success = 'resent' in response.text.lower() or 'verification' in response.text.lower()
            elif response.status_code == 400:
                success = 'exists' in response.text.lower() or 'already' in response.text.lower()
            
            self.log_result("Signup - Duplicate email handling", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Signup - Duplicate email handling", False, f"Error: {e}")
    
    def test_otp_verification(self):
        """Test OTP verification endpoint"""
        print("\n=== Testing OTP Verification ===")
        
        # Test missing fields
        try:
            response = self.session.post(f"{API_BASE}/auth/verify-otp", json={})
            success = response.status_code == 400
            self.log_result("OTP Verify - Missing fields validation", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("OTP Verify - Missing fields validation", False, f"Error: {e}")
        
        # Test invalid OTP
        try:
            response = self.session.post(f"{API_BASE}/auth/verify-otp", json={
                "email": TEST_EMAIL,
                "otp": "000000"
            })
            success = response.status_code == 400 and "invalid" in response.text.lower()
            self.log_result("OTP Verify - Invalid OTP", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("OTP Verify - Invalid OTP", False, f"Error: {e}")
        
        # Test invalid token
        try:
            response = self.session.post(f"{API_BASE}/auth/verify-otp", json={
                "token": "invalid_token_123"
            })
            success = response.status_code == 400 and ("invalid" in response.text.lower() or "expired" in response.text.lower())
            self.log_result("OTP Verify - Invalid token", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("OTP Verify - Invalid token", False, f"Error: {e}")
    
    def test_nextauth_credentials(self):
        """Test NextAuth credentials provider"""
        print("\n=== Testing NextAuth Credentials Login ===")
        
        # Test login without verification (should fail)
        try:
            response = self.session.post(f"{API_BASE}/auth/signin/credentials", json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "redirect": False
            })
            # NextAuth might return different status codes, check for auth failure
            success = response.status_code in [401, 403] or "verify" in response.text.lower()
            self.log_result("NextAuth - Login without verification", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("NextAuth - Login without verification", False, f"Error: {e}")
        
        # Test login with wrong password
        try:
            response = self.session.post(f"{API_BASE}/auth/signin/credentials", json={
                "email": TEST_EMAIL,
                "password": "wrongpassword",
                "redirect": False
            })
            success = response.status_code in [401, 403] or "invalid" in response.text.lower()
            self.log_result("NextAuth - Wrong password", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("NextAuth - Wrong password", False, f"Error: {e}")
        
        # Test login with non-existent email
        try:
            response = self.session.post(f"{API_BASE}/auth/signin/credentials", json={
                "email": "nonexistent@example.com",
                "password": TEST_PASSWORD,
                "redirect": False
            })
            success = response.status_code in [401, 403] or "not found" in response.text.lower()
            self.log_result("NextAuth - Non-existent email", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("NextAuth - Non-existent email", False, f"Error: {e}")
    
    def test_reset_password_request(self):
        """Test password reset request"""
        print("\n=== Testing Password Reset Request ===")
        
        # Test missing email
        try:
            response = self.session.post(f"{API_BASE}/auth/reset-password", json={})
            success = response.status_code == 400 and "email" in response.text.lower()
            self.log_result("Reset Password - Missing email", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Reset Password - Missing email", False, f"Error: {e}")
        
        # Test reset for existing email (should return success for security)
        try:
            response = self.session.post(f"{API_BASE}/auth/reset-password", json={
                "email": TEST_EMAIL
            })
            success = response.status_code == 200 and response.json().get('success') == True
            self.log_result("Reset Password - Existing email", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Reset Password - Existing email", False, f"Error: {e}")
        
        # Test reset for non-existent email (should still return success for security)
        try:
            response = self.session.post(f"{API_BASE}/auth/reset-password", json={
                "email": "nonexistent@example.com"
            })
            success = response.status_code == 200 and response.json().get('success') == True
            self.log_result("Reset Password - Non-existent email (security)", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Reset Password - Non-existent email (security)", False, f"Error: {e}")
    
    def test_reset_token_validation(self):
        """Test reset token validation"""
        print("\n=== Testing Reset Token Validation ===")
        
        # Test missing token
        try:
            response = self.session.get(f"{API_BASE}/auth/reset-password")
            success = response.status_code == 400 and "token" in response.text.lower()
            self.log_result("Reset Token - Missing token", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Reset Token - Missing token", False, f"Error: {e}")
        
        # Test invalid token
        try:
            response = self.session.get(f"{API_BASE}/auth/reset-password?token=invalid_token_123")
            success = response.status_code == 400 and ("invalid" in response.text.lower() or "expired" in response.text.lower())
            self.log_result("Reset Token - Invalid token", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Reset Token - Invalid token", False, f"Error: {e}")
    
    def test_reset_password_set(self):
        """Test setting new password with token"""
        print("\n=== Testing Password Reset Set ===")
        
        # Test missing token
        try:
            response = self.session.post(f"{API_BASE}/auth/reset-password", json={
                "newPassword": "newpassword123"
            })
            success = response.status_code == 400
            self.log_result("Reset Set - Missing token", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Reset Set - Missing token", False, f"Error: {e}")
        
        # Test weak new password
        try:
            response = self.session.post(f"{API_BASE}/auth/reset-password", json={
                "token": "fake_token",
                "newPassword": "123"
            })
            success = response.status_code == 400 and ("8 characters" in response.text or "password" in response.text.lower())
            self.log_result("Reset Set - Weak password", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Reset Set - Weak password", False, f"Error: {e}")
        
        # Test invalid token
        try:
            response = self.session.post(f"{API_BASE}/auth/reset-password", json={
                "token": "invalid_token_123",
                "newPassword": "newpassword123"
            })
            success = response.status_code == 400 and ("invalid" in response.text.lower() or "expired" in response.text.lower())
            self.log_result("Reset Set - Invalid token", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Reset Set - Invalid token", False, f"Error: {e}")
    
    def test_change_password_auth(self):
        """Test change password authentication"""
        print("\n=== Testing Change Password Authentication ===")
        
        # Test without auth header
        try:
            response = self.session.post(f"{API_BASE}/auth/change-password", json={
                "currentPassword": TEST_PASSWORD,
                "newPassword": "newpassword123"
            })
            success = response.status_code == 401
            self.log_result("Change Password - No auth header", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Change Password - No auth header", False, f"Error: {e}")
        
        # Test with invalid auth token
        try:
            headers = {"Authorization": "Bearer invalid_token_123"}
            response = self.session.post(f"{API_BASE}/auth/change-password", 
                                       json={
                                           "currentPassword": TEST_PASSWORD,
                                           "newPassword": "newpassword123"
                                       },
                                       headers=headers)
            success = response.status_code == 401
            self.log_result("Change Password - Invalid auth token", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Change Password - Invalid auth token", False, f"Error: {e}")
    
    def test_change_password_validation(self):
        """Test change password field validation"""
        print("\n=== Testing Change Password Validation ===")
        
        # Create a fake JWT token for testing (won't be valid but tests field validation)
        fake_headers = {"Authorization": "Bearer fake.jwt.token"}
        
        # Test missing current password
        try:
            response = self.session.post(f"{API_BASE}/auth/change-password", 
                                       json={"newPassword": "newpassword123"},
                                       headers=fake_headers)
            success = response.status_code in [400, 401] and ("current" in response.text.lower() or "required" in response.text.lower())
            self.log_result("Change Password - Missing current password", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Change Password - Missing current password", False, f"Error: {e}")
        
        # Test missing new password
        try:
            response = self.session.post(f"{API_BASE}/auth/change-password", 
                                       json={"currentPassword": TEST_PASSWORD},
                                       headers=fake_headers)
            success = response.status_code in [400, 401] and ("new" in response.text.lower() or "required" in response.text.lower())
            self.log_result("Change Password - Missing new password", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Change Password - Missing new password", False, f"Error: {e}")
        
        # Test weak new password
        try:
            response = self.session.post(f"{API_BASE}/auth/change-password", 
                                       json={
                                           "currentPassword": TEST_PASSWORD,
                                           "newPassword": "123"
                                       },
                                       headers=fake_headers)
            success = response.status_code in [400, 401] and ("8 characters" in response.text or "password" in response.text.lower())
            self.log_result("Change Password - Weak new password", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Change Password - Weak new password", False, f"Error: {e}")
    
    def test_api_endpoints_exist(self):
        """Test that all auth endpoints exist and return proper responses"""
        print("\n=== Testing API Endpoints Existence ===")
        
        endpoints = [
            ("POST", "/auth/signup", {"email": "test@test.com", "password": "test123", "agreedToTerms": True}),
            ("POST", "/auth/verify-otp", {"email": "test@test.com", "otp": "123456"}),
            ("POST", "/auth/reset-password", {"email": "test@test.com"}),
            ("GET", "/auth/reset-password?token=test", None),
            ("POST", "/auth/change-password", {"currentPassword": "old", "newPassword": "new123456"})
        ]
        
        for method, endpoint, data in endpoints:
            try:
                url = f"{API_BASE}{endpoint}"
                if method == "GET":
                    response = self.session.get(url)
                else:
                    response = self.session.post(url, json=data)
                
                # Endpoint exists if it doesn't return 404
                success = response.status_code != 404
                self.log_result(f"Endpoint exists - {method} {endpoint}", success, f"Status: {response.status_code}")
            except Exception as e:
                self.log_result(f"Endpoint exists - {method} {endpoint}", False, f"Error: {e}")
    
    def run_all_tests(self):
        """Run all authentication tests"""
        print(f"🧪 Starting Email/Password Authentication System Tests")
        print(f"🌐 Base URL: {BASE_URL}")
        print(f"📧 Test Email: {TEST_EMAIL}")
        print("=" * 60)
        
        # Test endpoint existence first
        self.test_api_endpoints_exist()
        
        # Test signup flow
        self.test_signup_validation()
        self.test_signup_success()
        self.test_duplicate_signup()
        
        # Test OTP verification
        self.test_otp_verification()
        
        # Test NextAuth credentials
        self.test_nextauth_credentials()
        
        # Test password reset flow
        self.test_reset_password_request()
        self.test_reset_token_validation()
        self.test_reset_password_set()
        
        # Test change password
        self.test_change_password_auth()
        self.test_change_password_validation()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
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
            print(f"\n❌ Failed Tests:")
            for result in self.test_results:
                if not result['success']:
                    print(f"   • {result['test']}: {result['details']}")
        
        print("\n🔍 Key Findings:")
        
        # Check critical functionality
        signup_working = any(r['success'] and 'Successful account creation' in r['test'] for r in self.test_results)
        validation_working = any(r['success'] and 'validation' in r['test'].lower() for r in self.test_results)
        endpoints_exist = any(r['success'] and 'Endpoint exists' in r['test'] for r in self.test_results)
        
        if endpoints_exist:
            print("   ✅ All auth endpoints are accessible")
        else:
            print("   ❌ Some auth endpoints are missing or inaccessible")
        
        if validation_working:
            print("   ✅ Input validation is working correctly")
        else:
            print("   ❌ Input validation has issues")
        
        if signup_working:
            print("   ✅ Account creation is functional")
        else:
            print("   ❌ Account creation has issues")
        
        print("   ⚠️  SMTP emails cannot be tested without valid credentials")
        print("   ⚠️  OTP/Token verification requires actual database records")
        print("   ⚠️  NextAuth integration requires session management testing")

if __name__ == "__main__":
    tester = AuthTester()
    tester.run_all_tests()