# Secure CAPTCHA Plugin - RESTful API Documentation

## Overview

The Secure CAPTCHA Plugin API provides enterprise-grade CAPTCHA protection with multi-layer security, behavioral analysis, and comprehensive threat detection.

**Base URL**: `http://localhost:3000/api/v1`

**API Version**: 1.0.0

---

## Table of Contents

1. [Authentication](#authentication)
2. [Rate Limiting](#rate-limiting)
3. [API Versioning](#api-versioning)
4. [Endpoints](#endpoints)
   - [Health Check](#health-check)
   - [Prometheus Metrics](#prometheus-metrics)
   - [Generate CAPTCHA](#generate-captcha)
   - [Validate CAPTCHA](#validate-captcha)
   - [Get CAPTCHA Types](#get-captcha-types)
5. [Error Codes](#error-codes)
6. [Request/Response Examples](#requestresponse-examples)
7. [SDK Integration](#sdk-integration)

---

## Authentication

The API supports two authentication methods:

### API Key Authentication

Include your API key in the Authorization header:

```
Authorization: Bearer YOUR_API_KEY
```

### JWT Token Authentication

Include your JWT token in the Authorization header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

> **Note**: Health check (`/health`) and metrics (`/metrics`) endpoints do not require authentication.

---

## Rate Limiting

### Default Rate Limits

| Scope | Limit | Window |
|-------|-------|--------|
| Global API | 100 requests | 1 minute |
| CAPTCHA Generation | 50 requests | 1 minute |
| CAPTCHA Validation | 100 requests | 1 minute |

### Rate Limit Headers

All API responses include rate limit headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed in the window |
| `X-RateLimit-Remaining` | Requests remaining in the current window |
| `X-RateLimit-Reset` | Unix timestamp when the rate limit window resets |

### Rate Limit Response

When rate limit is exceeded, the API returns:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later"
  }
}
```

### Custom Rate Limits

Rate limits can be configured per API key. Contact support for custom rate limits.

---

## API Versioning

The API uses URL versioning with the format `/api/v{version}/`.

### Current Version

- **v1**: Current stable version

### Version Lifecycle

| Version | Status | End of Life |
|---------|--------|-------------|
| v1 | Active | TBD |

### Migration Guide

When new versions are released, previous versions will be deprecated with 6 months notice.

---

## Endpoints

### Health Check

Check the health status of the API server.

**GET** `/health`

#### Response

```json
{
  "status": "healthy",
  "timestamp": "2026-03-31T12:00:00.000Z",
  "version": "1.0.0",
  "uptime": 86400,
  "memory": {
    "rss": 52428800,
    "heapTotal": 20971520,
    "heapUsed": 15728640,
    "external": 1048576
  }
}
```

#### Status Codes

| Code | Description |
|------|-------------|
| 200 | Server is healthy |
| 503 | Server is unhealthy |

---

### Prometheus Metrics

Get application metrics in Prometheus format.

**GET** `/metrics`

#### Response

```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/api/v1/health",status="200"} 1500
# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1"} 1200
http_request_duration_seconds_bucket{le="0.5"} 1450
http_request_duration_seconds_bucket{le="1"} 1490
http_request_duration_seconds_bucket{le="+Inf"} 1500
```

#### Available Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | Total HTTP requests by method, path, status |
| `http_request_duration_seconds` | Histogram | Request duration in seconds |
| `captcha_generation_total` | Counter | Total CAPTCHA generations |
| `captcha_generation_duration_seconds` | Histogram | CAPTCHA generation time |
| `captcha_validation_total` | Counter | Total CAPTCHA validations |
| `captcha_validation_duration_seconds` | Histogram | CAPTCHA validation time |
| `active_sessions` | Gauge | Number of active CAPTCHA sessions |
| `cache_hits_total` | Counter | Total cache hits |
| `cache_misses_total` | Counter | Total cache misses |
| `security_events_total` | Counter | Total security events by type |

---

### Generate CAPTCHA

Generate a new CAPTCHA challenge.

**POST** `/captcha/generate`

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | CAPTCHA type: `text`, `math`, `logic`, `image` |
| `difficulty` | string | Yes | Difficulty level: `easy`, `medium`, `hard` |
| `options` | object | No | Additional options (see below) |

#### Options

| Field | Type | Description |
|-------|------|-------------|
| `length` | integer | Text length for text CAPTCHA (default: 6) |
| `categories` | string[] | Categories for image CAPTCHA |
| `operations` | string[] | Math operations for math CAPTCHA |
| `language` | string | Language for text-based CAPTCHAs |

#### Example Request

```json
{
  "type": "text",
  "difficulty": "easy"
}
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "sessionId": "abc123-def456-ghi789",
    "challenge": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...",
    "type": "text",
    "difficulty": "easy",
    "expiresIn": 300,
    "metadata": {
      "ip": "192.168.1.1",
      "userAgent": "Mozilla/5.0..."
    }
  }
}
```

#### Status Codes

| Code | Description |
|------|-------------|
| 200 | CAPTCHA generated successfully |
| 400 | Invalid request (missing fields, invalid type) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

### Validate CAPTCHA

Validate a user's CAPTCHA response.

**POST** `/captcha/validate`

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | Yes | Session ID from CAPTCHA generation |
| `response` | string | Yes | User's answer to the CAPTCHA |
| `type` | string | Yes | CAPTCHA type being validated |

#### Example Request

```json
{
  "sessionId": "abc123-def456-ghi789",
  "response": "correct_answer",
  "type": "text"
}
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "valid": true,
    "securityScore": 95,
    "message": "CAPTCHA validated successfully"
  }
}
```

#### Status Codes

| Code | Description |
|------|-------------|
| 200 | Validation result returned |
| 400 | Invalid request (missing fields) |
| 404 | Session not found |
| 410 | Session expired |
| 429 | Maximum attempts exceeded |
| 500 | Internal server error |

---

### Get CAPTCHA Types

Get available CAPTCHA types and difficulty levels.

**GET** `/captcha/types`

#### Response

```json
{
  "success": true,
  "data": {
    "types": [
      {
        "type": "text",
        "name": "Text Captcha",
        "difficulties": ["easy", "medium", "hard"]
      },
      {
        "type": "math",
        "name": "Math Captcha",
        "difficulties": ["easy", "medium", "hard"]
      },
      {
        "type": "logic",
        "name": "Logic Captcha",
        "difficulties": ["easy", "medium", "hard"]
      },
      {
        "type": "image",
        "name": "Image Captcha",
        "difficulties": ["easy", "medium", "hard"]
      }
    ]
  }
}
```

---

## Error Codes

### Error Response Format

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "requestId": "abc-123-def",
    "timestamp": "2026-03-31T12:00:00.000Z"
  }
}
```

### Error Code Reference

| Error Code | HTTP Status | Description | Resolution |
|------------|-------------|-------------|------------|
| `INVALID_REQUEST` | 400 | Required fields are missing or invalid | Check request body for required fields |
| `INVALID_CAPTCHA_TYPE` | 400 | Unsupported CAPTCHA type | Use a valid type: text, math, logic, image |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Wait and retry, or contact support for higher limits |
| `SESSION_NOT_FOUND` | 404 | CAPTCHA session not found | Generate a new CAPTCHA |
| `SESSION_EXPIRED` | 410 | CAPTCHA session has expired | Generate a new CAPTCHA (sessions expire in 5 minutes) |
| `MAX_ATTEMPTS_EXCEEDED` | 429 | Maximum validation attempts exceeded | Generate a new CAPTCHA |
| `AUTHENTICATION_FAILED` | 401 | Invalid or missing authentication | Check API key or JWT token |
| `AUTHORIZATION_FAILED` | 403 | Insufficient permissions | Contact administrator for access |
| `INTERNAL_ERROR` | 500 | Unexpected server error | Retry request, contact support if persistent |

---

## Request/Response Examples

### Complete Flow Example

#### Step 1: Generate CAPTCHA

```bash
curl -X POST http://localhost:3000/api/v1/captcha/generate \
  -H "Content-Type: application/json" \
  -d '{
    "type": "math",
    "difficulty": "medium"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "sessionId": "sess_abc123",
    "challenge": "What is 5 + 3?",
    "type": "math",
    "difficulty": "medium",
    "expiresIn": 300
  }
}
```

#### Step 2: Validate Response

```bash
curl -X POST http://localhost:3000/api/v1/captcha/validate \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sess_abc123",
    "response": "8",
    "type": "math"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "securityScore": 95,
    "message": "CAPTCHA validated successfully"
  }
}
```

---

## SDK Integration

### JavaScript/TypeScript

```typescript
import { CaptchaClient } from '@secure-captcha/js-sdk';

const client = new CaptchaClient({
  baseUrl: 'http://localhost:3000/api/v1',
  apiKey: 'your-api-key'
});

// Generate CAPTCHA
const captcha = await client.generate({
  type: 'text',
  difficulty: 'easy'
});

// Validate response
const result = await client.validate({
  sessionId: captcha.sessionId,
  response: userInput,
  type: 'text'
});

if (result.valid) {
  console.log('CAPTCHA validated successfully');
}
```

### Python

```python
import requests

BASE_URL = "http://localhost:3000/api/v1"

# Generate CAPTCHA
response = requests.post(f"{BASE_URL}/captcha/generate", json={
    "type": "text",
    "difficulty": "easy"
})
captcha = response.json()["data"]

# Validate response
result = requests.post(f"{BASE_URL}/captcha/validate", json={
    "sessionId": captcha["sessionId"],
    "response": user_input,
    "type": "text"
})
validation = result.json()["data"]

if validation["valid"]:
    print("CAPTCHA validated successfully")
```

### cURL

```bash
# Generate CAPTCHA
curl -X POST http://localhost:3000/api/v1/captcha/generate \
  -H "Content-Type: application/json" \
  -d '{"type": "text", "difficulty": "easy"}'

# Validate response
curl -X POST http://localhost:3000/api/v1/captcha/validate \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "session-id", "response": "user-input", "type": "text"}'
```

---

## Additional Resources

- [OpenAPI Specification](./openapi.yaml) - Full API specification in OpenAPI 3.0 format
- [Swagger UI](./swagger/index.html) - Interactive API documentation
- [Postman Collection](./postman/secure-captcha-api.postman_collection.json) - Ready-to-use Postman collection
- [GitHub Repository](https://github.com/sreekanthvaripalli/secure-captcha-plugin) - Source code and issues