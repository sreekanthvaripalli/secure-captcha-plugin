# Authentication Bypass Testing Procedures

## Overview
This document outlines manual testing procedures for identifying authentication bypass vulnerabilities in the Secure CAPTCHA Plugin.

## Test Environment Setup
- Target URL: http://localhost:3000
- Tools: curl, Postman, Burp Suite, OWASP ZAP
- Valid API Key: test-api-key (for testing)

---

## Test Case 1: JWT Token Manipulation

### Objective
Test if JWT tokens can be manipulated to bypass authentication.

### Steps
1. **Obtain a valid JWT token**
   ```bash
   curl -X POST http://localhost:3000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username": "testuser", "password": "testpass"}'
   ```

2. **Test Algorithm Confusion (HS256 → None)**
   - Decode the JWT token using jwt.io
   - Change the algorithm in the header to "none"
   - Remove the signature
   - Send the modified token:
   ```bash
   curl -X GET http://localhost:3000/api/v1/captcha/types \
     -H "Authorization: Bearer <modified-token>"
   ```
   - **Expected**: 401 Unauthorized

3. **Test Algorithm Confusion (RS256 → HS256)**
   - If the server uses RS256, try using HS256 with the public key as the secret
   - **Expected**: 401 Unauthorized

4. **Test Token Expiration Bypass**
   - Decode the token
   - Change the `exp` claim to a future timestamp
   - Send the modified token
   - **Expected**: 401 Unauthorized (signature validation should fail)

5. **Test Invalid Signature**
   - Modify the payload
   - Keep the original signature
   - **Expected**: 401 Unauthorized

### Pass Criteria
- All modified tokens are rejected
- Server returns 401 Unauthorized for invalid tokens
- Error messages do not leak implementation details

---

## Test Case 2: API Key Bypass

### Objective
Test if API key authentication can be bypassed.

### Steps
1. **Test Missing API Key**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -d '{"type": "text", "difficulty": "easy"}'
   ```
   - **Expected**: 401 Unauthorized

2. **Test Invalid API Key**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "X-API-Key: invalid-key" \
     -H "Content-Type: application/json" \
     -d '{"type": "text", "difficulty": "easy"}'
   ```
   - **Expected**: 401 Unauthorized

3. **Test Empty API Key**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "X-API-Key: " \
     -H "Content-Type: application/json" \
     -d '{"type": "text", "difficulty": "easy"}'
   ```
   - **Expected**: 401 Unauthorized

4. **Test SQL Injection in API Key**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "X-API-Key: ' OR '1'='1" \
     -H "Content-Type: application/json" \
     -d '{"type": "text", "difficulty": "easy"}'
   ```
   - **Expected**: 401 Unauthorized

5. **Test API Key in Wrong Header**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Authorization: ApiKey test-api-key" \
     -H "Content-Type: application/json" \
     -d '{"type": "text", "difficulty": "easy"}'
   ```
   - **Expected**: 401 Unauthorized (if only X-API-Key is accepted)

6. **Test Revoked API Key**
   - Revoke a valid API key
   - Attempt to use it
   - **Expected**: 401 Unauthorized

### Pass Criteria
- All invalid/missing API keys are rejected
- No bypass through header manipulation
- Rate limiting is applied to failed attempts

---

## Test Case 3: OAuth 2.0 Flow Bypass

### Objective
Test if OAuth 2.0 authorization flow can be bypassed.

### Steps
1. **Test Invalid Authorization Code**
   ```bash
   curl -X POST http://localhost:3000/api/v1/oauth/token \
     -H "Content-Type: application/json" \
     -d '{
       "grant_type": "authorization_code",
       "code": "invalid-code",
       "redirect_uri": "https://example.com/callback",
       "client_id": "test-client",
       "client_secret": "test-secret"
     }'
   ```
   - **Expected**: 400 Bad Request

2. **Test PKCE Bypass**
   - Use authorization code without code_verifier
   - **Expected**: 400 Bad Request

3. **Test Redirect URI Mismatch**
   - Use different redirect_uri than registered
   - **Expected**: 400 Bad Request

4. **Test Authorization Code Replay**
   - Use the same authorization code twice
   - **Expected**: 400 Bad Request (code already used)

5. **Test State Parameter Manipulation**
   - Modify state parameter in authorization request
   - **Expected**: Authorization should fail

### Pass Criteria
- All invalid OAuth flows are rejected
- Authorization codes are single-use
- PKCE is enforced when configured

---

## Test Case 4: Session Fixation

### Objective
Test if session fixation attacks are possible.

### Steps
1. **Set Pre-defined Session ID**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Cookie: session=attacker-controlled-session" \
     -H "Content-Type: application/json" \
     -d '{"type": "text", "difficulty": "easy"}'
   ```
   - **Expected**: Server should generate new session ID

