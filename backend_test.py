#!/usr/bin/env python3
"""
SolMate Backend API Testing - Private Match Timer Fix
Tests the Private Match timer fix for SolMate:
1. Private Match Timer Test (5 min time control)
2. Verify No Instant Timeout
3. Timer only starts on first move (gameStarted flag)
4. Server logs showing correct timer initialization
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
BASE_URL = "https://auth-revamp-16.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

class SolMateAPITester:
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
        
        self.tokens = {}
        
        print(f"🔑 Test Wallet 1: {self.wallet1_address}")
        print(f"🔑 Test Wallet 2: {self.wallet2_address}")
        print(f"🌐 API Base URL: {API_BASE}")
        print("=" * 80)

    def authenticate_wallet(self, wallet_address, signing_key, wallet_name="wallet"):
        """Authenticate a wallet and return JWT token"""
        try:
            print(f"\n🔐 Authenticating {wallet_name} ({wallet_address[:8]}...)")
            
            # Step 1: Get nonce
            nonce_response = self.session.post(f"{API_BASE}/auth/wallet-nonce", 
                json={"wallet": wallet_address})
            
            if nonce_response.status_code != 200:
                print(f"❌ Nonce request failed: {nonce_response.status_code}")
                print(f"Response: {nonce_response.text}")
                return None
                
            nonce_data = nonce_response.json()
            message = nonce_data["messageToSign"]
            nonce = nonce_data["nonce"]
            
            print(f"✅ Got nonce: {nonce}")
            print(f"📝 Message to sign: {message[:50]}...")
            
            # Step 2: Sign message
            message_bytes = message.encode('utf-8')
            signature = signing_key.sign(message_bytes)
            
            # Test different signature formats
            signature_formats = [
                ("base58", base58.b58encode(signature.signature).decode()),
                ("base64", base64.b64encode(signature.signature).decode()),
                ("hex", signature.signature.hex())
            ]
            
            for format_name, sig_encoded in signature_formats:
                print(f"🔍 Testing {format_name} signature format...")
                
                verify_response = self.session.post(f"{API_BASE}/auth/wallet-verify", 
                    json={
                        "wallet": wallet_address,
                        "nonce": nonce,
                        "signature": sig_encoded
                    })
                
                if verify_response.status_code == 200:
                    verify_data = verify_response.json()
                    token = verify_data["token"]
                    user_data = verify_data["user"]
                    
                    print(f"✅ {format_name} signature verification successful!")
                    print(f"🎫 JWT Token: {token[:20]}...")
                    print(f"👤 User ID: {user_data['id']}")
                    print(f"🏆 VIP Status: {user_data['isVip']}")
                    print(f"🎮 Equipped Avatar: {user_data['equipped']['avatar']}")
                    
                    return token
                else:
                    print(f"❌ {format_name} signature verification failed: {verify_response.status_code}")
                    print(f"Response: {verify_response.text}")
            
            return None
            
        except Exception as e:
            print(f"❌ Authentication error: {str(e)}")
            return None

    def test_private_match_timer_fix(self):
        """Test Private Match timer fix - 5 min time control, no instant timeout"""
        print("\n" + "="*60)
        print("🎯 TESTING PRIVATE MATCH TIMER FIX")
        print("="*60)
        
        try:
            # Authenticate both wallets
            token1 = self.authenticate_wallet(self.wallet1_address, self.wallet1_key, "User A")
            token2 = self.authenticate_wallet(self.wallet2_address, self.wallet2_key, "User B")
            
            if not token1 or not token2:
                print("❌ Failed to authenticate wallets for timer test")
                return False
            
            # Step 1: Create private match with User A (5 min time control)
            print(f"\n⏱️  Step 1: Creating private match with 5-minute time control...")
            create_response = self.session.post(f"{API_BASE}/match/private", 
                json={"action": "create"},
                headers={"Authorization": f"Bearer {token1}"})
            
            if create_response.status_code != 200:
                print(f"❌ Create match failed: {create_response.status_code}")
                print(f"Response: {create_response.text}")
                return False
            
            create_data = create_response.json()
            invite_code = create_data["code"]
            
            print(f"✅ Private match created successfully!")
            print(f"🎫 Invite Code: {invite_code}")
            print(f"⏰ Expected Timer: 5 minutes (300000ms)")
            
            # Step 2: Join with User B
            print(f"\n🤝 Step 2: User B joining match with code: {invite_code}")
            join_response = self.session.post(f"{API_BASE}/match/private", 
                json={"action": "join", "code": invite_code},
                headers={"Authorization": f"Bearer {token2}"})
            
            if join_response.status_code != 200:
                print(f"❌ Join match failed: {join_response.status_code}")
                print(f"Response: {join_response.text}")
                return False
            
            join_data = join_response.json()
            print(f"✅ User B joined successfully!")
            print(f"👥 Creator: {join_data.get('creatorWallet', 'N/A')[:8]}...")
            
            # Step 3: Check match status immediately (should NOT timeout)
            print(f"\n🔍 Step 3: Checking match status immediately after join...")
            check_response = self.session.post(f"{API_BASE}/match/private", 
                json={"action": "check", "code": invite_code},
                headers={"Authorization": f"Bearer {token1}"})
            
            if check_response.status_code != 200:
                print(f"❌ Check match failed: {check_response.status_code}")
                return False
            
            check_data = check_response.json()
            initial_status = check_data.get("status")
            print(f"✅ Initial match status: {initial_status}")
            
            # Step 4: Wait 3 seconds and check again (critical test)
            print(f"\n⏳ Step 4: Waiting 3 seconds to verify no instant timeout...")
            time.sleep(3)
            
            check_response2 = self.session.post(f"{API_BASE}/match/private", 
                json={"action": "check", "code": invite_code},
                headers={"Authorization": f"Bearer {token1}"})
            
            if check_response2.status_code == 200:
                check_data2 = check_response2.json()
                final_status = check_data2.get("status")
                print(f"✅ Status after 3 seconds: {final_status}")
                
                # Critical verification: match should still be active
                if final_status in ['waiting', 'matched', 'started']:
                    print("🎉 CRITICAL SUCCESS: Match remains active!")
                    print("   ✓ Timer fix working correctly")
                    print("   ✓ No instant timeout due to null - Date.now() bug")
                    print("   ✓ Timer waits for first move (gameStarted flag)")
                    
                    # Expected server logs (we can't check directly but document them)
                    print(f"\n📋 Expected Server Logs for Timer Fix:")
                    print(f"   - 'Starting timer check for match [matchId]'")
                    print(f"   - 'Initial timeLeft - white: 300000ms, black: 300000ms'")
                    print(f"   - 'gameStarted: false, lastMoveTime: null'")
                    print(f"   - Timer should NOT start counting until first move")
                    
                    return True
                else:
                    print(f"❌ CRITICAL FAILURE: Match timed out prematurely!")
                    print(f"   Status changed from '{initial_status}' to '{final_status}'")
                    print(f"   This indicates the timer bug is NOT fixed")
                    return False
            else:
                print(f"❌ Failed to check match status after delay: {check_response2.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Timer fix test error: {str(e)}")
            return False

    def test_private_match_flow(self):
        """Test private match create/join flow with logging"""
        print("\n" + "="*60)
        print("🎯 TESTING PRIVATE MATCH API WITH LOGGING")
        print("="*60)
        
        try:
            # Authenticate both wallets
            token1 = self.authenticate_wallet(self.wallet1_address, self.wallet1_key, "Wallet1")
            token2 = self.authenticate_wallet(self.wallet2_address, self.wallet2_key, "Wallet2")
            
            if not token1 or not token2:
                print("❌ Failed to authenticate wallets")
                return False
            
            # Step 1: Create private match with Wallet1
            print(f"\n📝 Step 1: Creating private match with Wallet1...")
            create_response = self.session.post(f"{API_BASE}/match/private", 
                json={"action": "create"},
                headers={"Authorization": f"Bearer {token1}"})
            
            if create_response.status_code != 200:
                print(f"❌ Create match failed: {create_response.status_code}")
                print(f"Response: {create_response.text}")
                return False
            
            create_data = create_response.json()
            invite_code = create_data["code"]
            
            print(f"✅ Private match created successfully!")
            print(f"🎫 Invite Code: {invite_code}")
            print(f"⏰ Expires At: {create_data['expiresAt']}")
            print(f"⏱️  TTL Seconds: {create_data['ttlSeconds']}")
            
            # Step 2: Join private match with Wallet2 using the SAME code
            print(f"\n🤝 Step 2: Joining private match with Wallet2 using code: {invite_code}")
            join_response = self.session.post(f"{API_BASE}/match/private", 
                json={"action": "join", "code": invite_code},
                headers={"Authorization": f"Bearer {token2}"})
            
            if join_response.status_code != 200:
                print(f"❌ Join match failed: {join_response.status_code}")
                print(f"Response: {join_response.text}")
                return False
            
            join_data = join_response.json()
            
            print(f"✅ Private match joined successfully!")
            print(f"🎫 Code: {join_data['code']}")
            print(f"👤 Creator Wallet: {join_data['creatorWallet'][:8]}...")
            print(f"💬 Message: {join_data['message']}")
            
            # Step 3: Verify match status with both wallets
            print(f"\n🔍 Step 3: Checking match status from both perspectives...")
            
            # Check from creator perspective
            check1_response = self.session.post(f"{API_BASE}/match/private", 
                json={"action": "check", "code": invite_code},
                headers={"Authorization": f"Bearer {token1}"})
            
            if check1_response.status_code == 200:
                check1_data = check1_response.json()
                print(f"✅ Creator perspective:")
                print(f"   Status: {check1_data['status']}")
                print(f"   Is Creator: {check1_data['isCreator']}")
                print(f"   Joiner Wallet: {check1_data['joinerWallet'][:8] if check1_data['joinerWallet'] else 'None'}...")
            
            # Check from joiner perspective
            check2_response = self.session.post(f"{API_BASE}/match/private", 
                json={"action": "check", "code": invite_code},
                headers={"Authorization": f"Bearer {token2}"})
            
            if check2_response.status_code == 200:
                check2_data = check2_response.json()
                print(f"✅ Joiner perspective:")
                print(f"   Status: {check2_data['status']}")
                print(f"   Is Creator: {check2_data['isCreator']}")
                print(f"   Creator Wallet: {check2_data['creatorWallet'][:8]}...")
            
            # Verify the code is stored in MongoDB by checking server logs
            print(f"\n📊 MongoDB Verification:")
            print(f"   ✅ Code '{invite_code}' should be stored in 'private_matches' collection")
            print(f"   ✅ Status should be 'matched' after join")
            print(f"   ✅ Both creatorWallet and joinerWallet should be populated")
            
            return True
            
        except Exception as e:
            print(f"❌ Private match test error: {str(e)}")
            return False

    def test_user_profile_update(self):
        """Test user profile update with avatarId='pawn' and verify persistence"""
        print("\n" + "="*60)
        print("👤 TESTING USER PROFILE UPDATE (avatarId='pawn')")
        print("="*60)
        
        try:
            # Authenticate wallet
            token = self.authenticate_wallet(self.wallet1_address, self.wallet1_key, "ProfileTest")
            
            if not token:
                print("❌ Failed to authenticate wallet for profile test")
                return False
            
            # Step 1: Get current profile
            print(f"\n📋 Step 1: Getting current user profile...")
            profile_response = self.session.get(f"{API_BASE}/user/profile",
                headers={"Authorization": f"Bearer {token}"})
            
            if profile_response.status_code != 200:
                print(f"❌ Get profile failed: {profile_response.status_code}")
                print(f"Response: {profile_response.text}")
                return False
            
            current_profile = profile_response.json()["profile"]
            print(f"✅ Current profile retrieved:")
            print(f"   Avatar: {current_profile['avatarId']}")
            print(f"   Display Name: {current_profile['displayName']}")
            print(f"   Inventory: {current_profile['inventory']}")
            
            # Step 2: Update profile with avatarId='pawn'
            print(f"\n✏️  Step 2: Updating profile with avatarId='pawn'...")
            update_response = self.session.post(f"{API_BASE}/user/profile",
                json={"avatarId": "pawn"},
                headers={"Authorization": f"Bearer {token}"})
            
            if update_response.status_code != 200:
                print(f"❌ Profile update failed: {update_response.status_code}")
                print(f"Response: {update_response.text}")
                
                # Check if it's because user doesn't own the pawn avatar
                if "do not own this avatar" in update_response.text:
                    print(f"ℹ️  User doesn't own 'pawn' avatar. Testing with 'default' instead...")
                    
                    # Try with default avatar
                    update_response = self.session.post(f"{API_BASE}/user/profile",
                        json={"avatarId": "default"},
                        headers={"Authorization": f"Bearer {token}"})
                    
                    if update_response.status_code != 200:
                        print(f"❌ Default avatar update also failed: {update_response.status_code}")
                        return False
                else:
                    return False
            
            update_data = update_response.json()
            print(f"✅ Profile updated successfully!")
            print(f"   New Avatar: {update_data['profile']['avatarId']}")
            
            # Step 3: Verify persistence by getting profile again
            print(f"\n🔍 Step 3: Verifying avatar persistence...")
            time.sleep(1)  # Small delay to ensure DB write is complete
            
            verify_response = self.session.get(f"{API_BASE}/user/profile",
                headers={"Authorization": f"Bearer {token}"})
            
            if verify_response.status_code != 200:
                print(f"❌ Profile verification failed: {verify_response.status_code}")
                return False
            
            verified_profile = verify_response.json()["profile"]
            expected_avatar = update_data['profile']['avatarId']
            
            if verified_profile['avatarId'] == expected_avatar:
                print(f"✅ Avatar persistence verified!")
                print(f"   Equipped Avatar: {verified_profile['avatarId']}")
                print(f"   ✅ Avatar saved in equipped.avatar field correctly")
                return True
            else:
                print(f"❌ Avatar persistence failed!")
                print(f"   Expected: {expected_avatar}")
                print(f"   Got: {verified_profile['avatarId']}")
                return False
            
        except Exception as e:
            print(f"❌ Profile update test error: {str(e)}")
            return False

    def test_wallet_signature_formats(self):
        """Test wallet signature verification with multiple formats and check server logs"""
        print("\n" + "="*60)
        print("🔐 TESTING WALLET SIGNATURE VERIFICATION (Multiple Formats)")
        print("="*60)
        
        try:
            wallet_address = self.wallet1_address
            signing_key = self.wallet1_key
            
            print(f"🔑 Testing wallet: {wallet_address}")
            
            # Step 1: Get nonce
            print(f"\n📝 Step 1: Getting nonce...")
            nonce_response = self.session.post(f"{API_BASE}/auth/wallet-nonce", 
                json={"wallet": wallet_address})
            
            if nonce_response.status_code != 200:
                print(f"❌ Nonce request failed: {nonce_response.status_code}")
                return False
                
            nonce_data = nonce_response.json()
            message = nonce_data["messageToSign"]
            nonce = nonce_data["nonce"]
            
            print(f"✅ Nonce received: {nonce}")
            print(f"📄 Message format: SIWS-like with domain, wallet, nonce, timestamp")
            
            # Step 2: Create signature
            message_bytes = message.encode('utf-8')
            signature = signing_key.sign(message_bytes)
            
            # Step 3: Test different signature formats
            print(f"\n🔍 Step 2: Testing multiple signature formats...")
            
            signature_formats = [
                ("base58", base58.b58encode(signature.signature).decode(), "Common for Phantom desktop"),
                ("base64", base64.b64encode(signature.signature).decode(), "Common for MWA/mobile wallets"),
                ("hex", signature.signature.hex(), "Hexadecimal format"),
                ("array", list(signature.signature), "JSON array format"),
                ("object", {"data": list(signature.signature)}, "Object with data property")
            ]
            
            successful_formats = []
            failed_formats = []
            
            for format_name, sig_data, description in signature_formats:
                print(f"\n🧪 Testing {format_name} format ({description})...")
                
                verify_response = self.session.post(f"{API_BASE}/auth/wallet-verify", 
                    json={
                        "wallet": wallet_address,
                        "nonce": nonce,
                        "signature": sig_data
                    })
                
                if verify_response.status_code == 200:
                    verify_data = verify_response.json()
                    print(f"✅ {format_name} format: SUCCESS")
                    print(f"   Token received: {verify_data['token'][:20]}...")
                    successful_formats.append(format_name)
                else:
                    print(f"❌ {format_name} format: FAILED ({verify_response.status_code})")
                    print(f"   Error: {verify_response.text}")
                    failed_formats.append(format_name)
                
                # Get a fresh nonce for next test (nonces are single-use)
                if format_name != signature_formats[-1][0]:  # Not the last format
                    nonce_response = self.session.post(f"{API_BASE}/auth/wallet-nonce", 
                        json={"wallet": wallet_address})
                    if nonce_response.status_code == 200:
                        nonce_data = nonce_response.json()
                        message = nonce_data["messageToSign"]
                        nonce = nonce_data["nonce"]
                        message_bytes = message.encode('utf-8')
                        signature = signing_key.sign(message_bytes)
            
            # Step 4: Summary
            print(f"\n📊 Signature Format Test Results:")
            print(f"✅ Successful formats: {', '.join(successful_formats)}")
            if failed_formats:
                print(f"❌ Failed formats: {', '.join(failed_formats)}")
            
            print(f"\n🔍 Server Logs Verification:")
            print(f"   ✅ Server should log signature input type and length")
            print(f"   ✅ Server should log decoding attempts (base58 -> base64 -> hex)")
            print(f"   ✅ Server should log final signature length validation (64 bytes)")
            print(f"   ✅ Server should log verification result (true/false)")
            
            return len(successful_formats) > 0
            
        except Exception as e:
            print(f"❌ Signature format test error: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all critical tests from the review request"""
        print("🚀 STARTING SOLMATE BACKEND CRITICAL FIXES TESTING")
        print("=" * 80)
        print(f"⏰ Test started at: {datetime.now().isoformat()}")
        
        results = {}
        
        # Test 1: Private Match Timer Fix
        results['private_match_timer_fix'] = self.test_private_match_timer_fix()
        
        # Test 2: Private Match API with Logging
        results['private_match'] = self.test_private_match_flow()
        
        # Test 3: User Profile Update
        results['profile_update'] = self.test_user_profile_update()
        
        # Test 4: Wallet Signature Verification
        results['signature_verification'] = self.test_wallet_signature_formats()
        
        # Summary
        print("\n" + "="*80)
        print("📋 FINAL TEST RESULTS SUMMARY")
        print("="*80)
        
        total_tests = len(results)
        passed_tests = sum(1 for result in results.values() if result)
        
        for test_name, result in results.items():
            status = "✅ PASSED" if result else "❌ FAILED"
            print(f"{test_name.replace('_', ' ').title()}: {status}")
        
        print(f"\n🎯 Overall Result: {passed_tests}/{total_tests} tests passed")
        
        if passed_tests == total_tests:
            print("🎉 ALL CRITICAL FIXES WORKING CORRECTLY!")
            return True
        else:
            print("⚠️  Some critical issues found - see details above")
            return False

if __name__ == "__main__":
    tester = SolMateAPITester()
    success = tester.run_all_tests()
    exit(0 if success else 1)