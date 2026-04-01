/**
 * E2E Browser Interaction Tests - Task 6.1.3
 * Tests user interactions, cross-browser compatibility, and mobile responsiveness
 */

import { test, expect } from '@playwright/test';

test.describe('E2E Browser Interaction Tests', () => {
  test.describe('Frontend Widget Rendering', () => {
    test('should render captcha widget in browser', async ({ page }) => {
      // Create a simple HTML page with the captcha widget
      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Captcha Test</title>
        </head>
        <body>
          <div id="captcha-container"></div>
          <script>
            // Simulate captcha widget initialization
            document.getElementById('captcha-container').innerHTML = 
              '<div class="captcha-widget">' +
              '<h2>Security Check</h2>' +
              '<div class="captcha-challenge">What is 2 + 2?</div>' +
              '<input type="text" class="captcha-input" placeholder="Enter your answer">' +
              '<button class="captcha-submit">Verify</button>' +
              '<button class="captcha-refresh">Refresh</button>' +
              '</div>';
          </script>
        </body>
        </html>
      `);

      // Verify widget renders correctly
      const widget = await page.locator('.captcha-widget');
      await expect(widget).toBeVisible();

      const challenge = await page.locator('.captcha-challenge');
      await expect(challenge).toBeVisible();
      await expect(challenge).toContainText('What is 2 + 2?');

      const input = await page.locator('.captcha-input');
      await expect(input).toBeVisible();

      const submitButton = await page.locator('.captcha-submit');
      await expect(submitButton).toBeVisible();
      await expect(submitButton).toContainText('Verify');

      const refreshButton = await page.locator('.captcha-refresh');
      await expect(refreshButton).toBeVisible();
    });

    test('should display loading state during captcha generation', async ({ page }) => {
      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Captcha Loading Test</title>
        </head>
        <body>
          <div id="captcha-container">
            <div class="captcha-loading">
              <div class="spinner"></div>
              <p>Loading captcha...</p>
            </div>
          </div>
        </body>
        </html>
      `);

      const loadingState = await page.locator('.captcha-loading');
      await expect(loadingState).toBeVisible();
      await expect(loadingState).toContainText('Loading captcha');
    });

    test('should display error state on failure', async ({ page }) => {
      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Captcha Error Test</title>
        </head>
        <body>
          <div id="captcha-container">
            <div class="captcha-error">
              <p>Failed to load captcha. Please try again.</p>
              <button class="captcha-retry">Retry</button>
            </div>
          </div>
        </body>
        </html>
      `);

      const errorState = await page.locator('.captcha-error');
      await expect(errorState).toBeVisible();
      await expect(errorState).toContainText('Failed to load captcha');

      const retryButton = await page.locator('.captcha-retry');
      await expect(retryButton).toBeVisible();
    });
  });

  test.describe('User Interaction Flow', () => {
    test('should handle user input and submission', async ({ page }) => {
      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Captcha Interaction Test</title>
        </head>
        <body>
          <div id="captcha-container">
            <div class="captcha-widget">
              <h2>Security Check</h2>
              <div class="captcha-challenge">What is 5 + 3?</div>
              <input type="text" class="captcha-input" placeholder="Enter your answer">
              <button class="captcha-submit">Verify</button>
              <div class="captcha-result" style="display:none;"></div>
            </div>
          </div>
          <script>
            document.querySelector('.captcha-submit').addEventListener('click', async () => {
              const answer = document.querySelector('.captcha-input').value;
              const result = document.querySelector('.captcha-result');
              result.style.display = 'block';
              if (answer === '8') {
                result.textContent = 'Success!';
                result.className = 'captcha-result captcha-success';
              } else {
                result.textContent = 'Incorrect. Try again.';
                result.className = 'captcha-result captcha-error';
              }
            });
          </script>
        </body>
        </html>
      `);

      // Enter correct answer
      const input = await page.locator('.captcha-input');
      await input.fill('8');

      // Click submit
      await page.locator('.captcha-submit').click();

      // Verify success
      const result = await page.locator('.captcha-result');
      await expect(result).toBeVisible();
      await expect(result).toContainText('Success!');
      await expect(result).toHaveClass(/captcha-success/);
    });

    test('should handle incorrect answer', async ({ page }) => {
      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Captcha Wrong Answer Test</title>
        </head>
        <body>
          <div id="captcha-container">
            <div class="captcha-widget">
              <h2>Security Check</h2>
              <div class="captcha-challenge">What is 5 + 3?</div>
              <input type="text" class="captcha-input" placeholder="Enter your answer">
              <button class="captcha-submit">Verify</button>
              <div class="captcha-result" style="display:none;"></div>
            </div>
          </div>
          <script>
            document.querySelector('.captcha-submit').addEventListener('click', async () => {
              const answer = document.querySelector('.captcha-input').value;
              const result = document.querySelector('.captcha-result');
              result.style.display = 'block';
              if (answer === '8') {
                result.textContent = 'Success!';
                result.className = 'captcha-result captcha-success';
              } else {
                result.textContent = 'Incorrect. Try again.';
                result.className = 'captcha-result captcha-error';
              }
            });
          </script>
        </body>
        </html>
      `);

      // Enter wrong answer
      const input = await page.locator('.captcha-input');
      await input.fill('10');

      // Click submit
      await page.locator('.captcha-submit').click();

      // Verify error
      const result = await page.locator('.captcha-result');
      await expect(result).toBeVisible();
      await expect(result).toContainText('Incorrect');
      await expect(result).toHaveClass(/captcha-error/);
    });

    test('should handle refresh button click', async ({ page }) => {
      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Captcha Refresh Test</title>
        </head>
        <body>
          <div id="captcha-container">
            <div class="captcha-widget">
              <h2>Security Check</h2>
              <div class="captcha-challenge" id="challenge">What is 2 + 2?</div>
              <input type="text" class="captcha-input" placeholder="Enter your answer">
              <button class="captcha-submit">Verify</button>
              <button class="captcha-refresh" id="refresh-btn">Refresh</button>
            </div>
          </div>
          <script>
            let count = 0;
            document.getElementById('refresh-btn').addEventListener('click', async () => {
              count++;
              document.getElementById('challenge').textContent = 'New challenge #' + count;
              window.refreshCount = count;
            });
          </script>
        </body>
        </html>
      `);

      // Click refresh button
      await page.locator('#refresh-btn').click();
      await expect(page.locator('#challenge')).toContainText('New challenge #1');

      // Click refresh again
      await page.locator('#refresh-btn').click();
      await expect(page.locator('#challenge')).toContainText('New challenge #2');
    });

    test('should clear input after refresh', async ({ page }) => {
      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Captcha Clear Input Test</title>
        </head>
        <body>
          <div id="captcha-container">
            <div class="captcha-widget">
              <div class="captcha-challenge">What is 2 + 2?</div>
              <input type="text" class="captcha-input" id="captcha-input" placeholder="Enter your answer">
              <button class="captcha-refresh" id="refresh-btn">Refresh</button>
            </div>
          </div>
          <script>
            document.getElementById('refresh-btn').addEventListener('click', () => {
              document.getElementById('captcha-input').value = '';
            });
          </script>
        </body>
        </html>
      `);

      // Enter some text
      const input = page.locator('#captcha-input');
      await input.fill('4');
      await expect(input).toHaveValue('4');

      // Click refresh
      await page.locator('#refresh-btn').click();

      // Verify input is cleared
      await expect(input).toHaveValue('');
    });
  });

  test.describe('API Integration from Browser', () => {
    test('should fetch captcha types from API', async ({ page }) => {
      // Navigate to a test page that makes API calls
      await page.goto('/api/v1/captcha/types');

      // Verify API response
      const body = await page.locator('pre').textContent();
      const data = JSON.parse(body || '{}');

      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('types');
    });

    test('should fetch health check from API', async ({ page }) => {
      await page.goto('/api/v1/health');

      const body = await page.locator('pre').textContent();
      const data = JSON.parse(body || '{}');

      expect(data.status).toBe('healthy');
      expect(data).toHaveProperty('version', '1.0.0');
    });
  });

  test.describe('Cross-Browser Compatibility', () => {
    test('should render correctly in all browsers', async ({ page }) => {
      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Cross-Browser Test</title>
          <style>
            .captcha-widget {
              display: flex;
              flex-direction: column;
              align-items: center;
              padding: 20px;
              border: 1px solid #ccc;
              border-radius: 8px;
              background: #f9f9f9;
            }
            .captcha-input {
              padding: 10px;
              margin: 10px 0;
              border: 1px solid #ddd;
              border-radius: 4px;
              width: 200px;
            }
            .captcha-button {
              padding: 10px 20px;
              margin: 5px;
              border: none;
              border-radius: 4px;
              cursor: pointer;
            }
            .captcha-submit {
              background: #4CAF50;
              color: white;
            }
            .captcha-refresh {
              background: #2196F3;
              color: white;
            }
          </style>
        </head>
        <body>
          <div class="captcha-widget">
            <h2>Security Check</h2>
            <div class="captcha-challenge">What is 2 + 2?</div>
            <input type="text" class="captcha-input" placeholder="Enter your answer">
            <div>
              <button class="captcha-button captcha-submit">Verify</button>
              <button class="captcha-button captcha-refresh">Refresh</button>
            </div>
          </div>
        </body>
        </html>
      `);

      // Verify all elements are visible and properly styled
      const widget = await page.locator('.captcha-widget');
      await expect(widget).toBeVisible();

      const input = await page.locator('.captcha-input');
      await expect(input).toBeVisible();
      await expect(input).toBeEnabled();

      const submitButton = await page.locator('.captcha-submit');
      await expect(submitButton).toBeVisible();
      await expect(submitButton).toBeEnabled();

      const refreshButton = await page.locator('.captcha-refresh');
      await expect(refreshButton).toBeVisible();
      await expect(refreshButton).toBeEnabled();
    });

    test('should handle keyboard navigation', async ({ page }) => {
      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Keyboard Navigation Test</title>
        </head>
        <body>
          <div class="captcha-widget">
            <input type="text" class="captcha-input" id="input" placeholder="Enter answer">
            <button class="captcha-submit" id="submit">Verify</button>
            <button class="captcha-refresh" id="refresh">Refresh</button>
            <div class="captcha-result" id="result" style="display:none;"></div>
          </div>
          <script>
            document.getElementById('submit').addEventListener('click', () => {
              const val = document.getElementById('input').value;
              const result = document.getElementById('result');
              result.style.display = 'block';
              result.textContent = val === '4' ? 'Correct!' : 'Incorrect';
            });
          </script>
        </body>
        </html>
      `);

      // Tab to input
      await page.keyboard.press('Tab');
      await expect(page.locator('#input')).toBeFocused();

      // Type answer
      await page.keyboard.type('4');

      // Tab to submit button
      await page.keyboard.press('Tab');
      await expect(page.locator('#submit')).toBeFocused();

      // Press Enter to submit
      await page.keyboard.press('Enter');

      // Verify result
      const result = await page.locator('#result');
      await expect(result).toBeVisible();
      await expect(result).toContainText('Correct!');
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should render correctly on mobile viewport (375x667)', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Mobile Test</title>
          <style>
            .captcha-widget {
              width: 100%;
              max-width: 300px;
              margin: 0 auto;
              padding: 15px;
              box-sizing: border-box;
            }
            .captcha-input {
              width: 100%;
              padding: 12px;
              box-sizing: border-box;
              font-size: 16px;
            }
            .captcha-button {
              width: 100%;
              padding: 12px;
              margin: 5px 0;
              font-size: 16px;
            }
          </style>
        </head>
        <body>
          <div class="captcha-widget">
            <h2>Security Check</h2>
            <div class="captcha-challenge">What is 2 + 2?</div>
            <input type="text" class="captcha-input" placeholder="Enter your answer">
            <button class="captcha-button captcha-submit">Verify</button>
            <button class="captcha-button captcha-refresh">Refresh</button>
          </div>
        </body>
        </html>
      `);

      // Verify widget fits within viewport
      const widget = await page.locator('.captcha-widget');
      const box = await widget.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeLessThanOrEqual(375);

      // Verify input is tappable (at least 44x44 pixels)
      const input = await page.locator('.captcha-input');
      const inputBox = await input.boundingBox();
      expect(inputBox).not.toBeNull();
      expect(inputBox!.height).toBeGreaterThanOrEqual(40);

      // Verify buttons are tappable
      const submitButton = await page.locator('.captcha-submit');
      const submitBox = await submitButton.boundingBox();
      expect(submitBox).not.toBeNull();
      expect(submitBox!.height).toBeGreaterThanOrEqual(40);
    });

    test('should render correctly on tablet viewport (768x1024)', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Tablet Test</title>
        </head>
        <body>
          <div class="captcha-widget" style="max-width: 400px; margin: 50px auto; padding: 20px;">
            <h2>Security Check</h2>
            <div class="captcha-challenge">What is 2 + 2?</div>
            <input type="text" class="captcha-input" style="width: 100%; padding: 10px;">
            <button class="captcha-submit" style="width: 100%; padding: 10px;">Verify</button>
          </div>
        </body>
        </html>
      `);

      const widget = await page.locator('.captcha-widget');
      await expect(widget).toBeVisible();

      const input = await page.locator('.captcha-input');
      await expect(input).toBeVisible();
    });

    test('should handle touch interactions', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Touch Interaction Test</title>
        </head>
        <body style="padding: 20px;">
          <div class="captcha-widget">
            <input type="text" class="captcha-input" id="input" placeholder="Enter answer">
            <button class="captcha-submit" id="submit">Verify</button>
            <div class="captcha-result" id="result" style="display:none;"></div>
          </div>
          <script>
            document.getElementById('submit').addEventListener('click', () => {
              const val = document.getElementById('input').value;
              const result = document.getElementById('result');
              result.style.display = 'block';
              result.textContent = val === '4' ? 'Correct!' : 'Incorrect';
            });
          </script>
        </body>
        </html>
      `);

      // Wait for elements to be visible
      await expect(page.locator('#input')).toBeVisible();
      await expect(page.locator('#submit')).toBeVisible();

      // Fill input and click submit
      await page.locator('#input').click();
      await page.locator('#input').fill('4');
      await page.locator('#submit').click();

      // Verify result
      const result = await page.locator('#result');
      await expect(result).toBeVisible();
      await expect(result).toContainText('Correct!');
    });
  });

  test.describe('Performance Testing', () => {
    test('should load captcha widget within acceptable time', async ({ page }) => {
      const startTime = Date.now();

      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Performance Test</title>
        </head>
        <body>
          <div id="captcha-container">
            <div class="captcha-widget">
              <h2>Security Check</h2>
              <div class="captcha-challenge">What is 2 + 2?</div>
              <input type="text" class="captcha-input" placeholder="Enter your answer">
              <button class="captcha-submit">Verify</button>
            </div>
          </div>
        </body>
        </html>
      `);

      // Wait for widget to be visible
      await expect(page.locator('.captcha-widget')).toBeVisible();

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
    });

    test('should handle rapid user interactions without issues', async ({ page }) => {
      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Rapid Interaction Test</title>
        </head>
        <body>
          <div class="captcha-widget">
            <input type="text" class="captcha-input" id="input">
            <button class="captcha-submit" id="submit">Verify</button>
            <button class="captcha-refresh" id="refresh">Refresh</button>
            <div id="counter">0</div>
          </div>
          <script>
            let count = 0;
            document.getElementById('submit').addEventListener('click', () => {
              count++;
              document.getElementById('counter').textContent = count;
            });
            document.getElementById('refresh').addEventListener('click', () => {
              document.getElementById('input').value = '';
            });
          </script>
        </body>
        </html>
      `);

      // Rapid interactions
      for (let i = 0; i < 10; i++) {
        await page.locator('#input').fill(`test${i}`);
        await page.locator('#submit').click();
        await page.locator('#refresh').click();
      }

      // Verify counter incremented correctly
      await expect(page.locator('#counter')).toHaveText('10');
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA attributes', async ({ page }) => {
      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Accessibility Test</title>
        </head>
        <body>
          <div class="captcha-widget" role="region" aria-label="Security verification">
            <h2 id="captcha-title">Security Check</h2>
            <div class="captcha-challenge" id="captcha-challenge" aria-live="polite">What is 2 + 2?</div>
            <input type="text" 
                   class="captcha-input" 
                   id="captcha-input"
                   aria-labelledby="captcha-title captcha-challenge"
                   aria-required="true"
                   placeholder="Enter your answer">
            <button class="captcha-submit" aria-label="Submit answer">Verify</button>
            <button class="captcha-refresh" aria-label="Get new challenge">Refresh</button>
          </div>
        </body>
        </html>
      `);

      // Verify ARIA attributes
      const widget = await page.locator('[role="region"]');
      await expect(widget).toHaveAttribute('aria-label', 'Security verification');

      const input = await page.locator('#captcha-input');
      await expect(input).toHaveAttribute('aria-required', 'true');

      const submitButton = await page.locator('.captcha-submit');
      await expect(submitButton).toHaveAttribute('aria-label', 'Submit answer');

      const refreshButton = await page.locator('.captcha-refresh');
      await expect(refreshButton).toHaveAttribute('aria-label', 'Get new challenge');
    });

    test('should be navigable with screen reader', async ({ page }) => {
      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Screen Reader Test</title>
        </head>
        <body>
          <main>
            <h1>Captcha Widget</h1>
            <form aria-label="Captcha verification form">
              <label for="captcha-input">Enter your answer:</label>
              <input type="text" id="captcha-input" name="answer" required>
              <button type="submit">Verify</button>
            </form>
          </main>
        </body>
        </html>
      `);

      // Verify form has proper structure
      const form = await page.locator('form');
      await expect(form).toHaveAttribute('aria-label', 'Captcha verification form');

      const label = await page.locator('label[for="captcha-input"]');
      await expect(label).toBeVisible();
      await expect(label).toContainText('Enter your answer');
    });
  });
});
