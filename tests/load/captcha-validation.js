/**
 * CAPTCHA Validation Load Test
 * Tests the /api/v1/captcha/validate endpoint under various load conditions
 * 
 * Target: 5000 RPS sustained load
 * 
 * Usage:
 *   k6 run tests/load/captcha-validation.js
 *   k6 run --vus 200 --duration 30s tests/load/captcha-validation.js
 *   k6 run --vus 500 --duration 60s tests/load/captcha-validation.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const captchaValidationTime = new Trend('captcha_validation_time', true);
const captchaValidationSuccess = new Rate('captcha_validation_success');
const captchaValidationErrors = new Counter('captcha_validation_errors');
const captchaValidationFailures = new Counter('captcha_validation_failures');

// Test configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const CAPTCHA_TYPES = ['text', 'math', 'logic', 'image'];
const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'];

// Test scenarios with weights
export const options = {
  stages: [
    { duration: '30s', target: 100 },   // Ramp up to 100 users
    { duration: '1m', target: 200 },    // Ramp up to 200 users
    { duration: '2m', target: 500 },    // Ramp up to 500 users (sustained load)
    { duration: '30s', target: 0 },     // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],       // 95% of requests must complete below 200ms
    http_req_failed: ['rate<0.01'],         // Error rate must be less than 1%
    captcha_validation_time: ['p(95)<150'], // 95% of captcha validation below 150ms
    captcha_validation_success: ['rate>0.99'], // 99% success rate
    captcha_validation_errors: ['count<100'],  // Less than 100 errors total
  },
  // Summary trend stats
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)', 'count'],
};

/**
 * Generate a captcha session first, then return validation payload
 */
function createValidationPayload() {
  const type = CAPTCHA_TYPES[Math.floor(Math.random() * CAPTCHA_TYPES.length)];
  const difficulty = DIFFICULTY_LEVELS[Math.floor(Math.random() * DIFFICULTY_LEVELS.length)];
  
  // First, generate a captcha to get a session ID
  const generateRes = http.post(
    `${BASE_URL}/api/v1/captcha/generate`,
    JSON.stringify({
      type: type,
      difficulty: difficulty,
      options: {
        enableBehavioralAnalysis: false,
        enableDeviceFingerprinting: false,
      },
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'generate_for_validation' },
    }
  );
  
  if (generateRes.status === 200) {
    try {
      const body = JSON.parse(generateRes.body);
      if (body.data && body.data.sessionId && body.data.challenge) {
        return {
          sessionId: body.data.sessionId,
          answer: body.data.challenge.answer,
          type: type,
        };
      }
    } catch (e) {
      // Fall through to return null
    }
  }
  
  return null;
}

/**
 * Setup function - runs once before all VUs
 */
export function setup() {
  console.log('Starting CAPTCHA Validation Load Test');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Target: 5000 RPS`);
  
  // Verify server is running
  const healthCheck = http.get(`${BASE_URL}/api/v1/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`Server health check failed with status: ${healthCheck.status}`);
  }
  
  console.log('Server health check passed');
  
  // Pre-generate some captcha sessions
  const sessions = [];
  for (let i = 0; i < 100; i++) {
    const payload = createValidationPayload();
    if (payload) {
      sessions.push(payload);
    }
  }
  
  console.log(`Pre-generated ${sessions.length} captcha sessions`);
  
  return {
    startTime: Date.now(),
    sessions: sessions,
  };
}

/**
 * Main VU function - runs for each virtual user
 */
export default function (data) {
  // Get a session from the pool or generate new one
  let session = null;
  if (data.sessions.length > 0) {
    session = data.sessions[__VU % data.sessions.length];
  } else {
    session = createValidationPayload();
  }
  
  if (!session) {
    captchaValidationErrors.add(1);
    sleep(0.1);
    return;
  }
  
  group('CAPTCHA Validation', function () {
    // Test valid answer
    const validPayload = JSON.stringify({
      sessionId: session.sessionId,
      response: session.answer,
      type: session.type,
    });
    
    const validParams = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Request-ID': `load-test-valid-${__VU}-${__ITER}`,
      },
      tags: { name: 'validate_captcha_valid' },
    };
    
    const startTime = Date.now();
    const validRes = http.post(`${BASE_URL}/api/v1/captcha/validate`, validPayload, validParams);
    const duration = Date.now() - startTime;
    
    captchaValidationTime.add(duration);
    
    const checkResult = check(validRes, {
      'valid: status is 200': (r) => r.status === 200,
      'valid: has success field': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === true;
        } catch (e) {
          return false;
        }
      },
      'valid: response time < 200ms': (r) => duration < 200,
    });
    
    if (checkResult) {
      captchaValidationSuccess.add(true);
    } else {
      captchaValidationSuccess.add(false);
      captchaValidationErrors.add(1);
    }
    
    // Test invalid answer (should fail validation but return 200)
    const invalidPayload = JSON.stringify({
      sessionId: session.sessionId,
      response: 'wrong_answer_' + Math.random().toString(36).substring(7),
      type: session.type,
    });
    
    const invalidParams = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Request-ID': `load-test-invalid-${__VU}-${__ITER}`,
      },
      tags: { name: 'validate_captcha_invalid' },
    };
    
    const invalidRes = http.post(`${BASE_URL}/api/v1/captcha/validate`, invalidPayload, invalidParams);
    
    check(invalidRes, {
      'invalid: status is 200': (r) => r.status === 200,
      'invalid: has success field': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === true;
        } catch (e) {
          return false;
        }
      },
      'invalid: validation failed': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data && body.data.valid === false;
        } catch (e) {
          return false;
        }
      },
    });
    
    // Test missing session ID
    const missingSessionPayload = JSON.stringify({
      response: 'test',
      type: session.type,
    });
    
    const missingSessionParams = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Request-ID': `load-test-missing-${__VU}-${__ITER}`,
      },
      tags: { name: 'validate_captcha_missing_session' },
    };
    
    const missingSessionRes = http.post(
      `${BASE_URL}/api/v1/captcha/validate`,
      missingSessionPayload,
      missingSessionParams
    );
    
    check(missingSessionRes, {
      'missing session: status is 400': (r) => r.status === 400,
    });
    
    // Small sleep to prevent thundering herd
    sleep(Math.random() * 0.05 + 0.02);
  });
}

/**
 * Teardown function - runs once after all VUs complete
 */
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`\nCAPTCHA Validation Load Test Complete`);
  console.log(`Duration: ${duration.toFixed(2)}s`);
}
