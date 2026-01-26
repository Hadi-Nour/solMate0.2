#!/usr/bin/env python3
"""
Debug Email Magic Link Signin Flow
Detailed investigation of the email signin process
"""

import requests
import json
import os
from datetime import datetime

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://auth-revamp-16.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

def print_test_header(test_name):
    print(f"\n{'='*60}")
    print(f"🧪 {test_name}")
    print(f"{'='*60}")

def print_success(message):
    print(f"✅ {message}")

def print_error(message):
    print(f"❌ {message}")

def print_info(message):
    print(f"ℹ️  {message}")

def debug_email_signin():
    """Debug the email signin flow step by step"""
    print_test_header("Debug Email Signin Flow")
    
    # Step 1: Get CSRF token
    print_info("Step 1: Getting CSRF token...")
    csrf_response = requests.get(f"{API_BASE}/auth/csrf", timeout=10)
    print_info(f"CSRF Status: {csrf_response.status_code}")
    
    if csrf_response.status_code != 200:
        print_error("Failed to get CSRF token")
        return False
    
    csrf_data = csrf_response.json()
    csrf_token = csrf_data.get('csrfToken')
    print_success(f"CSRF Token: {csrf_token[:20]}...")
    
    # Step 2: Try email signin with session cookies
    print_info("Step 2: Attempting email signin with session...")
    
    # Create a session to maintain cookies
    session = requests.Session()
    
    # Get CSRF token with session
    csrf_response = session.get(f"{API_BASE}/auth/csrf", timeout=10)
    csrf_data = csrf_response.json()
    csrf_token = csrf_data.get('csrfToken')
    print_info(f"Session CSRF Token: {csrf_token[:20]}...")
    
    # Prepare signin data
    signin_data = {
        'email': 'test@example.com',
        'callbackUrl': f"{BASE_URL}/",
        'csrfToken': csrf_token,
        'json': 'true'  # Request JSON response
    }
    
    print_info(f"Signin data: {json.dumps(signin_data, indent=2)}")
    
    # Try with JSON content type
    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
    
    signin_response = session.post(
        f"{API_BASE}/auth/signin/email",
        json=signin_data,
        headers=headers,
        timeout=15,
        allow_redirects=False
    )
    
    print_info(f"JSON Signin Status: {signin_response.status_code}")
    print_info(f"JSON Signin Headers: {dict(signin_response.headers)}")
    
    if signin_response.status_code in [200, 302]:
        try:
            response_json = signin_response.json()
            print_info(f"JSON Response: {json.dumps(response_json, indent=2)}")
        except:
            print_info(f"Response Text: {signin_response.text[:500]}...")
    
    # Step 3: Try with form data
    print_info("Step 3: Trying with form data...")
    
    form_headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
    
    form_response = session.post(
        f"{API_BASE}/auth/signin/email",
        data=signin_data,
        headers=form_headers,
        timeout=15,
        allow_redirects=False
    )
    
    print_info(f"Form Signin Status: {form_response.status_code}")
    print_info(f"Form Signin Headers: {dict(form_response.headers)}")
    
    if form_response.status_code == 302:
        location = form_response.headers.get('Location', '')
        print_info(f"Redirect Location: {location}")
        
        if '/auth/verify' in location:
            print_success("Successfully redirected to verify page!")
            return True
        elif 'csrf=true' in location:
            print_error("CSRF error - token mismatch or invalid")
            return False
        else:
            print_error(f"Unexpected redirect: {location}")
            return False
    
    print_info(f"Response Text: {form_response.text[:500]}...")
    return False

def test_direct_verify_page():
    """Test if the verify page exists and is accessible"""
    print_test_header("Test Verify Page")
    
    try:
        verify_url = f"{BASE_URL}/auth/verify"
        print_info(f"Testing: GET {verify_url}")
        
        response = requests.get(verify_url, timeout=10)
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print_success("Verify page is accessible")
            if 'email' in response.text.lower() or 'verify' in response.text.lower():
                print_success("Verify page contains expected content")
                return True
            else:
                print_info("Verify page content may not contain expected keywords")
                return True
        else:
            print_error(f"Verify page not accessible: {response.status_code}")
            return False
            
    except Exception as e:
        print_error(f"Exception testing verify page: {str(e)}")
        return False

def test_nextauth_callback():
    """Test NextAuth callback endpoint"""
    print_test_header("Test NextAuth Callback")
    
    try:
        callback_url = f"{API_BASE}/auth/callback/email"
        print_info(f"Testing: GET {callback_url}")
        
        response = requests.get(callback_url, timeout=10, allow_redirects=False)
        print_info(f"Status Code: {response.status_code}")
        print_info(f"Headers: {dict(response.headers)}")
        
        if response.status_code in [302, 400, 401]:
            print_success("Callback endpoint exists and responds appropriately")
            return True
        else:
            print_info(f"Callback response: {response.text[:200]}...")
            return True
            
    except Exception as e:
        print_error(f"Exception testing callback: {str(e)}")
        return False

def main():
    """Run debug tests"""
    print("🔍 Email Magic Link Debug Tests")
    print(f"📍 Base URL: {BASE_URL}")
    print(f"⏰ Test started at: {datetime.now().isoformat()}")
    
    results = []
    
    # Debug email signin flow
    results.append(("Email Signin Debug", debug_email_signin()))
    
    # Test verify page
    results.append(("Verify Page Test", test_direct_verify_page()))
    
    # Test callback endpoint
    results.append(("Callback Endpoint Test", test_nextauth_callback()))
    
    # Summary
    print_test_header("DEBUG SUMMARY")
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        if result:
            print_success(f"{test_name}")
        else:
            print_error(f"{test_name}")
    
    print(f"\n📊 Results: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)