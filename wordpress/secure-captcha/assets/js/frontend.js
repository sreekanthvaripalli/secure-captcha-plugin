/**
 * Secure CAPTCHA - Frontend JavaScript
 */

(function() {
    'use strict';

    /**
     * Secure CAPTCHA Widget Class
     */
    class SecureCaptchaWidget {
        constructor(element) {
            this.element = element;
            this.sessionId = null;
            this.challenge = null;
            this.isLoading = false;

            // Find elements
            this.challengeEl = element.querySelector('.secure-captcha-challenge');
            this.inputEl = element.querySelector('.secure-captcha-input');
            this.sessionEl = element.querySelector('.secure-captcha-session');
            this.responseEl = element.querySelector('.secure-captcha-response');
            this.refreshBtn = element.querySelector('.secure-captcha-refresh');
            this.errorEl = element.querySelector('.secure-captcha-error');

            // Get configuration
            this.type = element.dataset.type || 'text';
            this.difficulty = element.dataset.difficulty || 'medium';
            this.theme = element.dataset.theme || 'light';

            // Apply theme
            if (this.theme === 'dark') {
                element.classList.add('dark');
            }

            // Bind events
            this.bindEvents();

            // Generate initial CAPTCHA
            this.generate();
        }

        /**
         * Bind event listeners
         */
        bindEvents() {
            // Refresh button
            if (this.refreshBtn) {
                this.refreshBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.refresh();
                });
            }

            // Input change
            if (this.inputEl) {
                this.inputEl.addEventListener('input', () => {
                    this.responseEl.value = this.inputEl.value;
                    this.clearError();
                });
            }
        }

        /**
         * Generate new CAPTCHA
         */
        async generate() {
            if (this.isLoading) return;

            this.isLoading = true;
            this.showLoading();
            this.clearError();

            try {
                const response = await fetch(secureCaptchaConfig.ajaxUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        action: 'secure_captcha_generate',
                        nonce: secureCaptchaConfig.nonce,
                        type: this.type,
                        difficulty: this.difficulty,
                    }),
                });

                const data = await response.json();

                if (data.success) {
                    this.sessionId = data.data.sessionId;
                    this.challenge = data.data.challenge;
                    this.sessionEl.value = this.sessionId;
                    this.showChallenge(this.challenge);
                } else {
                    this.showError(data.data || 'Failed to generate CAPTCHA');
                }
            } catch (error) {
                this.showError('Network error. Please try again.');
                console.error('Secure CAPTCHA:', error);
            } finally {
                this.isLoading = false;
                this.hideLoading();
            }
        }

        /**
         * Validate CAPTCHA response
         */
        async validate() {
            if (!this.sessionId || !this.inputEl.value) {
                this.showError('Please enter the CAPTCHA text');
                return false;
            }

            this.isLoading = true;
            this.showLoading();
            this.clearError();

            try {
                const response = await fetch(secureCaptchaConfig.ajaxUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        action: 'secure_captcha_validate',
                        nonce: secureCaptchaConfig.nonce,
                        sessionId: this.sessionId,
                        response: this.inputEl.value,
                        type: this.type,
                    }),
                });

                const data = await response.json();

                if (data.success && data.data.valid) {
                    this.showSuccess();
                    return true;
                } else {
                    this.showError(data.data?.message || 'Invalid CAPTCHA response');
                    // Generate new CAPTCHA on failure
                    await this.generate();
                    this.inputEl.value = '';
                    this.responseEl.value = '';
                    return false;
                }
            } catch (error) {
                this.showError('Network error. Please try again.');
                console.error('Secure CAPTCHA:', error);
                return false;
            } finally {
                this.isLoading = false;
                this.hideLoading();
            }
        }

        /**
         * Refresh CAPTCHA
         */
        refresh() {
            this.inputEl.value = '';
            this.responseEl.value = '';
            this.generate();
        }

        /**
         * Show challenge
         */
        showChallenge(text) {
            if (this.challengeEl) {
                this.challengeEl.textContent = text;
            }
        }

        /**
         * Show loading state
         */
        showLoading() {
            if (this.challengeEl) {
                this.challengeEl.classList.add('loading');
            }
            if (this.inputEl) {
                this.inputEl.disabled = true;
            }
        }

        /**
         * Hide loading state
         */
        hideLoading() {
            if (this.challengeEl) {
                this.challengeEl.classList.remove('loading');
            }
            if (this.inputEl) {
                this.inputEl.disabled = false;
            }
        }

        /**
         * Show error message
         */
        showError(message) {
            if (this.errorEl) {
                this.errorEl.textContent = message;
                this.errorEl.style.display = 'block';
            }
            if (this.inputEl) {
                this.inputEl.classList.add('error');
            }
        }

        /**
         * Clear error message
         */
        clearError() {
            if (this.errorEl) {
                this.errorEl.textContent = '';
                this.errorEl.style.display = 'none';
            }
            if (this.inputEl) {
                this.inputEl.classList.remove('error');
            }
        }

        /**
         * Show success message
         */
        showSuccess() {
            if (this.errorEl) {
                this.errorEl.textContent = '✓ Verified successfully!';
                this.errorEl.style.color = '#22c55e';
                this.errorEl.style.display = 'block';
            }
        }

        /**
         * Get session ID
         */
        getSessionId() {
            return this.sessionId;
        }

        /**
         * Get response value
         */
        getResponse() {
            return this.inputEl ? this.inputEl.value : '';
        }
    }

    /**
     * Initialize all CAPTCHA widgets on page load
     */
    function initWidgets() {
        const widgets = document.querySelectorAll('.secure-captcha-widget');
        widgets.forEach((el) => {
            if (!el.dataset.initialized) {
                el.dataset.initialized = 'true';
                new SecureCaptchaWidget(el);
            }
        });
    }

    /**
     * Initialize on DOM ready
     */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWidgets);
    } else {
        initWidgets();
    }

    /**
     * Expose to global scope for form integrations
     */
    window.SecureCaptchaWidget = SecureCaptchaWidget;
    window.initSecureCaptchaWidgets = initWidgets;

    /**
     * jQuery integration (if available)
     */
    if (typeof jQuery !== 'undefined') {
        jQuery.fn.secureCaptcha = function() {
            return this.each(function() {
                new SecureCaptchaWidget(this);
            });
        };
    }
})();