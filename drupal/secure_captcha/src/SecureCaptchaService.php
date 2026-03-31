<?php

namespace Drupal\secure_captcha;

use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use Drupal\Core\StringTranslation\StringTranslationTrait;
use GuzzleHttp\ClientInterface;
use GuzzleHttp\Exception\RequestException;

/**
 * Service for interacting with the Secure CAPTCHA API.
 */
class SecureCaptchaService {

  use StringTranslationTrait;

  /**
   * The HTTP client.
   *
   * @var \GuzzleHttp\ClientInterface
   */
  protected $httpClient;

  /**
   * The config factory.
   *
   * @var \Drupal\Core\Config\ConfigFactoryInterface
   */
  protected $configFactory;

  /**
   * The logger factory.
   *
   * @var \Drupal\Core\Logger\LoggerChannelFactoryInterface
   */
  protected $loggerFactory;

  /**
   * Constructs a new SecureCaptchaService.
   *
   * @param \GuzzleHttp\ClientInterface $http_client
   *   The HTTP client.
   * @param \Drupal\Core\Config\ConfigFactoryInterface $config_factory
   *   The config factory.
   * @param \Drupal\Core\Logger\LoggerChannelFactoryInterface $logger_factory
   *   The logger factory.
   */
  public function __construct(
    ClientInterface $http_client,
    ConfigFactoryInterface $config_factory,
    LoggerChannelFactoryInterface $logger_factory
  ) {
    $this->httpClient = $http_client;
    $this->configFactory = $config_factory;
    $this->loggerFactory = $logger_factory;
  }

  /**
   * Gets the module configuration.
   *
   * @return \Drupal\Core\Config\ImmutableConfig
   *   The configuration object.
   */
  public function getConfig() {
    return $this->configFactory->get('secure_captcha.settings');
  }

  /**
   * Generates a new CAPTCHA.
   *
   * @param string $type
   *   The CAPTCHA type (text, math, logic, image).
   * @param string $difficulty
   *   The difficulty level (easy, medium, hard).
   *
   * @return array
   *   The CAPTCHA response with sessionId and challenge.
   *
   * @throws \Exception
   *   If the API request fails.
   */
  public function generateCaptcha($type = 'text', $difficulty = 'medium') {
    $config = $this->getConfig();
    $api_url = $config->get('api_url') ?: 'http://localhost:3000/api/v1/captcha';

    try {
      $response = $this->httpClient->post(rtrim($api_url, '/') . '/generate', [
        'json' => [
          'type' => $type ?: $config->get('captcha_type'),
          'difficulty' => $difficulty ?: $config->get('difficulty'),
        ],
        'timeout' => 30,
      ]);

      $data = json_decode($response->getBody(), TRUE);

      if (isset($data['sessionId']) && isset($data['challenge'])) {
        return $data;
      }

      throw new \Exception($this->t('Invalid CAPTCHA response from API.'));
    }
    catch (RequestException $e) {
      $this->loggerFactory->get('secure_captcha')->error(
        'Failed to generate CAPTCHA: @message',
        ['@message' => $e->getMessage()]
      );
      throw new \Exception($this->t('Failed to generate CAPTCHA. Please try again later.'));
    }
  }

  /**
   * Validates a CAPTCHA response.
   *
   * @param string $session_id
   *   The CAPTCHA session ID.
   * @param string $response
   *   The user's CAPTCHA response.
   * @param string $type
   *   The CAPTCHA type.
   *
   * @return bool
   *   TRUE if valid, FALSE otherwise.
   */
  public function validateCaptcha($session_id, $response, $type = 'text') {
    $config = $this->getConfig();
    $api_url = $config->get('api_url') ?: 'http://localhost:3000/api/v1/captcha';

    try {
      $http_response = $this->httpClient->post(rtrim($api_url, '/') . '/validate', [
        'json' => [
          'sessionId' => $session_id,
          'response' => $response,
          'type' => $type,
        ],
        'timeout' => 30,
      ]);

      $data = json_decode($http_response->getBody(), TRUE);

      if (isset($data['valid'])) {
        return (bool) $data['valid'];
      }

      return FALSE;
    }
    catch (RequestException $e) {
      $this->loggerFactory->get('secure_captcha')->error(
        'Failed to validate CAPTCHA: @message',
        ['@message' => $e->getMessage()]
      );
      return FALSE;
    }
  }

  /**
   * Checks if CAPTCHA is enabled for a specific form.
   *
   * @param string $form_id
   *   The form ID to check.
   *
   * @return bool
   *   TRUE if CAPTCHA should be shown for this form.
   */
  public function isEnabledForForm($form_id) {
    $config = $this->getConfig();

    if (!$config->get('enabled')) {
      return FALSE;
    }

    $protected_forms = $config->get('protected_forms') ?: [];
    return in_array($form_id, $protected_forms);
  }

  /**
   * Gets the CAPTCHA type from configuration.
   *
   * @return string
   *   The CAPTCHA type.
   */
  public function getCaptchaType() {
    return $this->getConfig()->get('captcha_type') ?: 'text';
  }

  /**
   * Gets the difficulty level from configuration.
   *
   * @return string
   *   The difficulty level.
   */
  public function getDifficulty() {
    return $this->getConfig()->get('difficulty') ?: 'medium';
  }

}