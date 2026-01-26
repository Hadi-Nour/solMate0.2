#!/usr/bin/env python3
"""
Direct MongoDB Testing - Check if users are properly stored
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

def test_nextauth_debug():
    """Test NextAuth with debug information"""
    print("🔍 NEXTAUTH DEBUG TESTING")
    print("=" * 60)
    
    # Create a test user first
    test_email = generate_test_email()
    test_password = "TestPass123!"
    
    print(f"Creating test user: {test_email}")
    
    signup_response = requests.post(f"{API_BASE}/auth/signup", json={
        "email": test_email,
        "password": test_password,
        "displayName": "Debug Test User",
        "agreedToTerms": True
    })
    
    if signup_response.status_code != 200:
        print(f"❌ Failed to create test user: {signup_response.status_code}")
        return
    
    print(f"✅ Test user created successfully")
    
    # Now test various NextAuth endpoints
    print(f"\\n--- Testing NextAuth Endpoints ---")
    
    # 1. Test providers
    providers_response = requests.get(f"{API_BASE}/auth/providers")
    print(f"Providers endpoint: {providers_response.status_code}")
    if providers_response.status_code == 200:
        providers = providers_response.json()
        print(f"Available providers: {list(providers.keys())}")
    
    # 2. Test CSRF
    csrf_response = requests.get(f"{API_BASE}/auth/csrf")
    print(f"CSRF endpoint: {csrf_response.status_code}")
    csrf_token = ""
    if csrf_response.status_code == 200:
        csrf_data = csrf_response.json()
        csrf_token = csrf_data.get('csrfToken', '')
        print(f"CSRF token: {csrf_token[:20]}...")
    
    # 3. Test signin endpoint (should redirect to login page)
    signin_response = requests.get(f"{API_BASE}/auth/signin")
    print(f"Signin GET endpoint: {signin_response.status_code}")
    
    # 4. Test callback with proper CSRF token
    print(f"\\n--- Testing Callback with CSRF Token ---")
    
    callback_response = requests.post(f"{API_BASE}/auth/callback/credentials", 
        data={
            'email': test_email,
            'password': test_password,
            'csrfToken': csrf_token,
            'callbackUrl': f'{BASE_URL}',
            'json': 'true'
        },
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        allow_redirects=False
    )
    
    print(f"Callback with CSRF status: {callback_response.status_code}")
    print(f"Callback response: {callback_response.text}")
    
    if 'location' in callback_response.headers:
        location = callback_response.headers['location']
        print(f"Redirect location: {location}")
    
    # 5. Test with wrong password
    print(f"\\n--- Testing Wrong Password ---")
    
    wrong_callback = requests.post(f"{API_BASE}/auth/callback/credentials", 
        data={
            'email': test_email,
            'password': 'wrongpassword123',
            'csrfToken': csrf_token,
            'callbackUrl': f'{BASE_URL}',
            'json': 'true'
        },
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        allow_redirects=False
    )
    
    print(f"Wrong password status: {wrong_callback.status_code}")
    print(f"Wrong password response: {wrong_callback.text}")
    
    if 'location' in wrong_callback.headers:
        location = wrong_callback.headers['location']
        print(f"Wrong password redirect: {location}")
    
    # 6. Test session after attempts
    print(f"\\n--- Testing Session ---")
    
    session_response = requests.get(f"{API_BASE}/auth/session")
    print(f"Session status: {session_response.status_code}")
    if session_response.status_code == 200:
        session_data = session_response.json()
        print(f"Session data: {session_data}")

def test_direct_signin_endpoint():
    """Test the direct signin endpoint"""
    print("\\n🔧 TESTING DIRECT SIGNIN ENDPOINT")
    print("=" * 60)
    
    # Test POST to signin/credentials
    signin_response = requests.post(f"{API_BASE}/auth/signin/credentials", 
        json={
            'email': 'test@example.com',
            'password': 'wrongpassword',
            'callbackUrl': f'{BASE_URL}',
            'redirect': False
        },
        headers={'Content-Type': 'application/json'}
    )
    
    print(f"Direct signin status: {signin_response.status_code}")
    print(f"Direct signin response: {signin_response.text[:200]}...")
    
    # Test with form data
    signin_form_response = requests.post(f"{API_BASE}/auth/signin/credentials", 
        data={
            'email': 'test@example.com',
            'password': 'wrongpassword',
            'callbackUrl': f'{BASE_URL}',
            'redirect': 'false'
        },
        headers={'Content-Type': 'application/x-www-form-urlencoded'}
    )
    
    print(f"Form signin status: {signin_form_response.status_code}")
    print(f"Form signin response: {signin_form_response.text[:200]}...")

def main():
    """Run NextAuth debug tests"""
    print("🧪 NEXTAUTH DEBUG TESTING")
    print("=" * 70)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)
    
    test_nextauth_debug()
    test_direct_signin_endpoint()
    
    print("\\n" + "=" * 70)
    print("🏁 NEXTAUTH DEBUG TESTING COMPLETED")
    print("=" * 70)

if __name__ == "__main__":
    main()