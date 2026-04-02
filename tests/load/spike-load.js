/**
 * Spike Load Test
 * Tests system behavior under sudden traffic spikes
 * Simulates flash crowds, DDoS-like patterns, and recovery
 * 
 * Target: Sudden spike from 0 to 1000+ users
 * 
 * Usage:
 *   k6 run tests/load/spike-load.js
 *   k6 run --duration 10m tests/load/spike-load.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const spikeLatency = new Trend('spike_request_latency', true);
const spikeErrorRate = new Rate('spike_error_rate');
const spikeRecoveryTime = new Trend('spike_recovery_time', true);
const requestsDuringSpike = new Counter('requests_during_spike');

// Test configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const CAPTCHA_TYPES = ['text', 'math', 'logic', 'image'];
const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'];

// Test scenarios - spike load pattern
export const options = {
  stages: [
    { duration: '30s', target: 10 },     // Baseline: 10 users
    { duration: '10s', target: 500 },    // SPIKE: Rapid ramp to 500 users
    { duration: '30s', target: 1000 },   // SPIKE PEAK: 1000 users
    { duration: '10s', target: 100 },    // Rapid drop: 100 users
    { duration: '1m', target: 100 },     // Recovery period: 100 users
    { duration: '30s', target: 10 },     // Return to baseline
    { duration: '30s', target: 0 },      // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],           // 95% of requests must complete below 2s
    http_req_failed: ['rate<0.10'],              // Error rate must be less than 10% during spike
    spike_request_latency: ['p(95)<1500'],       // 95% latency below 1.5s during spike
    spike_error_rate: ['rate>0.90'],             // 90% success rate during spike
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
 * Get current test phase based on VU count and iteration
 */
function getCurrentPhase() {
  const elapsed = Date.now() - setupStartTime;
  const elapsedSeconds = elapsed / 1000;
  
  if (elapsedSeconds < 30) return 'baseline';
  if (elapsedSeconds < 40) return 'spike_ramp';
  if (elapsedSeconds < 70) return 'spike_peak';
  if (elapsedSeconds < 80) return 'spike_drop';
  if (elapsedSeconds < 140) return 'recovery';
  return 'return_to_baseline';
}

let setupStartTime = Date.now();

/**
 * Setup function - runs once before all VUs
 */
export function setup() {
  console.log('Starting Spike Load Test');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Target: Sudden spike from 0 to 1000+ users`);
  
  // Verify server is running
  const healthCheck = http.get(`${BASE_URL}/api/v1/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`Server health check failed with status: ${healthCheck.status}`);
  }
  
  // Get baseline metrics
  const baselineStart = Date.now();
  const baselineResults = [];
  
  for (let i = 0; i < 10; i++) {
    const res = http.post(
      `${BASE_URL}/api/v1/captcha/generate`,
      generatePayload(),
      { headers: { 'Content-Type': 'application/json' } }
    );
    baselineResults.push({
      status: res.status,
      duration: res.timings.duration,
    });
  }
  
  const baselineAvg = baselineResults.reduce((sum, r) => sum + r.duration, 0) / baselineResults.length;
  console.log(`Baseline average response time: ${baselineAvg.toFixed(2)}ms`);
  
  console.log('Server health check passed');
  
  setupStartTime = Date.now();
  
  return {
    startTime: setupStartTime,
    baselineAvg: baselineAvg,
    spikeDetected: false,
    spikeStartTime: 0,
    spikeEndTime: 0,
  };
}

/**
 * Main VU function - runs for each virtual user
 */
export default function (data) {
  const phase = getCurrentPhase();
  const iterationStart = Date.now();
  
  group(`Spike Test - ${phase}`, function () {
    // Primary operation: Generate captcha
    const payload = generatePayload();
    const params = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Request-ID': `spike-${phase}-${__VU}-${__ITER}`,
      },
      tags: { name: `spike_${phase}` },
    };
    
    const res = http.post(`${BASE_URL}/api/v1/captcha/generate`, payload, params);
    const duration = Date.now() - iterationStart;
    
    spikeLatency.add(duration, { phase: phase });
    requestsDuringSpike.add(1);
    
    // Check response based on phase
    let expectedStatus = 200;
    let expectedSuccess = true;
    
    // During extreme spike, some 429s are expected
    if (phase === 'spike_peak' && __VU > 800) {
      expectedStatus = [200, 429];
    }
    
    const checkResult = check(res, {
      [`${phase}: status is OK`]: (r) => {
        if (Array.isArray(expectedStatus)) {
          return expectedStatus.includes(r.status);
        }
        return r.status === expectedStatus;
      },
      [`${phase}: has data or rate limit`]: (r) => {
        try {
          const body = JSON.parse(r.body);
          if (r.status === 429) {
            return body.error && body.error.code === 'RATE_LIMIT_EXCEEDED';
          }
          return body.data && body.data.sessionId;
        } catch (e) {
          return false;
        }
      },
    });
    
    if (checkResult) {
      spikeErrorRate.add(false, { phase: phase });
    } else {
      spikeErrorRate.add(true, { phase: phase });
    }
    
    // Track recovery
    if (phase === 'recovery' && res.status === 200 && duration < data.baselineAvg * 2) {
      spikeRecoveryTime.add(duration);
    }
  });
  
  // Secondary operation: Health check during spike
  if (__ITER % 5 === 0) {
    group('Health Check During Spike', function () {
      const healthRes = http.get(`${BASE_URL}/api/v1/health`, {
        headers: { 'Accept': 'application/json' },
        tags: { name: 'spike_health' },
      });
      
      check(healthRes, {
        'health: server still responding': (r) => r.status === 200,
      });
    });
  }
  
  // Variable sleep based on phase
  let sleepTime;
  switch (phase) {
    case 'baseline':
      sleepTime = Math.random() * 1 + 0.5;
      break;
    case 'spike_ramp':
    case 'spike_peak':
      sleepTime = Math.random() * 0.1 + 0.01; // Minimal sleep during spike
      break;
    case 'spike_drop':
      sleepTime = Math.random() * 0.3 + 0.1;
      break;
    case 'recovery':
      sleepTime = Math.random() * 0.5 + 0.2;
      break;
    default:
      sleepTime = Math.random() * 0.5 + 0.1;
  }
  
  sleep(sleepTime);
}

/**
 * Teardown function - runs once after all VUs complete
 */
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  
  console.log(`\nSpike Load Test Complete`);
  console.log(`Duration: ${duration.toFixed(2)}s`);
  console.log(`Baseline average: ${data.baselineAvg.toFixed(2)}ms`);
  
  // Get final server state
  const healthCheck = http.get(`${BASE_URL}/api/v1/health`);
  if (healthCheck.status === 200) {
    try {
      const body = JSON.parse(healthCheck.body);
      console.log(`\nServer State After Spike:`);
      console.log(`  Status: ${body.status}`);
      console.log(`  Uptime: ${body.uptime.toFixed(2)}s`);
      console.log(`  Memory RSS: ${(body.memory.rss / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Memory Heap Used: ${(body.memory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    } catch (e) {
      console.log('Could not parse server state');
    }
  }
  
  // Spike analysis
  console.log(`\nSpike Analysis:`);
  console.log(`  - System should recover within 60 seconds after spike`);
  console.log(`  - Error rate during spike should be < 10%`);
  console.log(`  - Latency should return to baseline within 2x after recovery`);
}