<?php

namespace Drupal\secure_captcha\Form;

use Drupal\Core\Form\ConfigFormBase;
use Drupal\Core\Form\FormStateInterface;

/**
 * Settings form for Secure CAPTCHA.
 */
class SecureCaptchaSettingsForm extends ConfigFormBase {

  /**
   * {@inheritdoc}
   */
  protected function getEditableConfigNames() {
    return ['secure_captcha.settings'];
  }

  /**
   * {@inheritdoc}
   */
  public function getFormId() {
    return 'secure_captcha_settings_form';
  }

  /**
   * {@inheritdoc}
   */
  public function buildForm(array $form, FormStateInterface $form_state) {
    $config = $this->config('secure_captcha.settings');

    $form['general'] = [
      '#type' => 'details',
      '#title' => $this->t('General Settings'),
      '#open' => TRUE,
    ];

    $form['general']['enabled'] = [
      '#type' => 'checkbox',
      '#title' => $this->t('Enable Secure CAPTCHA'),
      '#default_value' => $config->get('enabled') ?: FALSE,
      '#description' => $this->t('When enabled, CAPTCHA protection will be applied to selected forms.'),
    ];

    $form['general']['captcha_type'] = [
      '#type' => 'select',
      '#title' => $this->t('CAPTCHA Type'),
      '#default_value' => $config->get('captcha_type') ?: 'text',
      '#options' => [
        'text' => $this->t('Text'),
        'math' => $this->t('Math'),
        'logic' => $this->t('Logic'),
        'image' => $this->t('Image'),
      ],
      '#description' => $this->t('Select the type of CAPTCHA to display.'),
    ];

    $form['general']['difficulty'] = [
      '#type' => 'select',
      '#title' => $this->t('Difficulty Level'),
      '#default_value' => $config->get('difficulty') ?: 'medium',
      '#options' => [
        'easy' => $this->t('Easy'),
        'medium' => $this->t('Medium'),
        'hard' => $this->t('Hard'),
      ],
    ];

    $form['api'] = [
      '#type' => 'details',
      '#title' => $this->t('API Configuration'),
      '#open' => TRUE,
    ];

    $form['api']['api_url'] = [
      '#type' => 'url',
      '#title' => $this->t('API URL'),
      '#default_value' => $config->get('api_url') ?: 'http://localhost:3000/api/v1/captcha',
      '#description' => $this->t('The base URL of the Secure CAPTCHA API server.'),
      '#required' => TRUE,
    ];

    $form['api']['api_key'] = [
      '#type' => 'textfield',
      '#title' => $this->t('API Key'),
      '#default_value' => $config->get('api_key') ?: '',
      '#description' => $this->t('Optional API key for authentication.'),
    ];

    $form['forms'] = [
      '#type' => 'details',
      '#title' => $this->t('Protected Forms'),
      '#open' => TRUE,
    ];

    $form['forms']['protected_forms'] = [
      '#type' => 'checkboxes',
      '#title' => $this->t('Select forms to protect'),
      '#options' => [
        'user_login_form' => $this->t('User Login Form'),
        'user_register_form' => $this->t('User Registration Form'),
        'user_pass' => $this->t('Password Reset Form'),
        'comment_comment_form' => $this->t('Comment Form'),
        'contact_message_feedback_form' => $this->t('Contact Form'),
      ],
      '#default_value' => $config->get('protected_forms') ?: [],
      '#description' => $this->t('Select which forms should be protected with CAPTCHA.'),
    ];

    return parent::buildForm($form, $form_state);
  }

  /**
   * {@inheritdoc}
   */
  public function validateForm(array &$form, FormStateInterface $form_state) {
    $api_url = $form_state->getValue('api_url');
    if (!filter_var($api_url, FILTER_VALIDATE_URL)) {
      $form_state->setErrorByName('api_url', $this->t('Please enter a valid URL.'));
    }
  }

  /**
   * {@inheritdoc}
   */
  public function submitForm(array &$form, FormStateInterface $form_state) {
    $values = $form_state->getValues();

    // Filter out unchecked forms.
    $protected_forms = array_filter($values['protected_forms']);

    $this->config('secure_captcha.settings')
      ->set('enabled', $values['enabled'])
      ->set('captcha_type', $values['captcha_type'])
      ->set('difficulty', $values['difficulty'])
      ->set('api_url', $values['api_url'])
      ->set('api_key', $values['api_key'])
      ->set('protected_forms', $protected_forms)
      ->save();

    parent::submitForm($form, $form_state);
    $this->messenger()->addStatus($this->t('Secure CAPTCHA settings have been saved.'));
  }

}