2. **Test Session ID in URL**
   ```bash
   curl -X GET "http://localhost:3000/api/v1/captcha/generate?session=attacker-session"
   ```
   - **Expected**: Server should ignore session ID in URL

3. **Test Session Regeneration**
   - Generate captcha
   - Validate captcha
   - Check if session is invalidated after validation
   - **Expected**: Session should be invalidated after successful validation

### Pass Criteria
- Server generates new session IDs
- Pre-defined session IDs are rejected
- Sessions are invalidated after use

---

## Test Case 5: Rate Limiting Bypass

### Objective
Test if rate limiting can be bypassed.

### Steps
1. **Test IP-based Rate Limiting**
   ```bash
   # Send requests rapidly
   for i in {1..100}; do
     curl -s -o /dev/null -w "%{http_code}" \
       -X POST http://localhost:3000/api/v1/captcha/generate \
       -H "Content-Type: application/json" \
       -d '{"type": "text", "difficulty": "easy"}'
     echo ""
   done
   ```
   - **Expected**: Should receive 429 after limit

2. **Test X-Forwarded-For Header Spoofing**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "X-Forwarded-For: 10.0.0.1" \
     -H "Content-Type: application/json" \
     -d '{"type": "text", "difficulty": "easy"}'
   ```
   - **Expected**: Should use actual IP, not header

3. **Test API Key Rate Limiting**
   - Send requests with same API key from different IPs
   - **Expected**: Rate limit should apply per API key

### Pass Criteria
- Rate limiting cannot be bypassed via header spoofing
- Rate limits are enforced per IP and per API key
- 429 response is returned when limit exceeded

---

## Test Case 6: Endpoint Access Control

### Objective
Test if protected endpoints require proper authentication.

### Steps
1. **Test Unauthenticated Access to Protected Endpoints**
   ```bash
   # Try accessing admin/management endpoints without auth
   curl -X GET http://localhost:3000/api/v1/admin/config
   curl -X GET http://localhost:3000/api/v1/metrics
   ```
   - **Expected**: 401 or 403 for protected endpoints

2. **Test HTTP Method Override**
   ```bash
   # Try to bypass authentication by changing method
   curl -X OPTIONS http://localhost:3000/api/v1/captcha/generate
   curl -X HEAD http://localhost:3000/api/v1/captcha/generate
   ```
   - **Expected**: Should require authentication for state-changing operations

3. **Test Path Traversal**
   ```bash
   curl -X GET http://localhost:3000/api/v1/../admin/config
   curl -X GET http://localhost:3000/api/v1/captcha/..%2F..%2Fadmin
   ```
   - **Expected**: 404 or 403

### Pass Criteria
- All protected endpoints require authentication
- Method override doesn't bypass authentication
- Path traversal is prevented

---

## Test Results Template

| Test Case | Status | Notes | Severity |
|-----------|--------|-------|----------|
| JWT Token Manipulation | ☐ Pass ☐ Fail | | |
| API Key Bypass | ☐ Pass ☐ Fail | | |
| OAuth 2.0 Flow Bypass | ☐ Pass ☐ Fail | | |
| Session Fixation | ☐ Pass ☐ Fail | | |
| Rate Limiting Bypass | ☐ Pass ☐ Fail | | |
| Endpoint Access Control | ☐ Pass ☐ Fail | | |

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