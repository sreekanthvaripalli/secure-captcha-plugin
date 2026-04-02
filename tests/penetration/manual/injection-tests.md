# Injection Attack Testing Procedures

## Overview
This document outlines manual testing procedures for identifying injection vulnerabilities in the Secure CAPTCHA Plugin.

## Test Environment Setup
- Target URL: http://localhost:3000
- Tools: curl, Burp Suite, SQLMap, Postman
- Valid API Key: test-api-key (for testing)

---

## Test Case 1: SQL Injection

### Objective
Test if SQL injection vulnerabilities exist in API parameters.

### Steps
1. **Test POST Body Parameters**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -d '{"type": "text\' OR \'1\'=\'1", "difficulty": "easy"}'
   ```
   - **Expected**: 400 Bad Request (input validation)

2. **Test JSON Injection**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -d '{"type": "text", "difficulty": "easy", "options": {"$where": "sleep(5000)"}}'
   ```
   - **Expected**: 400 Bad Request

3. **Test Session ID Parameter**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/validate \
     -H "Content-Type: application/json" \
     -d '{"sessionId": "1\' OR \'1\'=\'1", "response": "test", "type": "text"}'
   ```
   - **Expected**: 400 Bad Request

4. **Test Union-Based Injection**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -d '{"type": "text", "difficulty": "easy UNION SELECT * FROM users--"}'
   ```
   - **Expected**: 400 Bad Request

5. **Test Time-Based Blind Injection**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -d '{"type": "text", "difficulty": "easy\'; WAITFOR DELAY \'00:00:05\';--"}'
   ```
   - **Expected**: 400 Bad Request (should not delay)

### Pass Criteria
- All SQL injection attempts are blocked
- Input validation rejects malicious patterns
- No database errors are exposed

---

## Test Case 2: Command Injection

### Objective
Test if OS command injection vulnerabilities exist.

### Steps
1. **Test Command Injection in Type Parameter**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -d '{"type": "text; ls -la", "difficulty": "easy"}'
   ```
   - **Expected**: 400 Bad Request

2. **Test Command Injection in Options**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -d '{"type": "text", "difficulty": "easy", "options": {"callback": "$(whoami)"}}'
   ```
   - **Expected**: 400 Bad Request

3. **Test Backtick Injection**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -d '{"type": "`id`", "difficulty": "easy"}'
   ```
   - **Expected**: 400 Bad Request

4. **Test Pipe Injection**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -d '{"type": "text", "difficulty": "easy | cat /etc/passwd"}'
   ```
   - **Expected**: 400 Bad Request

### Pass Criteria
- All command injection attempts are blocked
- Shell metacharacters are sanitized
- No system commands are executed

---

## Test Case 3: NoSQL Injection

### Objective
Test if NoSQL injection vulnerabilities exist.

### Steps
1. **Test MongoDB Operator Injection**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -d '{"type": {"$gt": ""}, "difficulty": "easy"}'
   ```
   - **Expected**: 400 Bad Request

2. **Test $where Operator**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/validate \
     -H "Content-Type: application/json" \
     -d '{"sessionId": {"$where": "return true"}, "response": "test", "type": "text"}'
   ```
   - **Expected**: 400 Bad Request

3. **Test $regex Operator**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/validate \
     -H "Content-Type: application/json" \
     -d '{"sessionId": {"$regex": ".*"}, "response": "test", "type": "text"}'
   ```
   - **Expected**: 400 Bad Request

### Pass Criteria
- All NoSQL injection attempts are blocked
- MongoDB operators are rejected
- Input is properly validated

---

## Test Case 4: LDAP Injection

### Objective
Test if LDAP injection vulnerabilities exist.

### Steps
1. **Test LDAP Filter Bypass**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -d '{"type": "text*)(|(objectClass=*)", "difficulty": "easy"}'
   ```
   - **Expected**: 400 Bad Request

2. **Test LDAP Null Byte**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -d '{"type": "text\x00", "difficulty": "easy"}'
   ```
   - **Expected**: 400 Bad Request

### Pass Criteria
- All LDAP injection attempts are blocked
- Special characters are sanitized

---

## Test Case 5: Header Injection

### Objective
Test if HTTP header injection vulnerabilities exist.

### Steps
1. **Test CRLF Injection in Headers**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -H "X-Custom-Header: value\r\nX-Injected: header" \
     -d '{"type": "text", "difficulty": "easy"}'
   ```
   - **Expected**: Header injection should be prevented

2. **Test Host Header Injection**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -H "Host: evil.com" \
     -d '{"type": "text", "difficulty": "easy"}'
   ```
   - **Expected**: Host header should be validated

3. **Test Referer Injection**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -H "Referer: javascript:alert(1)" \
     -d '{"type": "text", "difficulty": "easy"}'
   ```
   - **Expected**: Should be sanitized

### Pass Criteria
- Header injection is prevented
- CRLF characters are sanitized
- Host header is validated

---

## Test Case 6: Template Injection

### Objective
Test if server-side template injection vulnerabilities exist.

### Steps
1. **Test SSTI in Type Parameter**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -d '{"type": "{{7*7}}", "difficulty": "easy"}'
   ```
   - **Expected**: 400 Bad Request (not "49")

2. **Test SSTI in Options**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -d '{"type": "text", "difficulty": "easy", "options": {"template": "${7*7}"}}'
   ```
   - **Expected**: 400 Bad Request

3. **Test EJS/Handlebars Injection**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/json" \
     -d '{"type": "text", "difficulty": "<%= global.process.mainModule.require(\"child_process\").execSync(\"id\") %>"}'
   ```
   - **Expected**: 400 Bad Request

### Pass Criteria
- Template injection is prevented
- Template syntax is not evaluated
- Input is properly sanitized

---

## Test Case 7: XML Injection

### Objective
Test if XML injection vulnerabilities exist.

### Steps
1. **Test XXE Injection**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/xml" \
     -d '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY test SYSTEM "file:///etc/passwd">]><captcha><type>&test;</type></captcha>'
   ```
   - **Expected**: 415 Unsupported Media Type (if XML not supported)

2. **Test XML Bomb**
   ```bash
   curl -X POST http://localhost:3000/api/v1/captcha/generate \
     -H "Content-Type: application/xml" \
     -d '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY a "AAAAAAAAAA"><!ENTITY b "&a;&a;&a;&a;">]><captcha><type>&b;</type></captcha>'
   ```
   - **Expected**: 415 Unsupported Media Type

### Pass Criteria
- XML injection is prevented
- XXE attacks are blocked
- XML bombs are rejected

---

## Test Results Template

| Test Case | Status | Notes | Severity |
|-----------|--------|-------|----------|
| SQL Injection | ☐ Pass ☐ Fail | | |
| Command Injection | ☐ Pass ☐ Fail | | |
| NoSQL Injection | ☐ Pass ☐ Fail | | |
| LDAP Injection | ☐ Pass ☐ Fail | | |
| Header Injection | ☐ Pass ☐ Fail | | |
| Template Injection | ☐ Pass ☐ Fail | | |
| XML Injection | ☐ Pass ☐ Fail | | |

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