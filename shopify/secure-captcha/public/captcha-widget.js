/**
 * Secure CAPTCHA - Shopify Checkout Integration
 * 
 * This script is injected into Shopify stores via Script Tags API.
 * It adds CAPTCHA protection to checkout, contact, and account forms.
 */

(function() {
  'use strict';

  const CONFIG = {
    apiUrl: window.SECURE_CAPTCHA_API_URL || '/apps/secure-captcha/api',
    captchaType: window.SECURE_CAPTCHA_TYPE || 'text',
    difficulty: window.SECURE_CAPTCHA_DIFFICULTY || 'medium',
    protectedForms: window.SECURE_CAPTCHA_PROTECTED_FORMS || ['checkout', 'contact', 'account'],
  };

  /**
   * Creates CAPTCHA widget HTML
   */
  function createCaptchaWidget(container) {
    const widget = document.createElement('div');
    widget.className = 'secure-captcha-widget';
    widget.innerHTML = `
      <div class="secure-captcha-challenge">Loading CAPTCHA...</div>
      <input type="text" class="secure-captcha-input" placeholder="Enter CAPTCHA" required>
      <input type="hidden" class="secure-captcha-session" name="captcha_session_id" value="">
      <input type="hidden" class="secure-captcha-response" name="captcha_response" value="">
      <button type="button" class="secure-captcha-refresh" title="Refresh CAPTCHA">↻</button>
      <div class="secure-captcha-error" style="display: none; color: #d72c0d;"></div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .secure-captcha-widget {
        max-width: 300px;
        padding: 16px;
        background: #ffffff;
        border: 1px solid #e1e3e5;
        border-radius: 8px;
        margin: 16px 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .secure-captcha-challenge {
        padding: 12px;
        background: #f6f6f7;
        border-radius: 6px;
        margin-bottom: 12px;
        text-align: center;
        font-family: monospace;
        font-size: 16px;
        font-weight: bold;
        letter-spacing: 2px;
        color: #202223;
        min-height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .secure-captcha-input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #e1e3e5;
        border-radius: 6px;
        font-size: 14px;
        margin-bottom: 8px;
        box-sizing: border-box;
      }
      .secure-captcha-input:focus {
        border-color: #008060;
        outline: none;
        box-shadow: 0 0 0 2px rgba(0, 128, 96, 0.2);
      }
      .secure-captcha-refresh {
        position: absolute;
        right: 8px;
        top: 8px;
        background: none;
        border: none;
        cursor: pointer;
        font-size: 16px;
        color: #6d7175;
        padding: 4px 8px;
      }
      .secure-captcha-refresh:hover {
        color: #008060;
      }
      .secure-captcha-error {
        font-size: 12px;
        margin-top: 4px;
      }
    `;
    document.head.appendChild(style);

    // Bind refresh button
    const refreshBtn = widget.querySelector('.secure-captcha-refresh');
    refreshBtn.addEventListener('click', function() {
      generateCaptcha(widget);
    });

    // Generate initial CAPTCHA
    generateCaptcha(widget);

    container.appendChild(widget);
    return widget;
  }

  /**
   * Generates a new CAPTCHA from the API
   */
  async function generateCaptcha(widget) {
    const challenge = widget.querySelector('.secure-captcha-challenge');
    const sessionId = widget.querySelector('.secure-captcha-session');
    const input = widget.querySelector('.secure-captcha-input');

    challenge.textContent = 'Loading...';
    input.disabled = true;

    try {
      const response = await fetch(`${CONFIG.apiUrl}/captcha/generate?type=${CONFIG.captchaType}&difficulty=${CONFIG.difficulty}`);
      const data = await response.json();

      if (data.success) {
        challenge.textContent = data.challenge;
        sessionId.value = data.sessionId;
        input.disabled = false;
        input.value = '';
      } else {
        challenge.textContent = 'Failed to load CAPTCHA';
      }
    } catch (error) {
      challenge.textContent = 'Failed to load CAPTCHA';
      console.error('CAPTCHA generation error:', error);
    }
  }

  /**
   * Validates CAPTCHA response
   */
  async function validateCaptcha(widget) {
    const sessionId = widget.querySelector('.secure-captcha-session').value;
    const response = widget.querySelector('.secure-captcha-input').value;
    const errorEl = widget.querySelector('.secure-captcha-error');

    if (!sessionId || !response) {
      showError(errorEl, 'Please complete the CAPTCHA.');
      return false;
    }

    try {
      const res = await fetch(`${CONFIG.apiUrl}/captcha/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          response,
          type: CONFIG.captchaType,
        }),
      });

      const data = await res.json();

      if (data.valid) {
        errorEl.style.display = 'none';
        return true;
      } else {
        showError(errorEl, 'Incorrect CAPTCHA. Please try again.');
        generateCaptcha(widget);
        return false;
      }
    } catch (error) {
      showError(errorEl, 'CAPTCHA validation failed. Please try again.');
      return false;
    }
  }

  /**
   * Shows error message
   */
  function showError(element, message) {
    element.textContent = message;
    element.style.display = 'block';
  }

  /**
   * Finds forms to protect
   */
  function findProtectedForms() {
    const forms = [];

    // Checkout form
    if (CONFIG.protectedForms.includes('checkout')) {
      const checkoutForm = document.querySelector('form[action*="checkout"]');
      if (checkoutForm) forms.push(checkoutForm);
    }

    // Contact form
    if (CONFIG.protectedForms.includes('contact')) {
      const contactForm = document.querySelector('form[action*="contact"]');
      if (contactForm) forms.push(contactForm);
    }

    // Account creation form
    if (CONFIG.protectedForms.includes('account')) {
      const accountForm = document.querySelector('form[action*="account"], form[action*="register"]');
      if (accountForm) forms.push(accountForm);
    }

    return forms;
  }

  /**
   * Initializes CAPTCHA on page load
   */
  function init() {
    const forms = findProtectedForms();

    forms.forEach(function(form) {
      // Create CAPTCHA widget
      const widget = createCaptchaWidget(form);

      // Add validation on form submit
      form.addEventListener('submit', async function(e) {
        const isValid = await validateCaptcha(widget);
        if (!isValid) {
          e.preventDefault();
        }
      });
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();