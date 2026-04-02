# Cross-Site Scripting (XSS) Testing Procedures

## Overview
This document outlines manual testing procedures for identifying XSS vulnerabilities in the Secure CAPTCHA Plugin.

## Test Environment Setup
- Target URL: http://localhost:3000
- Tools: Browser, Burp Suite, OWASP ZAP
- Valid API Key: test-api-key (for testing)

---

## Test Case 1: Reflected XSS

### Objective
Test if user input is reflected in the response without proper sanitization.

### Steps
1. **Test Basic Reflected XSS**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -d '{"type": "<script>alert(1)</script>", "difficulty": "easy"}'
   ```
   - **Expected**: Script tags should be escaped or removed

2. **Test Error Message Reflection**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/validate \
     -H "Content-Type: application/json" \
     -d '{"sessionId": "<img src=x onerror=alert(1)>", "response": "test", "type": "text"}'
   ```
   - **Expected**: Error message should not contain executable HTML

3. **Test Event Handler Injection**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -d '{"type": "text", "difficulty": "easy", "options": {"onload": "alert(1)"}}'
   ```
   - **Expected**: Event handlers should be stripped

4. **Test SVG-Based XSS**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -d '{"type": "<svg onload=alert(1)>", "difficulty": "easy"}'
   ```
   - **Expected**: SVG should be sanitized

5. **Test Data URI XSS**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -d '{"type": "data:text/html,<script>alert(1)</script>", "difficulty": "easy"}'
   ```
   - **Expected**: Data URIs should be blocked

### Pass Criteria
- All reflected XSS attempts are blocked
- Script tags are escaped
- Event handlers are stripped
- Error messages don't contain executable content

---

## Test Case 2: Content Security Policy Bypass

### Objective
Test if Content Security Policy can be bypassed.

### Steps
1. **Check CSP Headers**
   ```bash
   curl -I http://localhost:3000/api/v1/health
   ```
   - **Expected**: Should include Content-Security-Policy header

2. **Test Inline Script Execution**
   - If any HTML response is returned, try injecting inline scripts
   - **Expected**: CSP should block inline scripts

3. **Test eval() Execution**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -d '{"type": "text", "difficulty": "eval(alert(1))"}'
   ```
   - **Expected**: eval() should be blocked by CSP

4. **Test External Script Loading**
   - Try loading external scripts in responses
   - **Expected**: CSP should restrict script sources

### Pass Criteria
- CSP headers are present
- Inline scripts are blocked
- eval() is restricted
- External script loading is controlled

---

## Test Case 3: DOM-Based XSS

### Objective
Test if DOM-based XSS vulnerabilities exist in frontend components.

### Steps
1. **Test URL Parameter Reflection**
   - If any URL parameters are reflected in DOM, test:
   ```
   http://localhost:3000/?callback=<script>alert(1)</script>
   http://localhost:3000/?redirect=javascript:alert(1)
   ```
   - **Expected**: Parameters should be properly encoded

2. **Test innerHTML Usage**
   - Check if any response content is inserted via innerHTML
   - **Expected**: Should use textContent or proper sanitization

3. **Test document.write()**
   - Check if any user input is passed to document.write()
   - **Expected**: Should not use document.write() with user input

### Pass Criteria
- DOM-based XSS is prevented
- User input is properly encoded
- Safe DOM APIs are used

---

## Test Case 4: Stored XSS

### Objective
Test if stored XSS vulnerabilities exist.

### Steps
1. **Test Captcha Response Storage**
   - Submit malicious captcha response
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/validate \
     -H "Content-Type: application/json" \
     -d '{"sessionId": "test-session", "response": "<script>alert(document.cookie)</script>", "type": "text"}'
   ```
   - Check if stored data is sanitized when retrieved

2. **Test Session Data Storage**
   - Store malicious data in session
   - **Expected**: Data should be sanitized on retrieval

### Pass Criteria
- Stored data is sanitized
- No executable content in stored responses
- Output encoding is applied

---

## Test Case 5: XSS via Headers

### Objective
Test if XSS is possible through HTTP headers.

### Steps
1. **Test User-Agent XSS**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -H "User-Agent: <script>alert(1)</script>" \
     -d '{"type": "text", "difficulty": "easy"}'
   ```
   - **Expected**: User-Agent should be sanitized in logs

2. **Test Referer XSS**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -H "Referer: javascript:alert(1)" \
     -d '{"type": "text", "difficulty": "easy"}'
   ```
   - **Expected**: Referer should be sanitized

3. **Test Origin Header XSS**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -H "Origin: <script>alert(1)</script>" \
     -d '{"type": "text", "difficulty": "easy"}'
   ```
   - **Expected**: Origin should be validated

### Pass Criteria
- Header values are sanitized
- No header-based XSS vectors
- Logs don't contain executable content

---

## Test Case 6: XSS in Error Responses

### Objective
Test if error responses contain XSS payloads.

### Steps
1. **Test 400 Error Response**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -d '{"type": "<script>alert(1)</script>"}'
   ```
   - **Expected**: Error message should not reflect input

2. **Test 500 Error Response**
   - Trigger server error with malicious input
   - **Expected**: Error response should be generic

3. **Test 404 Error Response**
   ```bash
   curl -X GET "http://localhost:3000/api/v1/<script>alert(1)</script>"
   ```
   - **Expected**: 404 page should not reflect URL

### Pass Criteria
- Error responses are generic
- Input is not reflected in errors
- Stack traces are not exposed

---

## Test Results Template

| Test Case | Status | Notes | Severity |
|-----------|--------|-------|----------|
| Reflected XSS | ☐ Pass ☐ Fail | | |
| CSP Bypass | ☐ Pass ☐ Fail | | |
| DOM-Based XSS | ☐ Pass ☐ Fail | | |
| Stored XSS | ☐ Pass ☐ Fail | | |
| Header XSS | ☐ Pass ☐ Fail | | |
| Error Response XSS | ☐ Pass ☐ Fail | | |

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