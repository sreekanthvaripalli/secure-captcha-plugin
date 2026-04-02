/**
 * Sustained Load Test (1 Hour)
 * Tests system stability under prolonged load conditions
 * Identifies memory leaks, resource exhaustion, and degradation over time
 * 
 * Target: 1 hour sustained load at 500 RPS
 * 
 * Usage:
 *   k6 run tests/load/sustained-load.js
 *   k6 run --duration 1h tests/load/sustained-load.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const requestLatency = new Trend('sustained_request_latency', true);
const errorRate = new Rate('sustained_error_rate');
const requestsPerSecond = new Counter('sustained_requests_total');

// Time-based metrics for tracking degradation
const latencyOverTime = new Trend('latency_over_time', true);

// Test configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const CAPTCHA_TYPES = ['text', 'math', 'logic', 'image'];
const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'];

// Test scenarios - 1 hour sustained load
export const options = {
  stages: [
    { duration: '5m', target: 50 },     // Ramp up to 50 users
    { duration: '10m', target: 100 },   // Ramp up to 100 users
    { duration: '45m', target: 100 },   // Sustain 100 users for 45 minutes
    { duration: '5m', target: 0 },      // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],           // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.02'],             // Error rate must be less than 2%
    sustained_request_latency: ['p(95)<400'],   // 95% latency below 400ms
    sustained_error_rate: ['rate>0.98'],        // 98% success rate
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
  console.log('Starting Sustained Load Test (1 Hour)');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Target: 500 RPS sustained for 1 hour`);
  
  // Verify server is running
  const healthCheck = http.get(`${BASE_URL}/api/v1/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`Server health check failed with status: ${healthCheck.status}`);
  }
  
  // Get initial metrics
  const metricsCheck = http.get(`${BASE_URL}/api/v1/metrics`);
  console.log('Initial metrics endpoint available');
  
  console.log('Server health check passed');
  
  return {
    startTime: Date.now(),
    iterationCount: 0,
    errorCount: 0,
  };
}

/**
 * Main VU function - runs for each virtual user
 */
export default function (data) {
  const iterationStart = Date.now();
  
  // Mix of operations to simulate real usage
  const operation = Math.random();
  
  if (operation < 0.6) {
    // 60% - Generate captcha
    group('Generate Captcha', function () {
      const payload = generatePayload();
      const params = {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Request-ID': `sustained-${__VU}-${__ITER}`,
        },
        tags: { name: 'sustained_generate' },
      };
      
      const res = http.post(`${BASE_URL}/api/v1/captcha/generate`, payload, params);
      const duration = Date.now() - iterationStart;
      
      requestLatency.add(duration);
      requestsPerSecond.add(1);
      
      const checkResult = check(res, {
        'generate: status is 200': (r) => r.status === 200,
        'generate: has data': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.data && body.data.sessionId;
          } catch (e) {
            return false;
          }
        },
      });
      
      if (!checkResult) {
        errorRate.add(true);
        data.errorCount++;
      } else {
        errorRate.add(false);
      }
    });
  } else if (operation < 0.9) {
    // 30% - Health check (monitoring)
    group('Health Check', function () {
      const res = http.get(`${BASE_URL}/api/v1/health`, {
        headers: { 'Accept': 'application/json' },
        tags: { name: 'sustained_health' },
      });
      
      const duration = Date.now() - iterationStart;
      requestLatency.add(duration);
      requestsPerSecond.add(1);
      
      check(res, {
        'health: status is 200': (r) => r.status === 200,
        'health: has uptime': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.uptime > 0;
          } catch (e) {
            return false;
          }
        },
      });
    });
  } else {
    // 10% - Get captcha types
    group('Get Captcha Types', function () {
      const res = http.get(`${BASE_URL}/api/v1/captcha/types`, {
        headers: { 'Accept': 'application/json' },
        tags: { name: 'sustained_types' },
      });
      
      const duration = Date.now() - iterationStart;
      requestLatency.add(duration);
      requestsPerSecond.add(1);
      
      check(res, {
        'types: status is 200': (r) => r.status === 200,
        'types: has types': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.data && body.data.types && body.data.types.length > 0;
          } catch (e) {
            return false;
          }
        },
      });
    });
  }
  
  data.iterationCount++;
  
  // Record latency over time for degradation analysis
  const elapsedMinutes = (Date.now() - data.startTime) / 60000;
  latencyOverTime.add(Date.now() - iterationStart, { minute: Math.floor(elapsedMinutes).toString() });
  
  // Small sleep to control request rate
  sleep(Math.random() * 0.5 + 0.1);
}

/**
 * Teardown function - runs once after all VUs complete
 */
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  const durationMinutes = duration / 60;
  
  console.log(`\nSustained Load Test Complete`);
  console.log(`Duration: ${durationMinutes.toFixed(2)} minutes (${duration.toFixed(2)}s)`);
  console.log(`Total iterations: ${data.iterationCount}`);
  console.log(`Total errors: ${data.errorCount}`);
  console.log(`Error rate: ${(data.errorCount / data.iterationCount * 100).toFixed(2)}%`);
  
  // Check for memory leak indicators
  const healthCheck = http.get(`${BASE_URL}/api/v1/health`);
  if (healthCheck.status === 200) {
    try {
      const body = JSON.parse(healthCheck.body);
      console.log(`\nServer Memory Usage:`);
      console.log(`  RSS: ${(body.memory.rss / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Heap Total: ${(body.memory.heapTotal / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Heap Used: ${(body.memory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  External: ${(body.memory.external / 1024 / 1024).toFixed(2)} MB`);
    } catch (e) {
      console.log('Could not parse memory usage');
    }
  }
}