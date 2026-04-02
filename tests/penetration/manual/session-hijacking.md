# Session Hijacking Testing Procedures

## Overview
This document outlines manual testing procedures for identifying session hijacking vulnerabilities in the Secure CAPTCHA Plugin.

## Test Environment Setup
- Target URL: http://localhost:3000
- Tools: Browser, Burp Suite, curl, Wireshark
- Valid API Key: test-api-key (for testing)

---

## Test Case 1: Session Token Prediction

### Objective
Test if session tokens can be predicted or guessed.

### Steps
1. **Generate Multiple Sessions**
   ```bash
   # Generate 10 sessions
   for i in {1..10}; do
     curl -s -X POST http://localhost:3000/api/v1/captcha/generate \
       -H "Content-Type: application/json" \
       -d '{"type": "text", "difficulty": "easy"}' | jq -r '.data.sessionId'
   done
   ```
   - **Expected**: Session IDs should be random UUIDs

2. **Analyze Session ID Pattern**
   - Collect 100+ session IDs
   - Analyze for patterns using tools like Burp Sequencer
   - **Expected**: Should have high entropy (>128 bits)

3. **Test Sequential Session IDs**
   - Try session IDs that are sequential or nearby
   - **Expected**: Should not be predictable

4. **Test Time-Based Session IDs**
   - Generate sessions at known times
   - Try to predict based on timestamp
   - **Expected**: Should not be time-based

### Pass Criteria
- Session IDs are cryptographically random
- High entropy (>128 bits)
- No predictable patterns
- UUID v4 format

---

## Test Case 2: Session Token Exposure

### Objective
Test if session tokens are exposed in insecure ways.

### Steps
1. **Test URL Exposure**
   - Check if session ID appears in URL
   ```bash
   curl -v -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -d '{"type": "text", "difficulty": "easy"}'
   ```
   - **Expected**: Session ID should not be in URL

2. **Test Referrer Header Leakage**
   - Check if session ID is sent in Referer header
   - **Expected**: Session ID should not be in Referer

3. **Test Log Exposure**
   - Check server logs for session ID exposure
   - **Expected**: Session IDs should be masked in logs

4. **Test Error Message Exposure**
   - Trigger errors and check for session ID
   - **Expected**: Session IDs should not be in error messages

5. **Test Response Headers**
   ```bash
   curl -I http://localhost:3000/api/v1/health
   ```
   - **Expected**: Session ID should only be in Set-Cookie

### Pass Criteria
- Session IDs are not exposed in URLs
- Session IDs are not in logs
- Session IDs are not in error messages
- Session IDs are properly transmitted

---

## Test Case 3: Session Fixation

### Objective
Test if session fixation attacks are possible.

