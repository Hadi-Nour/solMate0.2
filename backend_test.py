#!/usr/bin/env python3
"""
PlaySolMates Authentication System Testing
Tests all auth flows: signup, OTP verification, login, password reset, change password
"""

import requests
import json
import time
import random
import string
from datetime import datetime

# Configuration
BASE_URL = "https://auth-revamp-17.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

def generate_test_email():
    """Generate a unique test email"""
    timestamp = int(time.time())
    random_str = ''.join(random.choices(string.ascii_lowercase, k=6))
    return f"test_{timestamp}_{random_str}@example.com"

def generate_test_password():
    """Generate a test password"""
    return "TestPass123!"

def print_test_result(test_name, success, details=""):
    """Print formatted test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"    {details}")
    print()

def test_signup_flow():
    """Test 1: Signup Flow"""
    print("=== TEST 1: SIGNUP FLOW ===")
    
    test_email = generate_test_email()
    test_password = generate_test_password()
    test_display_name = "Test User"
    
    # Test 1.1: Valid signup
    try:
        response = requests.post(f"{API_BASE}/auth/signup", json={
            "email": test_email,
            "password": test_password,
            "displayName": test_display_name,
            "agreedToTerms": True
        })
        
        success = response.status_code == 200
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        
        print_test_result(
            "Valid signup with email/password/terms",
            success,
            f"Status: {response.status_code}, Response: {data.get('message', 'No message')}"
        )
        
        if success:
            global test_user_email, test_user_password
            test_user_email = test_email
            test_user_password = test_password
            
    except Exception as e:
        print_test_result("Valid signup", False, f"Exception: {str(e)}")
    
    # Test 1.2: Missing email
    try:
        response = requests.post(f"{API_BASE}/auth/signup", json={
            "password": test_password,
            "displayName": test_display_name,
            "agreedToTerms": True
        })
        
        success = response.status_code == 400
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        
        print_test_result(
            "Missing email validation",
            success,
            f"Status: {response.status_code}, Error: {data.get('error', 'No error message')}"
        )
        
    except Exception as e:
        print_test_result("Missing email validation", False, f"Exception: {str(e)}")
    
    # Test 1.3: Weak password
    try:
        response = requests.post(f"{API_BASE}/auth/signup", json={
            "email": generate_test_email(),
            "password": "weak",
            "displayName": test_display_name,
            "agreedToTerms": True
        })
        
        success = response.status_code == 400
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        
        print_test_result(
            "Weak password validation (< 8 chars)",
            success,
            f"Status: {response.status_code}, Error: {data.get('error', 'No error message')}"
        )
        
    except Exception as e:
        print_test_result("Weak password validation", False, f"Exception: {str(e)}")
    
    # Test 1.4: Missing terms agreement
    try:
        response = requests.post(f"{API_BASE}/auth/signup", json={
            "email": generate_test_email(),
            "password": test_password,
            "displayName": test_display_name,
            "agreedToTerms": False
        })
        
        success = response.status_code == 400
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        
        print_test_result(
            "Terms agreement validation",
            success,
            f"Status: {response.status_code}, Error: {data.get('error', 'No error message')}"
        )
        
    except Exception as e:
        print_test_result("Terms agreement validation", False, f"Exception: {str(e)}")

def test_resend_otp():
    """Test 2: Resend OTP for Unverified User"""
    print("=== TEST 2: RESEND OTP FOR UNVERIFIED USER ===")
    
    if 'test_user_email' not in globals() or test_user_email is None:
        print("❌ SKIP - No test user from signup flow")
        return
    
    try:
        response = requests.post(f"{API_BASE}/auth/signup", json={
            "email": test_user_email,
            "resendOnly": True
        })
        
        success = response.status_code == 200
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        
        print_test_result(
            "Resend OTP for existing unverified user",
            success,
            f"Status: {response.status_code}, RequiresVerification: {data.get('requiresVerification', False)}"
        )
        
    except Exception as e:
        print_test_result("Resend OTP", False, f"Exception: {str(e)}")

def test_otp_verification():
    """Test 3: OTP Verification"""
    print("=== TEST 3: OTP VERIFICATION ===")
    
    # Test 3.1: Missing fields
    try:
        response = requests.post(f"{API_BASE}/auth/verify-otp", json={})
        
        success = response.status_code == 400
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        
        print_test_result(
            "Missing email/OTP validation",
            success,
            f"Status: {response.status_code}, Error: {data.get('error', 'No error message')}"
        )
        
    except Exception as e:
        print_test_result("Missing fields validation", False, f"Exception: {str(e)}")
    
    # Test 3.2: Invalid OTP
    try:
        response = requests.post(f"{API_BASE}/auth/verify-otp", json={
            "email": test_user_email if 'test_user_email' in globals() else "test@example.com",
            "otp": "000000"
        })
        
        success = response.status_code == 400
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        
        print_test_result(
            "Invalid OTP validation",
            success,
            f"Status: {response.status_code}, Error: {data.get('error', 'No error message')}"
        )
        
    except Exception as e:
        print_test_result("Invalid OTP validation", False, f"Exception: {str(e)}")
    
    # Test 3.3: Invalid token
    try:
        response = requests.post(f"{API_BASE}/auth/verify-otp", json={
            "token": "invalid_token_12345"
        })
        
        success = response.status_code == 400
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        
        print_test_result(
            "Invalid token validation",
            success,
            f"Status: {response.status_code}, Error: {data.get('error', 'No error message')}"
        )
        
    except Exception as e:
        print_test_result("Invalid token validation", False, f"Exception: {str(e)}")

def test_login_flow():
    """Test 4: Login Flow (Critical - test emailVerified enforcement)"""
    print("=== TEST 4: LOGIN FLOW (CRITICAL - EMAIL VERIFICATION ENFORCEMENT) ===")
    
    # First, let's test the NextAuth credentials provider endpoint
    # Test 4.1: Get CSRF token
    try:
        response = requests.get(f"{API_BASE}/auth/csrf")
        
        success = response.status_code == 200
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        csrf_token = data.get('csrfToken', '')
        
        print_test_result(
            "Get CSRF token",
            success,
            f"Status: {response.status_code}, CSRF Token: {'Present' if csrf_token else 'Missing'}"
        )
        
    except Exception as e:
        print_test_result("Get CSRF token", False, f"Exception: {str(e)}")
        csrf_token = ""
    
    # Test 4.2: Login with unverified email (should fail)
    if 'test_user_email' in globals() and 'test_user_password' in globals() and test_user_email and test_user_password:
        try:
            response = requests.post(f"{API_BASE}/auth/callback/credentials", 
                data={
                    "email": test_user_email,
                    "password": test_user_password,
                    "csrfToken": csrf_token,
                    "callbackUrl": f"{BASE_URL}",
                    "json": "true"
                },
                headers={
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            )
            
            # Check if login was blocked due to unverified email
            response_text = response.text.lower()
            success = response.status_code in [401, 400] or "verify" in response_text or "error" in response_text
            
            print_test_result(
                "Login with unverified email (should fail)",
                success,
                f"Status: {response.status_code}, Response contains 'verify': {'verify' in response_text}"
            )
            
        except Exception as e:
            print_test_result("Login with unverified email", False, f"Exception: {str(e)}")
    else:
        print_test_result("Login with unverified email", False, "No test user available from signup")
    
    # Test 4.3: Login with wrong password
    try:
        response = requests.post(f"{API_BASE}/auth/callback/credentials", 
            data={
                "email": "test@example.com",
                "password": "wrongpassword",
                "csrfToken": csrf_token,
                "callbackUrl": f"{BASE_URL}",
                "json": "true"
            },
            headers={
                "Content-Type": "application/x-www-form-urlencoded"
            }
        )
        
        response_text = response.text.lower()
        success = response.status_code in [401, 400] or "error" in response_text
        
        print_test_result(
            "Login with wrong password (should fail)",
            success,
            f"Status: {response.status_code}, Response contains error: {'error' in response_text}"
        )
        
    except Exception as e:
        print_test_result("Login with wrong password", False, f"Exception: {str(e)}")
    
    # Test 4.4: Login with non-existent email
    try:
        response = requests.post(f"{API_BASE}/auth/callback/credentials", 
            data={
                "email": "nonexistent@example.com",
                "password": "somepassword",
                "csrfToken": csrf_token,
                "callbackUrl": f"{BASE_URL}",
                "json": "true"
            },
            headers={
                "Content-Type": "application/x-www-form-urlencoded"
            }
        )
        
        response_text = response.text.lower()
        success = response.status_code in [401, 400] or "error" in response_text
        
        print_test_result(
            "Login with non-existent email (should fail)",
            success,
            f"Status: {response.status_code}, Response contains error: {'error' in response_text}"
        )
        
    except Exception as e:
        print_test_result("Login with non-existent email", False, f"Exception: {str(e)}")

def test_password_reset_flow():
    """Test 5: Password Reset Flow"""
    print("=== TEST 5: PASSWORD RESET FLOW ===")
    
    # Test 5.1: Request password reset
    try:
        response = requests.post(f"{API_BASE}/auth/reset-password", json={
            "email": "test@example.com"
        })
        
        success = response.status_code == 200
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        
        print_test_result(
            "Request password reset",
            success,
            f"Status: {response.status_code}, Message: {data.get('message', 'No message')}"
        )
        
    except Exception as e:
        print_test_result("Request password reset", False, f"Exception: {str(e)}")
    
    # Test 5.2: Request reset for non-existent email (should still return success for security)
    try:
        response = requests.post(f"{API_BASE}/auth/reset-password", json={
            "email": "nonexistent@example.com"
        })
        
        success = response.status_code == 200
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        
        print_test_result(
            "Request reset for non-existent email (security)",
            success,
            f"Status: {response.status_code}, Message: {data.get('message', 'No message')}"
        )
        
    except Exception as e:
        print_test_result("Request reset for non-existent email", False, f"Exception: {str(e)}")
    
    # Test 5.3: Validate invalid reset token
    try:
        response = requests.get(f"{API_BASE}/auth/reset-password?token=invalid_token_12345")
        
        success = response.status_code == 400
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        
        print_test_result(
            "Validate invalid reset token",
            success,
            f"Status: {response.status_code}, Valid: {data.get('valid', 'N/A')}"
        )
        
    except Exception as e:
        print_test_result("Validate invalid reset token", False, f"Exception: {str(e)}")
    
    # Test 5.4: Set new password with invalid token
    try:
        response = requests.post(f"{API_BASE}/auth/reset-password", json={
            "token": "invalid_token_12345",
            "newPassword": "NewPassword123!"
        })
        
        success = response.status_code == 400
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        
        print_test_result(
            "Set password with invalid token",
            success,
            f"Status: {response.status_code}, Error: {data.get('error', 'No error message')}"
        )
        
    except Exception as e:
        print_test_result("Set password with invalid token", False, f"Exception: {str(e)}")
    
    # Test 5.5: Set password with weak password
    try:
        response = requests.post(f"{API_BASE}/auth/reset-password", json={
            "token": "some_token",
            "newPassword": "weak"
        })
        
        success = response.status_code == 400
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        
        print_test_result(
            "Set weak password validation",
            success,
            f"Status: {response.status_code}, Error: {data.get('error', 'No error message')}"
        )
        
    except Exception as e:
        print_test_result("Set weak password validation", False, f"Exception: {str(e)}")

def test_change_password():
    """Test 6: Change Password (Authenticated)"""
    print("=== TEST 6: CHANGE PASSWORD (AUTHENTICATED) ===")
    
    # Test 6.1: Change password without authentication
    try:
        response = requests.post(f"{API_BASE}/auth/change-password", json={
            "currentPassword": "oldpass",
            "newPassword": "newpass123"
        })
        
        success = response.status_code == 401
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        
        print_test_result(
            "Change password without auth (should fail)",
            success,
            f"Status: {response.status_code}, Error: {data.get('error', 'No error message')}"
        )
        
    except Exception as e:
        print_test_result("Change password without auth", False, f"Exception: {str(e)}")
    
    # Test 6.2: Change password with invalid token
    try:
        response = requests.post(f"{API_BASE}/auth/change-password", 
            json={
                "currentPassword": "oldpass",
                "newPassword": "newpass123"
            },
            headers={
                "Authorization": "Bearer invalid_token_12345"
            }
        )
        
        success = response.status_code == 401
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        
        print_test_result(
            "Change password with invalid token (should fail)",
            success,
            f"Status: {response.status_code}, Error: {data.get('error', 'No error message')}"
        )
        
    except Exception as e:
        print_test_result("Change password with invalid token", False, f"Exception: {str(e)}")

def test_email_status():
    """Test 7: Email Status Check"""
    print("=== TEST 7: EMAIL STATUS CHECK ===")
    
    try:
        response = requests.get(f"{API_BASE}/auth/email-status")
        
        success = response.status_code == 200
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        
        smtp_config = data.get('smtp', {})
        status = data.get('status', 'unknown')
        
        print_test_result(
            "SMTP configuration health check",
            success,
            f"Status: {response.status_code}, SMTP Status: {status}, Host: {smtp_config.get('host', 'N/A')}"
        )
        
        if success:
            print(f"    SMTP Config: Host={smtp_config.get('host')}, Port={smtp_config.get('port')}, User={smtp_config.get('user')}")
            print(f"    Has Password: {smtp_config.get('hasPassword', False)}, From: {smtp_config.get('from')}")
        
    except Exception as e:
        print_test_result("Email status check", False, f"Exception: {str(e)}")

def main():
    """Run all authentication tests"""
    print("🧪 PLAYSOLMATES AUTHENTICATION SYSTEM TESTING")
    print("=" * 60)
    print(f"Base URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    print()
    
    # Store test user data globally for cross-test usage
    global test_user_email, test_user_password
    test_user_email = None
    test_user_password = None
    
    # Run all tests
    test_signup_flow()
    test_resend_otp()
    test_otp_verification()
    test_login_flow()
    test_password_reset_flow()
    test_change_password()
    test_email_status()
    
    print("=" * 60)
    print("🏁 AUTHENTICATION TESTING COMPLETED")
    print("=" * 60)

if __name__ == "__main__":
    main()