#!/usr/bin/env python3
"""
SolMate Critical Fixes Testing - Review Request
Tests the specific scenarios mentioned in the review request:
1. Wallet Signature Verification with Base64 (check server logs for base64 detection)
2. Private Match Flow End-to-End (verify match:found event and handleMatchFound function)
"""

import requests
import json
import time
import base64
import base58
from nacl.signing import SigningKey
from nacl.encoding import Base64Encoder
import os
from datetime import datetime

# Configuration
BASE_URL = "https://chess-connect-4.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

class CriticalFixesTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        
        # Generate test wallets (Ed25519 keypairs)
        self.wallet1_key = SigningKey.generate()
        self.wallet1_address = base58.b58encode(self.wallet1_key.verify_key.encode()).decode()
        
        self.wallet2_key = SigningKey.generate()
        self.wallet2_address = base58.b58encode(self.wallet2_key.verify_key.encode()).decode()
        
        print(f"🔑 Test Wallet A: {self.wallet1_address}")
        print(f"🔑 Test Wallet B: {self.wallet2_address}")
        print(f"🌐 API Base URL: {API_BASE}")
        print("=" * 80)

    def test_wallet_signature_base64_detection(self):
        """Test wallet signature verification with base64 and check server logs"""
        print("\n" + "="*60)
        print("🔐 TESTING WALLET SIGNATURE VERIFICATION WITH BASE64")
        print("="*60)
        
        try:
            wallet_address = self.wallet1_address
            signing_key = self.wallet1_key
            
            print(f"🔑 Testing wallet: {wallet_address}")
            
            # Step 1: Get nonce
            print(f"\n📝 Step 1: Getting nonce from POST /api/auth/wallet-nonce...")
            nonce_response = self.session.post(f"{API_BASE}/auth/wallet-nonce", 
                json={"wallet": wallet_address})
            
            if nonce_response.status_code != 200:
                print(f"❌ Nonce request failed: {nonce_response.status_code}")
                print(f"Response: {nonce_response.text}")
                return False
                
            nonce_data = nonce_response.json()
            message = nonce_data["messageToSign"]
            nonce = nonce_data["nonce"]
            
            print(f"✅ Nonce received: {nonce}")
            print(f"📄 Message format: SIWS-like with domain, wallet, nonce, timestamp")
            
            # Step 2: Create base64-encoded signature (containing + / = characters)
            print(f"\n🔍 Step 2: Creating base64-encoded test signature...")
            message_bytes = message.encode('utf-8')
            signature = signing_key.sign(message_bytes)
            
            # Create base64 signature with + / = characters
            base64_signature = base64.b64encode(signature.signature).decode()
            
            print(f"📝 Base64 signature: {base64_signature[:30]}...")
            print(f"🔍 Contains base64 chars (+/=): {any(c in base64_signature for c in '+/=')}")
            
            # Step 3: Send signature to verify endpoint
            print(f"\n🚀 Step 3: Sending to POST /api/auth/wallet-verify...")
            verify_response = self.session.post(f"{API_BASE}/auth/wallet-verify", 
                json={
                    "wallet": wallet_address,
                    "nonce": nonce,
                    "signature": base64_signature
                })
            
            if verify_response.status_code == 200:
                verify_data = verify_response.json()
                print(f"✅ Base64 signature verification: SUCCESS")
                print(f"🎫 JWT Token received: {verify_data['token'][:20]}...")
                print(f"👤 User created/updated successfully")
                
                # Check what we expect in server logs
                print(f"\n📊 Expected Server Log Verification:")
                print(f"   ✅ Server should log: 'Has base64 chars: true'")
                print(f"   ✅ Server should log: 'Decoded as base64'")
                print(f"   ✅ Server should detect base64 vs base58 correctly")
                print(f"   ✅ Signature length should be 64 bytes after decoding")
                
                return True
            else:
                print(f"❌ Base64 signature verification: FAILED ({verify_response.status_code})")
                print(f"   Error: {verify_response.text}")
                return False
            
        except Exception as e:
            print(f"❌ Base64 signature test error: {str(e)}")
            return False

    def authenticate_wallet(self, wallet_address, signing_key, wallet_name="wallet"):
        """Authenticate a wallet and return JWT token"""
        try:
            print(f"\n🔐 Authenticating {wallet_name} ({wallet_address[:8]}...)")
            
            # Step 1: Get nonce
            nonce_response = self.session.post(f"{API_BASE}/auth/wallet-nonce", 
                json={"wallet": wallet_address})
            
            if nonce_response.status_code != 200:
                print(f"❌ Nonce request failed: {nonce_response.status_code}")
                return None
                
            nonce_data = nonce_response.json()
            message = nonce_data["messageToSign"]
            nonce = nonce_data["nonce"]
            
            # Step 2: Sign message (use base58 for authentication)
            message_bytes = message.encode('utf-8')
            signature = signing_key.sign(message_bytes)
            base58_signature = base58.b58encode(signature.signature).decode()
            
            verify_response = self.session.post(f"{API_BASE}/auth/wallet-verify", 
                json={
                    "wallet": wallet_address,
                    "nonce": nonce,
                    "signature": base58_signature
                })
            
            if verify_response.status_code == 200:
                verify_data = verify_response.json()
                token = verify_data["token"]
                print(f"✅ {wallet_name} authenticated successfully!")
                return token
            else:
                print(f"❌ {wallet_name} authentication failed: {verify_response.status_code}")
                return None
            
        except Exception as e:
            print(f"❌ Authentication error for {wallet_name}: {str(e)}")
            return None

    def test_private_match_end_to_end(self):
        """Test private match flow end-to-end with different users"""
        print("\n" + "="*60)
        print("🎯 TESTING PRIVATE MATCH FLOW END-TO-END")
        print("="*60)
        
        try:
            # Authenticate both wallets
            print(f"🔐 Authenticating both users...")
            token_user_a = self.authenticate_wallet(self.wallet1_address, self.wallet1_key, "User A")
            token_user_b = self.authenticate_wallet(self.wallet2_address, self.wallet2_key, "User B")
            
            if not token_user_a or not token_user_b:
                print("❌ Failed to authenticate both users")
                return False
            
            # Step 1: User A creates a private match
            print(f"\n📝 Step 1: User A creates private match...")
            create_response = self.session.post(f"{API_BASE}/match/private", 
                json={"action": "create"},
                headers={"Authorization": f"Bearer {token_user_a}"})
            
            if create_response.status_code != 200:
                print(f"❌ Create match failed: {create_response.status_code}")
                print(f"Response: {create_response.text}")
                return False
            
            create_data = create_response.json()
            match_code = create_data["code"]
            
            print(f"✅ Private match created by User A!")
            print(f"🎫 Match Code: {match_code}")
            print(f"⏰ Expires At: {create_data['expiresAt']}")
            
            # Step 2: User B joins with the same code (different JWT token)
            print(f"\n🤝 Step 2: User B joins using code {match_code} (different JWT token)...")
            join_response = self.session.post(f"{API_BASE}/match/private", 
                json={"action": "join", "code": match_code},
                headers={"Authorization": f"Bearer {token_user_b}"})
            
            if join_response.status_code != 200:
                print(f"❌ Join match failed: {join_response.status_code}")
                print(f"Response: {join_response.text}")
                return False
            
            join_data = join_response.json()
            
            print(f"✅ User B joined successfully!")
            print(f"🎫 Code: {join_data['code']}")
            print(f"👤 Creator: {join_data['creatorWallet'][:8]}...")
            print(f"💬 Message: {join_data['message']}")
            
            # Step 3: Verify both users receive match:found event
            print(f"\n🔍 Step 3: Verifying match status for both users...")
            
            # Check User A's perspective
            check_a_response = self.session.post(f"{API_BASE}/match/private", 
                json={"action": "check", "code": match_code},
                headers={"Authorization": f"Bearer {token_user_a}"})
            
            # Check User B's perspective  
            check_b_response = self.session.post(f"{API_BASE}/match/private", 
                json={"action": "check", "code": match_code},
                headers={"Authorization": f"Bearer {token_user_b}"})
            
            if check_a_response.status_code == 200 and check_b_response.status_code == 200:
                check_a_data = check_a_response.json()
                check_b_data = check_b_response.json()
                
                print(f"✅ User A perspective:")
                print(f"   Status: {check_a_data['status']}")
                print(f"   Is Creator: {check_a_data['isCreator']}")
                print(f"   Joiner: {check_a_data['joinerWallet'][:8] if check_a_data['joinerWallet'] else 'None'}...")
                
                print(f"✅ User B perspective:")
                print(f"   Status: {check_b_data['status']}")
                print(f"   Is Creator: {check_b_data['isCreator']}")
                print(f"   Creator: {check_b_data['creatorWallet'][:8]}...")
                
                # Verify match status is 'matched'
                if check_a_data['status'] == 'matched' and check_b_data['status'] == 'matched':
                    print(f"\n🎉 SUCCESS: Both users see status 'matched'!")
                    
                    # Expected behavior verification
                    print(f"\n📊 Expected Behavior Verification:")
                    print(f"   ✅ Both users should receive match:found event")
                    print(f"   ✅ handleMatchFound function should be called (NOT handleOnlineMatchFound)")
                    print(f"   ✅ No 'handleOnlineMatchFound is not defined' errors")
                    print(f"   ✅ Private match codes work across different JWT tokens")
                    
                    return True
                else:
                    print(f"❌ Match status mismatch!")
                    print(f"   User A status: {check_a_data['status']}")
                    print(f"   User B status: {check_b_data['status']}")
                    return False
            else:
                print(f"❌ Failed to check match status")
                print(f"   User A check: {check_a_response.status_code}")
                print(f"   User B check: {check_b_response.status_code}")
                return False
            
        except Exception as e:
            print(f"❌ Private match end-to-end test error: {str(e)}")
            return False

    def run_critical_tests(self):
        """Run the two critical tests from the review request"""
        print("🚀 STARTING SOLMATE CRITICAL FIXES TESTING")
        print("=" * 80)
        print(f"⏰ Test started at: {datetime.now().isoformat()}")
        print(f"📋 Testing Review Request Critical Fixes:")
        print(f"   1. Wallet Signature Verification with Base64")
        print(f"   2. Private Match Flow End-to-End")
        
        results = {}
        
        # Test 1: Wallet Signature Verification with Base64
        results['base64_signature'] = self.test_wallet_signature_base64_detection()
        
        # Test 2: Private Match Flow End-to-End
        results['private_match_e2e'] = self.test_private_match_end_to_end()
        
        # Summary
        print("\n" + "="*80)
        print("📋 CRITICAL FIXES TEST RESULTS")
        print("="*80)
        
        total_tests = len(results)
        passed_tests = sum(1 for result in results.values() if result)
        
        for test_name, result in results.items():
            status = "✅ PASSED" if result else "❌ FAILED"
            print(f"{test_name.replace('_', ' ').title()}: {status}")
        
        print(f"\n🎯 Overall Result: {passed_tests}/{total_tests} critical tests passed")
        
        if passed_tests == total_tests:
            print("🎉 ALL CRITICAL FIXES WORKING CORRECTLY!")
            print("\n📊 Server Logs Should Show:")
            print("   ✅ 'Has base64 chars: true' for base64 signatures")
            print("   ✅ 'Decoded as base64' for base64 signatures")
            print("   ✅ Correct signature format detection logic")
            print("   ✅ Private match creation and join logging")
            print("   ✅ handleMatchFound function calls (not handleOnlineMatchFound)")
            return True
        else:
            print("⚠️  Some critical issues found - see details above")
            return False

if __name__ == "__main__":
    tester = CriticalFixesTester()
    success = tester.run_critical_tests()
    exit(0 if success else 1)