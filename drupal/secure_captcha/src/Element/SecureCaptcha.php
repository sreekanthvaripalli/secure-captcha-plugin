<?php

namespace Drupal\secure_captcha\Element;

use Drupal\Core\Render\Element\FormElement;
use Drupal\Core\Form\FormStateInterface;

/**
 * Provides a Secure CAPTCHA form element.
 *
 * @FormElement("secure_captcha")
 */
class SecureCaptcha extends FormElement {

  /**
   * {@inheritdoc}
   */
  public function getInfo() {
    $class = get_class($this);
    return [
      '#input' => TRUE,
      '#type' => 'secure_captcha',
      '#captcha_type' => 'text',
      '#difficulty' => 'medium',
      '#process' => [
        [$class, 'processCaptcha'],
      ],
      '#element_validate' => [
        [$class, 'validateCaptcha'],
      ],
      '#theme' => 'secure_captcha_element',
      '#attached' => [
        'library' => ['secure_captcha/drupal.secure_captcha'],
      ],
    ];
  }

  /**
   * Processes the CAPTCHA element.
   *
   * @param array $element
   *   The form element.
   * @param \Drupal\Core\Form\FormStateInterface $form_state
   *   The form state.
   * @param array $complete_form
   *   The complete form.
   *
   * @return array
   *   The processed element.
   */
  public static function processCaptcha(array &$element, FormStateInterface $form_state, array &$complete_form) {
    $element['#attributes']['class'][] = 'secure-captcha-widget';
    $element['#attributes']['data-captcha-type'] = $element['#captcha_type'];
    $element['#attributes']['data-difficulty'] = $element['#difficulty'];

    $element['challenge'] = [
      '#type' => 'container',
      '#attributes' => ['class' => ['secure-captcha-challenge']],
      '#markup' => '<span class="secure-captcha-loading">' . t('Loading CAPTCHA...') . '</span>',
    ];

    $element['session_id'] = [
      '#type' => 'hidden',
      '#attributes' => ['class' => ['secure-captcha-session']],
    ];

    $element['response'] = [
      '#type' => 'textfield',
      '#title' => t('CAPTCHA'),
      '#required' => TRUE,
      '#attributes' => [
        'class' => ['secure-captcha-input'],
        'placeholder' => t('Enter CAPTCHA'),
      ],
    ];

    $element['refresh'] = [
      '#type' => 'button',
      '#value' => '↻',
      '#attributes' => [
        'class' => ['secure-captcha-refresh'],
        'title' => t('Refresh CAPTCHA'),
      ],
      '#limit_validation_errors' => [],
      '#submit' => [],
    ];

    $element['error'] = [
      '#type' => 'container',
      '#attributes' => ['class' => ['secure-captcha-error']],
      '#markup' => '',
    ];

    return $element;
  }

  /**
   * Validates the CAPTCHA element.
   *
   * @param array $element
   *   The form element.
   * @param \Drupal\Core\Form\FormStateInterface $form_state
   *   The form state.
   */
  public static function validateCaptcha(array $element, FormStateInterface $form_state) {
    $session_id = $element['session_id']['#value'] ?? '';
    $response = $element['response']['#value'] ?? '';
    $type = $element['#captcha_type'] ?? 'text';

    if (empty($session_id) || empty($response)) {
      $form_state->setError($element, t('Please complete the CAPTCHA.'));
      return;
    }

    // Validate via API.
    $captcha_service = \Drupal::service('secure_captcha.service');
    $valid = $captcha_service->validateCaptcha($session_id, $response, $type);

    if (!$valid) {
      $form_state->setError($element, t('The CAPTCHA response was incorrect. Please try again.'));
    }
  }

}