import { SecurityLogger } from '../../src/security/security-logger';
import * as fs from 'fs';
import * as path from 'path';

describe('SecurityLogger', () => {
  const logFilePath = '/tmp/test-security.log';
  const defaultConfig = {
    level: 'info' as const,
    enableFileLogging: false,
    logFilePath: logFilePath,
    maxLogFileSize: 1024 * 1024,
    maxLogFiles: 5,
  };

  beforeEach(() => {
    // Clean up test log files
    try {
      if (fs.existsSync(logFilePath)) fs.unlinkSync(logFilePath);
      for (let i = 1; i <= 5; i++) {
        const rotatedFile = `${logFilePath}.${i}`;
        if (fs.existsSync(rotatedFile)) fs.unlinkSync(rotatedFile);
      }
    } catch {
      // Ignore cleanup errors
    }
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const logger = new SecurityLogger(defaultConfig);
      expect(logger).toBeDefined();
    });

    it('should initialize with debug level', () => {
      const logger = new SecurityLogger({ ...defaultConfig, level: 'debug' });
      expect(logger).toBeDefined();
    });

    it('should initialize with warn level', () => {
      const logger = new SecurityLogger({ ...defaultConfig, level: 'warn' });
      expect(logger).toBeDefined();
    });

    it('should initialize with error level', () => {
      const logger = new SecurityLogger({ ...defaultConfig, level: 'error' });
      expect(logger).toBeDefined();
    });

    it('should initialize with file logging enabled', () => {
      const logger = new SecurityLogger({ ...defaultConfig, enableFileLogging: true });
      expect(logger).toBeDefined();
    });
  });

  describe('logSecurityEvent', () => {
    it('should log security event to console', () => {
      const logger = new SecurityLogger({ ...defaultConfig, level: 'debug' });
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

      logger.logSecurityEvent({
        action: 'login',
        resource: 'auth',
        reason: 'User login successful',
        metadata: { method: 'password' },
      });

      expect(consoleInfoSpy).toHaveBeenCalled();
      consoleInfoSpy.mockRestore();
    });

    it('should log security event to file when file logging is enabled', () => {
      const logger = new SecurityLogger({ ...defaultConfig, enableFileLogging: true });
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

      logger.logSecurityEvent({
        action: 'login',
        resource: 'auth',
        reason: 'User login successful',
        metadata: {},
      });

      expect(fs.existsSync(logFilePath)).toBe(true);
      const logContent = fs.readFileSync(logFilePath, 'utf-8');
      expect(logContent).toContain('SECURITY_EVENT');
      expect(logContent).toContain('login');

      consoleInfoSpy.mockRestore();
    });

    it('should not log to file when file logging is disabled', () => {
      const logger = new SecurityLogger({ ...defaultConfig, enableFileLogging: false });
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

      logger.logSecurityEvent({
        action: 'login',
        resource: 'auth',
        reason: 'User login successful',
        metadata: {},
      });

      expect(fs.existsSync(logFilePath)).toBe(false);
      consoleInfoSpy.mockRestore();
    });

    it('should handle event without metadata', () => {
      const logger = new SecurityLogger({ ...defaultConfig, level: 'debug' });
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

      logger.logSecurityEvent({
        action: 'access',
        resource: 'api',
        reason: 'Access granted',
        metadata: {},
      });

      expect(consoleInfoSpy).toHaveBeenCalled();
      consoleInfoSpy.mockRestore();
    });
  });

  describe('logToConsole', () => {
    it('should log info messages when level is debug', () => {
      const logger = new SecurityLogger({ ...defaultConfig, level: 'debug' });
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

      logger.logSecurityEvent({
        action: 'test',
        resource: 'test',
        reason: 'Test message',
        metadata: {},
      });

      // SecurityLogger always sets severity to 'INFO'
      expect(consoleInfoSpy).toHaveBeenCalled();
      consoleInfoSpy.mockRestore();
    });

    it('should log info messages when level is info', () => {
      const logger = new SecurityLogger({ ...defaultConfig, level: 'info' });
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

      logger.logSecurityEvent({
        action: 'test',
        resource: 'test',
        reason: 'Test message',
        metadata: {},
      });

      expect(consoleInfoSpy).toHaveBeenCalled();
      consoleInfoSpy.mockRestore();
    });

    it('should not log info messages when level is warn', () => {
      const logger = new SecurityLogger({ ...defaultConfig, level: 'warn' });
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

      logger.logSecurityEvent({
        action: 'test',
        resource: 'test',
        reason: 'Test message',
        metadata: {},
      });

      expect(consoleInfoSpy).not.toHaveBeenCalled();
      consoleInfoSpy.mockRestore();
    });

    it('should not log info messages when level is error', () => {
      const logger = new SecurityLogger({ ...defaultConfig, level: 'error' });
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

      logger.logSecurityEvent({
        action: 'test',
        resource: 'test',
        reason: 'Test message',
        metadata: {},
      });

      expect(consoleInfoSpy).not.toHaveBeenCalled();
      consoleInfoSpy.mockRestore();
    });
  });

  describe('logToFile', () => {
    it('should create log directory if it does not exist', () => {
      const nestedLogPath = '/tmp/test-logs/nested/security.log';
      const logger = new SecurityLogger({
        ...defaultConfig,
        enableFileLogging: true,
        logFilePath: nestedLogPath,
      });
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

      logger.logSecurityEvent({
        action: 'test',
        resource: 'test',
        reason: 'Test message',
        metadata: {},
      });

      expect(fs.existsSync(nestedLogPath)).toBe(true);

      // Cleanup
      try {
        fs.unlinkSync(nestedLogPath);
        fs.rmdirSync(path.dirname(nestedLogPath));
        fs.rmdirSync('/tmp/test-logs');
      } catch {
        // Ignore cleanup errors
      }

      consoleInfoSpy.mockRestore();
    });

    it('should append to existing log file', () => {
      const logger = new SecurityLogger({ ...defaultConfig, enableFileLogging: true });
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

      logger.logSecurityEvent({
        action: 'test1',
        resource: 'test',
        reason: 'First message',
        metadata: {},
      });

      logger.logSecurityEvent({
        action: 'test2',
        resource: 'test',
        reason: 'Second message',
        metadata: {},
      });

      const logContent = fs.readFileSync(logFilePath, 'utf-8');
      const lines = logContent.trim().split('\n');
      expect(lines.length).toBe(2);

      consoleInfoSpy.mockRestore();
    });

    it('should handle file write errors gracefully', () => {
      const logger = new SecurityLogger({
        ...defaultConfig,
        enableFileLogging: true,
        logFilePath: '/invalid/path/that/does/not/exist/file.log',
      });
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // This should not throw an error
      expect(() => {
        logger.logSecurityEvent({
          action: 'test',
          resource: 'test',
          reason: 'Test message',
          metadata: {},
        });
      }).not.toThrow();

      consoleInfoSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('rotateLogFile', () => {
    it('should rotate log file when it exceeds max size', () => {
      const smallMaxSize = 100; // 100 bytes
      const logger = new SecurityLogger({
        ...defaultConfig,
        enableFileLogging: true,
        maxLogFileSize: smallMaxSize,
        maxLogFiles: 3,
      });
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

      // Write enough data to trigger rotation
      const largeMessage = 'x'.repeat(200);
      logger.logSecurityEvent({
        action: 'test',
        resource: 'test',
        reason: largeMessage,
        metadata: {},
      });

      // Check that rotation occurred
      expect(fs.existsSync(`${logFilePath}.1`)).toBe(true);

      consoleInfoSpy.mockRestore();
    });

    it('should not rotate log file when it is below max size', () => {
      const logger = new SecurityLogger({
        ...defaultConfig,
        enableFileLogging: true,
        maxLogFileSize: 1024 * 1024, // 1MB
      });
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

      logger.logSecurityEvent({
        action: 'test',
        resource: 'test',
        reason: 'Small message',
        metadata: {},
      });

      // Check that no rotation occurred
      expect(fs.existsSync(`${logFilePath}.1`)).toBe(false);

      consoleInfoSpy.mockRestore();
    });

    it('should handle rotation errors gracefully', () => {
      const logger = new SecurityLogger({
        ...defaultConfig,
        enableFileLogging: true,
        logFilePath: '/invalid/path/file.log',
      });
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // This should not throw an error
      expect(() => {
        logger.logSecurityEvent({
          action: 'test',
          resource: 'test',
          reason: 'Test message',
          metadata: {},
        });
      }).not.toThrow();

      consoleInfoSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getSecurityStats', () => {
    it('should return security statistics', () => {
      const logger = new SecurityLogger(defaultConfig);
      const stats = logger.getSecurityStats();

      expect(stats).toHaveProperty('totalEvents');
      expect(stats).toHaveProperty('eventsByType');
      expect(stats).toHaveProperty('eventsBySeverity');
      expect(stats).toHaveProperty('eventsBySource');
    });

    it('should return zero total events initially', () => {
      const logger = new SecurityLogger(defaultConfig);
      const stats = logger.getSecurityStats();

      expect(stats.totalEvents).toBe(0);
    });

    it('should return empty events by type initially', () => {
      const logger = new SecurityLogger(defaultConfig);
      const stats = logger.getSecurityStats();

      expect(Object.keys(stats.eventsByType).length).toBe(0);
    });
  });
});