### Steps
1. **Test Pre-Session Setting**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -H "Cookie: session=attacker-controlled-id" \
     -d '{"type": "text", "difficulty": "easy"}'
   ```
   - **Expected**: Server should generate new session ID

2. **Test Session ID Reuse After Authentication**
   - Get session ID before authentication
   - Authenticate
   - Check if session ID changes
   - **Expected**: Session ID should change after authentication

3. **Test Session Regeneration**
   - Generate captcha
   - Validate captcha
   - Check if session is regenerated
   - **Expected**: Session should be invalidated after validation

### Pass Criteria
- Server generates new session IDs
- Pre-defined session IDs are rejected
- Session ID changes after authentication
- Sessions are invalidated after use

---

## Test Case 4: Session Timeout and Expiration

### Objective
Test if session timeouts are properly enforced.

### Steps
1. **Test Session Timeout**
   ```bash
   # Generate session
   SESSION_ID=$(curl -s -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -d '{"type": "text", "difficulty": "easy"}' | jq -r '.data.sessionId')
   
   # Wait for timeout period
   sleep 3600  # 1 hour
   
   # Try to use expired session
   curl -X POST http://localhost:3000/api/v1/captcha/validate \
     -H "Content-Type: application/json" \
     -d "{\"sessionId\": \"${SESSION_ID}\", \"response\": \"test\", \"type\": \"text\"}"
   ```
   - **Expected**: 410 Gone (session expired)

2. **Test Session Expiration After Validation**
   - Generate captcha
   - Validate captcha successfully
   - Try to validate again with same session
   - **Expected**: 410 Gone (session used)

3. **Test Max Attempts Exceeded**
   - Generate captcha
   - Submit wrong responses multiple times
   - **Expected**: Session should be invalidated after max attempts

### Pass Criteria
- Sessions expire after configured timeout
- Sessions are invalidated after successful validation
- Sessions are invalidated after max failed attempts

---

## Test Case 5: Concurrent Session Management

### Objective
Test if concurrent sessions are properly managed.

### Steps
1. **Test Multiple Sessions Per User**
   - Create multiple sessions for same user
   - Verify all sessions work independently
   - **Expected**: Should be configurable

2. **Test Session Limit**
   - Create maximum allowed sessions
   - Try to create additional session
   - **Expected**: Should enforce session limit

3. **Test Session Invalidation on Logout**
   - Create multiple sessions
   - Invalidate one session
   - Verify other sessions are still valid
   - **Expected**: Should only invalidate targeted session

### Pass Criteria
- Concurrent sessions are managed
- Session limits are enforced
- Session invalidation works properly

---

## Test Case 6: Session Storage Security

### Objective
Test if session storage is secure.

### Steps
1. **Test Session Data Encryption**
   - Check if session data is encrypted at rest
   - **Expected**: Sensitive data should be encrypted

2. **Test Session Data in Memory**
   - Check if session data is properly cleared
   - **Expected**: Session data should be cleared after use

3. **Test Session Data in Cookies**
   ```bash
   curl -v -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -d '{"type": "text", "difficulty": "easy"}'
   ```
   - Check cookie attributes:
     - HttpOnly: Should be set
     - Secure: Should be set (for HTTPS)
     - SameSite: Should be Strict or Lax
     - Path: Should be restricted
   - **Expected**: All security attributes should be set

### Pass Criteria
- Session data is encrypted at rest
- Session data is cleared after use
- Cookies have proper security attributes

---

## Test Case 7: Cross-Site Session Attacks

### Objective
Test if cross-site session attacks are possible.

### Steps
1. **Test CSRF with Session**
   - Try to perform actions using victim's session
   - **Expected**: Should require CSRF token

2. **Test Clickjacking with Session**
   - Try to embed application in iframe
   - **Expected**: Should have X-Frame-Options header

3. **Test Session Riding**
   - Try to use victim's session from different origin
   - **Expected**: Should be blocked by CORS

### Pass Criteria
- CSRF protection is in place
- Clickjacking is prevented
- Session riding is blocked

---

## Test Case 8: Network-Level Session Protection

### Objective
Test if sessions are protected during transmission.

### Steps
1. **Test HTTPS Enforcement**
   ```bash
   curl -I http://localhost:3000/api/v1/health
   ```
   - **Expected**: Should redirect to HTTPS or require HTTPS

2. **Test HSTS Header**
   ```bash
   curl -I https://localhost:3000/api/v1/health
   ```
   - **Expected**: Should include Strict-Transport-Security header

3. **Test Session ID in Clear Text**
   - Capture traffic with Wireshark
   - Check if session ID is transmitted in clear text
   - **Expected**: Should use TLS encryption

### Pass Criteria
- HTTPS is enforced
- HSTS is configured
- Sessions are encrypted in transit

---

## Test Results Template

| Test Case | Status | Notes | Severity |
|-----------|--------|-------|----------|
| Session Token Prediction | ☐ Pass ☐ Fail | | |
| Session Token Exposure | ☐ Pass ☐ Fail | | |
| Session Fixation | ☐ Pass ☐ Fail | | |
| Session Timeout | ☐ Pass ☐ Fail | | |
| Concurrent Sessions | ☐ Pass ☐ Fail | | |
| Session Storage Security | ☐ Pass ☐ Fail | | |
| Cross-Site Session Attacks | ☐ Pass ☐ Fail | | |
| Network-Level Protection | ☐ Pass ☐ Fail | | |

## Findings

### Finding 1
- **Test Case**: 
- **Description**: 
- **Severity**: Critical/High/Medium/Low
- **Steps to Reproduce**: 
- **Impact**: 
- **Remediation**: 

---

*Document Version: 1.0*
*Last Updated: $(date)*
*Tester: ________________*