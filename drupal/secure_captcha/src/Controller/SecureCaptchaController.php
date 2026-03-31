<?php

namespace Drupal\secure_captcha\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\DependencyInjection\ContainerInjectionInterface;
use Drupal\secure_captcha\SecureCaptchaService;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Controller for Secure CAPTCHA AJAX endpoints.
 */
class SecureCaptchaController extends ControllerBase implements ContainerInjectionInterface {

  /**
   * The Secure CAPTCHA service.
   *
   * @var \Drupal\secure_captcha\SecureCaptchaService
   */
  protected $captchaService;

  /**
   * Constructs a new SecureCaptchaController.
   *
   * @param \Drupal\secure_captcha\SecureCaptchaService $captcha_service
   *   The Secure CAPTCHA service.
   */
  public function __construct(SecureCaptchaService $captcha_service) {
    $this->captchaService = $captcha_service;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('secure_captcha.service')
    );
  }

  /**
   * Generates a new CAPTCHA.
   *
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The request object.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   The JSON response with CAPTCHA data.
   */
  public function generate(Request $request) {
    try {
      $type = $request->query->get('type', $this->captchaService->getCaptchaType());
      $difficulty = $request->query->get('difficulty', $this->captchaService->getDifficulty());

      $captcha = $this->captchaService->generateCaptcha($type, $difficulty);

      return new JsonResponse([
        'success' => TRUE,
        'sessionId' => $captcha['sessionId'],
        'challenge' => $captcha['challenge'],
      ]);
    }
    catch (\Exception $e) {
      return new JsonResponse([
        'success' => FALSE,
        'error' => $e->getMessage(),
      ], 500);
    }
  }

  /**
   * Validates a CAPTCHA response.
   *
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The request object.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   The JSON response with validation result.
   */
  public function validate(Request $request) {
    $session_id = $request->request->get('sessionId');
    $response = $request->request->get('response');
    $type = $request->request->get('type', $this->captchaService->getCaptchaType());

    if (empty($session_id) || empty($response)) {
      return new JsonResponse([
        'success' => FALSE,
        'error' => $this->t('Missing required parameters.'),
      ], 400);
    }

    $valid = $this->captchaService->validateCaptcha($session_id, $response, $type);

    return new JsonResponse([
      'success' => TRUE,
      'valid' => $valid,
    ]);
  }

}