/**
 * @file
 * Secure CAPTCHA JavaScript functionality.
 */

(function ($, Drupal, drupalSettings) {

  'use strict';

  /**
   * Behavior to initialize Secure CAPTCHA on forms.
   */
  Drupal.behaviors.secureCaptcha = {
    attach: function (context, settings) {
      // Process each CAPTCHA widget once.
      once('secureCaptcha', '.secure-captcha-widget', context).forEach(function (element) {
        var $widget = $(element);
        var captchaType = $widget.data('captcha-type') || 'text';
        var difficulty = $widget.data('difficulty') || 'medium';

        // Generate initial CAPTCHA.
        generateCaptcha($widget, captchaType, difficulty);

        // Bind refresh button.
        $widget.find('.secure-captcha-refresh').on('click', function (e) {
          e.preventDefault();
          generateCaptcha($widget, captchaType, difficulty);
        });
      });
    }
  };

  /**
   * Generates a new CAPTCHA from the API.
   *
   * @param {jQuery} $widget
   *   The CAPTCHA widget element.
   * @param {string} type
   *   The CAPTCHA type.
   * @param {string} difficulty
   *   The difficulty level.
   */
  function generateCaptcha($widget, type, difficulty) {
    var $challenge = $widget.find('.secure-captcha-challenge');
    var $sessionId = $widget.find('.secure-captcha-session');
    var $input = $widget.find('.secure-captcha-input');

    // Show loading state.
    $challenge.html('<span class="secure-captcha-loading">' + Drupal.t('Loading...') + '</span>');
    $input.prop('disabled', true);

    $.ajax({
      url: Drupal.url('secure-captcha/generate'),
      type: 'GET',
      data: {
        type: type,
        difficulty: difficulty
      },
      dataType: 'json',
      success: function (response) {
        if (response.success) {
          $challenge.text(response.challenge);
          $sessionId.val(response.sessionId);
          $input.prop('disabled', false).val('');
        }
        else {
          $challenge.text(Drupal.t('Failed to load CAPTCHA.'));
        }
      },
      error: function () {
        $challenge.text(Drupal.t('Failed to load CAPTCHA.'));
      }
    });
  }

})(jQuery, Drupal, drupalSettings);