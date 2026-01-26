#!/usr/bin/env python3
"""
Database Direct Testing - Check email verification status
"""

import requests
import json
import time
import random
import string
from datetime import datetime

# Configuration
BASE_URL = "https://auth-revamp-16.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

def generate_test_email():
    """Generate a unique test email"""
    timestamp = int(time.time())
    random_str = ''.join(random.choices(string.ascii_lowercase, k=6))
    return f"test_{timestamp}_{random_str}@example.com"

def test_email_verification_status():
    """Test if users are properly marked as unverified"""
    print("🔍 TESTING EMAIL VERIFICATION STATUS IN DATABASE")
    print("=" * 60)
    
    # Create a test user
    test_email = generate_test_email()
    test_password = "TestPass123!"
    
    print(f"Creating test user: {test_email}")
    
    signup_response = requests.post(f"{API_BASE}/auth/signup", json={
        "email": test_email,
        "password": test_password,
        "displayName": "Test User",
        "agreedToTerms": True
    })
    
    if signup_response.status_code != 200:
        print(f"❌ Failed to create test user: {signup_response.status_code}")
        return
    
    print(f"✅ Test user created successfully")
    
    # Now try to login and capture the exact error
    print(f"\\nTesting login with detailed error capture...")
    
    # Test with callback endpoint (this should trigger the authorize function)
    callback_response = requests.post(f"{API_BASE}/auth/callback/credentials", 
        data={
            'email': test_email,
            'password': test_password,
            'callbackUrl': f'{BASE_URL}',
            'json': 'true'
        },
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        allow_redirects=False
    )
    
    print(f"Callback response status: {callback_response.status_code}")
    print(f"Callback response headers: {dict(callback_response.headers)}")
    
    if 'location' in callback_response.headers:
        location = callback_response.headers['location']
        print(f"Redirect location: {location}")
        
        # Parse the redirect URL for errors
        if 'error=' in location:
            # Extract error from URL
            error_start = location.find('error=') + 6
            error_end = location.find('&', error_start)
            if error_end == -1:
                error_end = len(location)
            error_code = location[error_start:error_end]
            print(f"✅ Error found in redirect: {error_code}")
            
            # Check if it's verification related
            if 'verify' in error_code.lower() or 'verification' in error_code.lower():
                print("✅ PASS: Email verification error detected!")
            else:
                print(f"⚠️  WARNING: Error detected but not verification-related: {error_code}")
        else:
            print("❌ FAIL: No error in redirect URL - login may have succeeded")
    
    # Test with wrong password to see if error handling works at all
    print(f"\\nTesting with wrong password for comparison...")
    
    wrong_password_response = requests.post(f"{API_BASE}/auth/callback/credentials", 
        data={
            'email': test_email,
            'password': 'wrongpassword123',
            'callbackUrl': f'{BASE_URL}',
            'json': 'true'
        },
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        allow_redirects=False
    )
    
    print(f"Wrong password status: {wrong_password_response.status_code}")
    if 'location' in wrong_password_response.headers:
        location = wrong_password_response.headers['location']
        print(f"Wrong password redirect: {location}")
        if 'error=' in location:
            print("✅ Error handling is working for wrong password")
        else:
            print("❌ Error handling not working for wrong password either")

def test_manual_verification():
    """Test what happens after manual verification"""
    print("\\n🔧 TESTING MANUAL VERIFICATION FLOW")
    print("=" * 60)
    
    # Create a user and try to verify them manually
    test_email = generate_test_email()
    test_password = "TestPass123!"
    
    print(f"Creating user for verification test: {test_email}")
    
    signup_response = requests.post(f"{API_BASE}/auth/signup", json={
        "email": test_email,
        "password": test_password,
        "displayName": "Verification Test User",
        "agreedToTerms": True
    })
    
    if signup_response.status_code != 200:
        print(f"❌ Failed to create verification test user")
        return
    
    print(f"✅ Verification test user created")
    
    # Try to verify with a fake OTP (this should fail but show us the verification flow)
    verify_response = requests.post(f"{API_BASE}/auth/verify-otp", json={
        "email": test_email,
        "otp": "123456"  # Fake OTP
    })
    
    print(f"Fake OTP verification status: {verify_response.status_code}")
    if verify_response.status_code == 400:
        verify_data = verify_response.json()
        print(f"Expected verification error: {verify_data.get('error', 'No error message')}")
    
    # Now test login before verification
    print(f"Testing login before verification...")
    
    pre_verify_login = requests.post(f"{API_BASE}/auth/callback/credentials", 
        data={
            'email': test_email,
            'password': test_password,
            'callbackUrl': f'{BASE_URL}',
            'json': 'true'
        },
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        allow_redirects=False
    )
    
    print(f"Pre-verification login status: {pre_verify_login.status_code}")
    if 'location' in pre_verify_login.headers:
        location = pre_verify_login.headers['location']
        print(f"Pre-verification redirect: {location}")
        
        if 'error=' in location:
            print("✅ PASS: Login blocked before verification")
        else:
            print("❌ CRITICAL FAIL: Login succeeded before verification!")

def main():
    """Run database verification tests"""
    print("🧪 DATABASE EMAIL VERIFICATION TESTING")
    print("=" * 70)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)
    
    test_email_verification_status()
    test_manual_verification()
    
    print("\\n" + "=" * 70)
    print("🏁 DATABASE VERIFICATION TESTING COMPLETED")
    print("=" * 70)

if __name__ == "__main__":
    main()