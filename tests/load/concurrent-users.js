/**
 * Concurrent Users Load Test
 * Tests the system under 10,000+ concurrent user scenarios
 * Simulates realistic user behavior patterns
 * 
 * Target: 10,000+ concurrent users
 * 
 * Usage:
 *   k6 run tests/load/concurrent-users.js
 *   k6 run --vus 1000 --duration 60s tests/load/concurrent-users.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const userJourneyTime = new Trend('user_journey_time', true);
const captchaGenerationTime = new Trend('concurrent_captcha_generation_time', true);
const captchaValidationTime = new Trend('concurrent_captcha_validation_time', true);
const successfulJourneys = new Rate('successful_user_journeys');
const failedJourneys = new Counter('failed_user_journeys');

// Test configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const CAPTCHA_TYPES = ['text', 'math', 'logic', 'image'];
const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'];

// Test scenarios with weights
export const options = {
  stages: [
    { duration: '1m', target: 1000 },    // Ramp up to 1000 users
    { duration: '2m', target: 5000 },    // Ramp up to 5000 users
    { duration: '3m', target: 10000 },   // Ramp up to 10000 users (peak load)
    { duration: '2m', target: 10000 },   // Sustain peak load
    { duration: '1m', target: 0 },       // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],           // 95% of requests must complete below 1s
    http_req_failed: ['rate<0.05'],              // Error rate must be less than 5%
    user_journey_time: ['p(95)<2000'],           // 95% of user journeys below 2s
    successful_user_journeys: ['rate>0.95'],     // 95% successful journeys
    failed_user_journeys: ['count<500'],         // Less than 500 failed journeys
    concurrent_captcha_generation_time: ['p(95)<800'],
    concurrent_captcha_validation_time: ['p(95)<500'],
  },
  // Summary trend stats
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)', 'count'],
};

/**
 * Simulate a complete user journey: generate captcha -> solve captcha -> validate
 */
function simulateUserJourney() {
  const type = CAPTCHA_TYPES[Math.floor(Math.random() * CAPTCHA_TYPES.length)];
  const difficulty = DIFFICULTY_LEVELS[Math.floor(Math.random() * DIFFICULTY_LEVELS.length)];
  
  // Step 1: User loads the page (health check as proxy)
  const pageLoadStart = Date.now();
  const pageLoadRes = http.get(`${BASE_URL}/api/v1/health`, {
    headers: { 'Accept': 'application/json' },
    tags: { name: 'page_load' },
  });
  const pageLoadTime = Date.now() - pageLoadStart;
  
  const pageLoadCheck = check(pageLoadRes, {
    'page load: status is 200': (r) => r.status === 200,
    'page load: response time < 500ms': () => pageLoadTime < 500,
  });
  
  if (!pageLoadCheck) {
    return false;
  }
  
  // Step 2: Generate captcha
  const generateStart = Date.now();
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
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Request-ID': `user-journey-${__VU}-${__ITER}`,
      },
      tags: { name: 'user_journey_generate' },
    }
  );
  const generateTime = Date.now() - generateStart;
  captchaGenerationTime.add(generateTime);
  
  const generateCheck = check(generateRes, {
    'generate: status is 200': (r) => r.status === 200,
    'generate: has session ID': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && body.data.sessionId;
      } catch (e) {
        return false;
      }
    },
  });
  
  if (!generateCheck) {
    return false;
  }
  
  let sessionId, answer;
  try {
    const body = JSON.parse(generateRes.body);
    sessionId = body.data.sessionId;
    answer = body.data.challenge.answer;
  } catch (e) {
    return false;
  }
  
  // Step 3: Simulate user thinking time (solving the captcha)
  const thinkingTime = Math.random() * 3 + 1; // 1-4 seconds
  sleep(thinkingTime);
  
  // Step 4: Validate captcha
  const validateStart = Date.now();
  const validateRes = http.post(
    `${BASE_URL}/api/v1/captcha/validate`,
    JSON.stringify({
      sessionId: sessionId,
      response: answer,
      type: type,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Request-ID': `user-journey-validate-${__VU}-${__ITER}`,
      },
      tags: { name: 'user_journey_validate' },
    }
  );
  const validateTime = Date.now() - validateStart;
  captchaValidationTime.add(validateTime);
  
  const validateCheck = check(validateRes, {
    'validate: status is 200': (r) => r.status === 200,
    'validate: has success field': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true;
      } catch (e) {
        return false;
      }
    },
  });
  
  return validateCheck;
}

/**
 * Setup function - runs once before all VUs
 */
export function setup() {
  console.log('Starting Concurrent Users Load Test');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Target: 10,000+ concurrent users`);
  
  // Verify server is running
  const healthCheck = http.get(`${BASE_URL}/api/v1/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`Server health check failed with status: ${healthCheck.status}`);
  }
  
  console.log('Server health check passed');
  
  return {
    startTime: Date.now(),
  };
}

/**
 * Main VU function - runs for each virtual user
 */
export default function (data) {
  const journeyStart = Date.now();
  
  group('User Journey', function () {
    const success = simulateUserJourney();
    
    const journeyTime = Date.now() - journeyStart;
    userJourneyTime.add(journeyTime);
    
    if (success) {
      successfulJourneys.add(true);
    } else {
      successfulJourneys.add(false);
      failedJourneys.add(1);
    }
  });
  
  // Simulate user session - multiple captcha attempts per session
  const sessionLength = Math.floor(Math.random() * 3) + 1; // 1-3 captchas per session
  for (let i = 0; i < sessionLength; i++) {
    sleep(Math.random() * 2 + 1);
    
    group('Additional Captcha Request', function () {
      const type = CAPTCHA_TYPES[Math.floor(Math.random() * CAPTCHA_TYPES.length)];
      
      const res = http.post(
        `${BASE_URL}/api/v1/captcha/generate`,
        JSON.stringify({
          type: type,
          difficulty: 'easy',
          options: {
            enableBehavioralAnalysis: false,
            enableDeviceFingerprinting: false,
          },
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          tags: { name: 'additional_captcha' },
        }
      );
      
      check(res, {
        'additional: status is 200': (r) => r.status === 200,
      });
    });
  }
  
  // Simulate user leaving after session
  sleep(Math.random() * 5 + 2);
}

/**
 * Teardown function - runs once after all VUs complete
 */
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`\nConcurrent Users Load Test Complete`);
  console.log(`Duration: ${duration.toFixed(2)}s`);
}
