<?php

namespace Drupal\secure_captcha\Plugin\Block;

use Drupal\Core\Block\BlockBase;
use Drupal\Core\Form\FormStateInterface;
use Drupal\Core\Plugin\ContainerFactoryPluginInterface;
use Drupal\secure_captcha\SecureCaptchaService;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * Provides a Secure CAPTCHA block.
 *
 * @Block(
 *   id = "secure_captcha_block",
 *   admin_label = @Translation("Secure CAPTCHA"),
 *   category = @Translation("Forms")
 * )
 */
class SecureCaptchaBlock extends BlockBase implements ContainerFactoryPluginInterface {

  /**
   * The Secure CAPTCHA service.
   *
   * @var \Drupal\secure_captcha\SecureCaptchaService
   */
  protected $captchaService;

  /**
   * Constructs a new SecureCaptchaBlock.
   *
   * @param array $configuration
   *   A configuration array containing information about the plugin instance.
   * @param string $plugin_id
   *   The plugin_id for the plugin instance.
   * @param mixed $plugin_definition
   *   The plugin implementation definition.
   * @param \Drupal\secure_captcha\SecureCaptchaService $captcha_service
   *   The Secure CAPTCHA service.
   */
  public function __construct(
    array $configuration,
    $plugin_id,
    $plugin_definition,
    SecureCaptchaService $captcha_service
  ) {
    parent::__construct($configuration, $plugin_id, $plugin_definition);
    $this->captchaService = $captcha_service;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container, array $configuration, $plugin_id, $plugin_definition) {
    return new static(
      $configuration,
      $plugin_id,
      $plugin_definition,
      $container->get('secure_captcha.service')
    );
  }

  /**
   * {@inheritdoc}
   */
  public function blockForm($form, FormStateInterface $form_state) {
    $form = parent::blockForm($form, $form_state);
    $config = $this->getConfiguration();

    $form['captcha_type'] = [
      '#type' => 'select',
      '#title' => $this->t('CAPTCHA Type'),
      '#default_value' => $config['captcha_type'] ?? 'text',
      '#options' => [
        'text' => $this->t('Text'),
        'math' => $this->t('Math'),
        'logic' => $this->t('Logic'),
        'image' => $this->t('Image'),
      ],
    ];

    $form['difficulty'] = [
      '#type' => 'select',
      '#title' => $this->t('Difficulty Level'),
      '#default_value' => $config['difficulty'] ?? 'medium',
      '#options' => [
        'easy' => $this->t('Easy'),
        'medium' => $this->t('Medium'),
        'hard' => $this->t('Hard'),
      ],
    ];

    return $form;
  }

  /**
   * {@inheritdoc}
   */
  public function blockSubmit($form, FormStateInterface $form_state) {
    parent::blockSubmit($form, $form_state);
    $this->setConfigurationValue('captcha_type', $form_state->getValue('captcha_type'));
    $this->setConfigurationValue('difficulty', $form_state->getValue('difficulty'));
  }

  /**
   * {@inheritdoc}
   */
  public function build() {
    $config = $this->getConfiguration();
    $captcha_type = $config['captcha_type'] ?? 'text';
    $difficulty = $config['difficulty'] ?? 'medium';

    return [
      '#type' => 'secure_captcha',
      '#captcha_type' => $captcha_type,
      '#difficulty' => $difficulty,
    ];
  }

}