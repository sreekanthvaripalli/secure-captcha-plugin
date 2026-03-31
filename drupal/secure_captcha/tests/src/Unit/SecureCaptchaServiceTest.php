<?php

namespace Drupal\Tests\secure_captcha\Unit;

use Drupal\Tests\UnitTestCase;
use Drupal\secure_captcha\SecureCaptchaService;
use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Config\ImmutableConfig;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use Drupal\Core\Logger\LoggerChannelInterface;
use GuzzleHttp\ClientInterface;
use GuzzleHttp\Psr7\Response;
use GuzzleHttp\Exception\RequestException;
use Psr\Http\Message\RequestInterface;

/**
 * @coversDefaultClass \Drupal\secure_captcha\SecureCaptchaService
 * @group secure_captcha
 */
class SecureCaptchaServiceTest extends UnitTestCase {

  /**
   * The HTTP client mock.
   *
   * @var \GuzzleHttp\ClientInterface|\PHPUnit\Framework\MockObject\MockObject
   */
  protected $httpClient;

  /**
   * The config factory mock.
   *
   * @var \Drupal\Core\Config\ConfigFactoryInterface|\PHPUnit\Framework\MockObject\MockObject
   */
  protected $configFactory;

  /**
   * The logger factory mock.
   *
   * @var \Drupal\Core\Logger\LoggerChannelFactoryInterface|\PHPUnit\Framework\MockObject\MockObject
   */
  protected $loggerFactory;

  /**
   * The config mock.
   *
   * @var \Drupal\Core\Config\ImmutableConfig|\PHPUnit\Framework\MockObject\MockObject
   */
  protected $config;

  /**
   * The logger mock.
   *
   * @var \Drupal\Core\Logger\LoggerChannelInterface|\PHPUnit\Framework\MockObject\MockObject
   */
  protected $logger;

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();

    $this->httpClient = $this->createMock(ClientInterface::class);
    $this->configFactory = $this->createMock(ConfigFactoryInterface::class);
    $this->loggerFactory = $this->createMock(LoggerChannelFactoryInterface::class);
    $this->config = $this->createMock(ImmutableConfig::class);
    $this->logger = $this->createMock(LoggerChannelInterface::class);

    $this->configFactory->method('get')
      ->with('secure_captcha.settings')
      ->willReturn($this->config);

    $this->loggerFactory->method('get')
      ->with('secure_captcha')
      ->willReturn($this->logger);

    $this->config->method('get')
      ->willReturnMap([
        ['api_url', NULL, 'http://localhost:3000/api/v1/captcha'],
        ['captcha_type', NULL, 'text'],
        ['difficulty', NULL, 'medium'],
        ['enabled', NULL, TRUE],
        ['protected_forms', NULL, ['user_login_form', 'user_register_form']],
      ]);
  }

  /**
   * @covers ::generateCaptcha
   */
  public function testGenerateCaptchaSuccess() {
    $response_body = json_encode([
      'sessionId' => 'test-session-123',
      'challenge' => 'ABC123',
    ]);

    $response = new Response(200, [], $response_body);

    $this->httpClient->expects($this->once())
      ->method('post')
      ->willReturn($response);

    $service = new SecureCaptchaService(
      $this->httpClient,
      $this->configFactory,
      $this->loggerFactory
    );

    $result = $service->generateCaptcha('text', 'medium');

    $this->assertEquals('test-session-123', $result['sessionId']);
    $this->assertEquals('ABC123', $result['challenge']);
  }

  /**
   * @covers ::validateCaptcha
   */
  public function testValidateCaptchaSuccess() {
    $response_body = json_encode(['valid' => TRUE]);

    $response = new Response(200, [], $response_body);

    $this->httpClient->expects($this->once())
      ->method('post')
      ->willReturn($response);

    $service = new SecureCaptchaService(
      $this->httpClient,
      $this->configFactory,
      $this->loggerFactory
    );

    $result = $service->validateCaptcha('test-session', 'ABC123', 'text');

    $this->assertTrue($result);
  }

  /**
   * @covers ::validateCaptcha
   */
  public function testValidateCaptchaInvalid() {
    $response_body = json_encode(['valid' => FALSE]);

    $response = new Response(200, [], $response_body);

    $this->httpClient->expects($this->once())
      ->method('post')
      ->willReturn($response);

    $service = new SecureCaptchaService(
      $this->httpClient,
      $this->configFactory,
      $this->loggerFactory
    );

    $result = $service->validateCaptcha('test-session', 'wrong', 'text');

    $this->assertFalse($result);
  }

  /**
   * @covers ::isEnabledForForm
   */
  public function testIsEnabledForForm() {
    $service = new SecureCaptchaService(
      $this->httpClient,
      $this->configFactory,
      $this->loggerFactory
    );

    $this->assertTrue($service->isEnabledForForm('user_login_form'));
    $this->assertFalse($service->isEnabledForForm('some_other_form'));
  }

  /**
   * @covers ::getCaptchaType
   */
  public function testGetCaptchaType() {
    $service = new SecureCaptchaService(
      $this->httpClient,
      $this->configFactory,
      $this->loggerFactory
    );

    $this->assertEquals('text', $service->getCaptchaType());
  }

  /**
   * @covers ::getDifficulty
   */
  public function testGetDifficulty() {
    $service = new SecureCaptchaService(
      $this->httpClient,
      $this->configFactory,
      $this->loggerFactory
    );

    $this->assertEquals('medium', $service->getDifficulty());
  }

}