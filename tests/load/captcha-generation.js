/**
 * CAPTCHA Generation Load Test
 * Tests the /api/v1/captcha/generate endpoint under various load conditions
 * 
 * Target: 1000 RPS sustained load
 * 
 * Usage:
 *   k6 run tests/load/captcha-generation.js
 *   k6 run --vus 100 --duration 30s tests/load/captcha-generation.js
 *   k6 run --vus 500 --duration 60s tests/load/captcha-generation.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const captchaGenerationTime = new Trend('captcha_generation_time', true);
const captchaGenerationSuccess = new Rate('captcha_generation_success');
const captchaGenerationErrors = new Counter('captcha_generation_errors');

// Test configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const CAPTCHA_TYPES = ['text', 'math', 'logic', 'image'];
const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'];

// Test scenarios with weights
export const options = {
  stages: [
    { duration: '30s', target: 50 },    // Ramp up to 50 users
    { duration: '1m', target: 100 },    // Ramp up to 100 users
    { duration: '2m', target: 200 },    // Ramp up to 200 users (sustained load)
    { duration: '30s', target: 0 },     // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],       // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.01'],         // Error rate must be less than 1%
    captcha_generation_time: ['p(95)<400'], // 95% of captcha generation below 400ms
    captcha_generation_success: ['rate>0.99'], // 99% success rate
    captcha_generation_errors: ['count<100'],  // Less than 100 errors total
  },
  // Summary trend stats
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)', 'count'],
};

/**
 * Generate random captcha payload
 */
function generatePayload() {
  const type = CAPTCHA_TYPES[Math.floor(Math.random() * CAPTCHA_TYPES.length)];
  const difficulty = DIFFICULTY_LEVELS[Math.floor(Math.random() * DIFFICULTY_LEVELS.length)];
  
  return JSON.stringify({
    type: type,
    difficulty: difficulty,
    options: {
      enableBehavioralAnalysis: false,
      enableDeviceFingerprinting: false,
    },
  });
}

/**
 * Setup function - runs once before all VUs
 */
export function setup() {
  console.log('Starting CAPTCHA Generation Load Test');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Target: 1000 RPS`);
  
  // Verify server is running
  const healthCheck = http.get(`${BASE_URL}/api/v1/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`Server health check failed with status: ${healthCheck.status}`);
  }
  
  console.log('Server health check passed');
  
  return {
    startTime: Date.now(),
    totalRequests: 0,
  };
}

/**
 * Main VU function - runs for each virtual user
 */
export default function (data) {
  group('CAPTCHA Generation', function () {
    const payload = generatePayload();
    const params = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      tags: { name: 'generate_captcha' },
    };
    
    const startTime = Date.now();
    const res = http.post(`${BASE_URL}/api/v1/captcha/generate`, payload, params);
    const duration = Date.now() - startTime;
    
    // Record custom metrics
    captchaGenerationTime.add(duration);
    
    // Check response
    const checkResult = check(res, {
      'status is 200': (r) => r.status === 200,
      'has success field': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === true;
        } catch (e) {
          return false;
        }
      },
      'has captcha data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data && body.data.sessionId;
        } catch (e) {
          return false;
        }
      },
      'response time < 500ms': (r) => duration < 500,
      'has challenge data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data && body.data.challenge;
        } catch (e) {
          return false;
        }
      },
    });
    
    if (checkResult) {
      captchaGenerationSuccess.add(true);
    } else {
      captchaGenerationSuccess.add(false);
      captchaGenerationErrors.add(1);
    }
    
    // Small sleep to prevent thundering herd
    sleep(Math.random() * 0.1 + 0.05);
  });
}

/**
 * Teardown function - runs once after all VUs complete
 */
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`\nCAPTCHA Generation Load Test Complete`);
  console.log(`Duration: ${duration.toFixed(2)}s`);
}
