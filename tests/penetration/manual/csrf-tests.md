# Cross-Site Request Forgery (CSRF) Testing Procedures

## Overview
This document outlines manual testing procedures for identifying CSRF vulnerabilities in the Secure CAPTCHA Plugin.

## Test Environment Setup
- Target URL: http://localhost:3000
- Tools: Browser, Burp Suite, OWASP ZAP
- Valid API Key: test-api-key (for testing)

---

## Test Case 1: CSRF Token Validation

### Objective
Test if CSRF tokens are properly validated.

### Steps
1. **Test Missing CSRF Token**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -H "Cookie: session=valid-session" \
     -d '{"type": "text", "difficulty": "easy"}'
   ```
   - **Expected**: Should require CSRF token for state-changing operations

2. **Test Invalid CSRF Token**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -H "X-CSRF-Token: invalid-token" \
     -H "Cookie: session=valid-session" \
     -d '{"type": "text", "difficulty": "easy"}'
   ```
   - **Expected**: 403 Forbidden

3. **Test Empty CSRF Token**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -H "X-CSRF-Token: " \
     -H "Cookie: session=valid-session" \
     -d '{"type": "text", "difficulty": "easy"}'
   ```
   - **Expected**: 403 Forbidden

4. **Test CSRF Token in Wrong Header**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -H "CSRF-Token: valid-token" \
     -H "Cookie: session=valid-session" \
     -d '{"type": "text", "difficulty": "easy"}'
   ```
   - **Expected**: Should require X-CSRF-Token header

### Pass Criteria
- CSRF tokens are required for state-changing operations
- Invalid tokens are rejected
- Token validation is strict

---

## Test Case 2: SameSite Cookie Attribute

### Objective
Test if cookies have proper SameSite attribute.

### Steps
1. **Check Session Cookie Attributes**
   ```bash
   curl -I http://localhost:3000/api/v1/health
   ```
   - **Expected**: Set-Cookie should include SameSite=Strict or SameSite=Lax

2. **Test Cross-Origin Request with Cookies**
   - Create HTML page on different origin:
   ```html
   <html>
   <body>
     <form action="http://localhost:3000/api/v1/captcha/generate" method="POST">
       <input type="hidden" name="type" value="text">
       <input type="hidden" name="difficulty" value="easy">
       <input type="submit" value="Submit">
     </form>
     <script>document.forms[0].submit();</script>
   </body>
   </html>
   ```
   - **Expected**: Cookies should not be sent with cross-origin request

3. **Test SameSite=None with Secure Flag**
   - If SameSite=None is used, verify Secure flag is also set
   - **Expected**: SameSite=None requires Secure flag

### Pass Criteria
- Cookies have SameSite attribute
- Cross-origin requests don't include cookies
- Secure flag is set when required

---

## Test Case 3: Origin/Referer Validation

### Objective
Test if Origin and Referer headers are validated.

### Steps
1. **Test Missing Origin Header**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -H "Referer: http://localhost:3000/" \
     -d '{"type": "text", "difficulty": "easy"}'
   ```
   - **Expected**: Should validate Origin header

2. **Test Mismatched Origin**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -H "Origin: http://evil.com" \
     -H "Referer: http://localhost:3000/" \
     -d '{"type": "text", "difficulty": "easy"}'
   ```
   - **Expected**: 403 Forbidden

3. **Test Null Origin**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -H "Origin: null" \
     -d '{"type": "text", "difficulty": "easy"}'
   ```
   - **Expected**: Should reject null origin

4. **Test Origin with Subdomain**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -H "Origin: http://sub.localhost:3000" \
     -d '{"type": "text", "difficulty": "easy"}'
   ```
   - **Expected**: Should validate exact origin match

### Pass Criteria
- Origin header is validated
- Referer header is validated
- Mismatched origins are rejected

---

## Test Case 4: Content-Type Based CSRF Protection

### Objective
Test if Content-Type validation provides CSRF protection.

### Steps
1. **Test application/json Content-Type**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -d '{"type": "text", "difficulty": "easy"}'
   ```
   - **Expected**: Should work with proper authentication

2. **Test application/x-www-form-urlencoded**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d 'type=text&difficulty=easy'
   ```
   - **Expected**: Should require CSRF token or reject

3. **Test multipart/form-data**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: multipart/form-data" \
     -F 'type=text' \
     -F 'difficulty=easy'
   ```
   - **Expected**: Should require CSRF token or reject

### Pass Criteria
- Content-Type is validated
- Simple Content-Types require CSRF protection
- Preflight requests are handled properly

---

## Test Case 5: CORS-Based CSRF Protection

### Objective
Test if CORS configuration prevents CSRF.

### Steps
1. **Test Cross-Origin Request**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -H "Origin: http://evil.com" \
     -d '{"type": "text", "difficulty": "easy"}'
   ```
   - **Expected**: Should be blocked by CORS

2. **Test Preflight Request**
   ```bash
   curl -X OPTIONS http://localhost:3000/api/v1/captcha/generate \
     -H "Origin: http://evil.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type"
   ```
   - **Expected**: Should not allow evil.com

3. **Test Credentials with Wildcard Origin**
   - Verify that wildcard origin is not used with credentials
   - **Expected**: Should not use * with credentials

### Pass Criteria
- CORS blocks unauthorized origins
- Preflight requests are properly handled
- Credentials are not sent to unauthorized origins

---

## Test Case 6: CSRF in API Endpoints

### Objective
Test CSRF protection across all API endpoints.

### Steps
1. **Test GET Endpoints (should be safe)**
   ```bash
   curl -X GET http://localhost:3000/api/v1/captcha/types
   ```
   - **Expected**: Should work without CSRF token

2. **Test POST Endpoints (should require CSRF)**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/validate \
     -H "Content-Type: application/json" \
     -d '{"sessionId": "test", "response": "test", "type": "text"}'
   ```
   - **Expected**: Should require CSRF token or authentication

3. **Test PUT/DELETE Endpoints**
   - Test state-changing operations
   - **Expected**: Should require CSRF token

### Pass Criteria
- GET requests are idempotent
- POST/PUT/DELETE require CSRF protection
- API authentication provides CSRF protection

---

## Test Results Template

| Test Case | Status | Notes | Severity |
|-----------|--------|-------|----------|
| CSRF Token Validation | ☐ Pass ☐ Fail | | |
| SameSite Cookie Attribute | ☐ Pass ☐ Fail | | |
| Origin/Referer Validation | ☐ Pass ☐ Fail | | |
| Content-Type Protection | ☐ Pass ☐ Fail | | |
| CORS Protection | ☐ Pass ☐ Fail | | |
| API Endpoint Protection | ☐ Pass ☐ Fail | | |

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