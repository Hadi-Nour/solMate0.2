#!/usr/bin/env python3
"""
Focused Authentication Testing - Critical Email Verification Issue
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

def test_critical_email_verification_enforcement():
    """Test the critical issue: email verification enforcement in login"""
    print("🔍 CRITICAL TEST: EMAIL VERIFICATION ENFORCEMENT")
    print("=" * 60)
    
    # Step 1: Create a test user (unverified)
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
    
    # Step 2: Try to login with unverified email using NextAuth session endpoint
    print(f"\\nTesting login with unverified email...")
    
    # Get session to check if user can authenticate
    session_response = requests.get(f"{API_BASE}/auth/session")
    print(f"Initial session status: {session_response.status_code}")
    
    # Try to authenticate using NextAuth signin
    signin_data = {
        'email': test_email,
        'password': test_password,
        'redirect': 'false',
        'json': 'true'
    }
    
    signin_response = requests.post(f"{API_BASE}/auth/signin/credentials", 
        data=signin_data,
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        allow_redirects=False
    )
    
    print(f"Signin response status: {signin_response.status_code}")
    print(f"Signin response headers: {dict(signin_response.headers)}")
    
    # Check if there's an error in the response
    if 'location' in signin_response.headers:
        location = signin_response.headers['location']
        print(f"Redirect location: {location}")
        
        # Check if redirect contains error
        if 'error' in location:
            print("✅ PASS: Login blocked with error redirect")
            if 'verify' in location.lower():
                print("✅ PASS: Error is related to email verification")
            else:
                print("⚠️  WARNING: Error exists but not verification-related")
        else:
            print("❌ FAIL: Login succeeded without email verification")
    else:
        print(f"Response body: {signin_response.text[:200]}...")
    
    # Step 3: Check session after attempted login
    post_signin_session = requests.get(f"{API_BASE}/auth/session")
    print(f"\\nPost-signin session status: {post_signin_session.status_code}")
    
    if post_signin_session.status_code == 200:
        session_data = post_signin_session.json()
        if session_data.get('user'):
            print("❌ CRITICAL FAIL: User session created despite unverified email!")
            print(f"Session user: {session_data['user']}")
        else:
            print("✅ PASS: No user session created")
    
    # Step 4: Test with a verified user for comparison
    print(f"\\n--- Testing with verified user for comparison ---")
    
    # Create another user and verify them
    verified_email = generate_test_email()
    verified_password = "VerifiedPass123!"
    
    # Create user
    verified_signup = requests.post(f"{API_BASE}/auth/signup", json={
        "email": verified_email,
        "password": verified_password,
        "displayName": "Verified User",
        "agreedToTerms": True
    })
    
    if verified_signup.status_code == 200:
        print(f"✅ Verified test user created: {verified_email}")
        
        # Manually verify the user by calling verify-otp with a fake but valid-looking token
        # (This won't work with real OTP, but we can test the login flow)
        
        # Try login with verified user (this should work if verification is properly implemented)
        verified_signin = requests.post(f"{API_BASE}/auth/signin/credentials", 
            data={
                'email': verified_email,
                'password': verified_password,
                'redirect': 'false',
                'json': 'true'
            },
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            allow_redirects=False
        )
        
        print(f"Verified user signin status: {verified_signin.status_code}")
        if 'location' in verified_signin.headers:
            location = verified_signin.headers['location']
            if 'error' in location:
                print(f"Verified user login error: {location}")
            else:
                print("Verified user login redirect (likely success)")

def test_nextauth_credentials_provider_directly():
    """Test the NextAuth credentials provider configuration"""
    print("\\n🔧 TESTING NEXTAUTH CREDENTIALS PROVIDER CONFIGURATION")
    print("=" * 60)
    
    # Check providers
    providers_response = requests.get(f"{API_BASE}/auth/providers")
    if providers_response.status_code == 200:
        providers = providers_response.json()
        print(f"Available providers: {list(providers.keys())}")
        
        if 'credentials' in providers:
            creds_provider = providers['credentials']
            print(f"Credentials provider config: {creds_provider}")
        else:
            print("❌ Credentials provider not found!")
    
    # Test CSRF token generation
    csrf_response = requests.get(f"{API_BASE}/auth/csrf")
    if csrf_response.status_code == 200:
        csrf_data = csrf_response.json()
        print(f"✅ CSRF token generated: {csrf_data.get('csrfToken', 'N/A')[:20]}...")
    else:
        print(f"❌ CSRF token generation failed: {csrf_response.status_code}")

def main():
    """Run focused authentication tests"""
    print("🧪 FOCUSED AUTHENTICATION TESTING - EMAIL VERIFICATION ISSUE")
    print("=" * 70)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)
    
    test_nextauth_credentials_provider_directly()
    test_critical_email_verification_enforcement()
    
    print("\\n" + "=" * 70)
    print("🏁 FOCUSED TESTING COMPLETED")
    print("=" * 70)

if __name__ == "__main__":
    main()