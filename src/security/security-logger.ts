import { SecurityEventDetails } from '../types/security';

export class SecurityLogger {
  private readonly logLevel: 'debug' | 'info' | 'warn' | 'error';
  private readonly enableFileLogging: boolean;
  private readonly logFilePath: string;
  private readonly maxLogFileSize: number;
  private readonly maxLogFiles: number;

  constructor(config: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableFileLogging: boolean;
    logFilePath: string;
    maxLogFileSize: number;
    maxLogFiles: number;
  }) {
    this.logLevel = config.level;
    this.enableFileLogging = config.enableFileLogging;
    this.logFilePath = config.logFilePath;
    this.maxLogFileSize = config.maxLogFileSize;
    this.maxLogFiles = config.maxLogFiles;
  }

  /**
   * Log security event
   */
  logSecurityEvent(event: SecurityEventDetails): void {
    const logEntry = {
      timestamp: Date.now(),
      type: 'SECURITY_EVENT',
      severity: 'INFO',
      source: 'SECURITY_LOGGER',
      details: event,
      metadata: event.metadata || {},
    };

    // Log to console
    this.logToConsole(logEntry);

    // Log to file if enabled
    if (this.enableFileLogging) {
      this.logToFile(logEntry);
    }
  }

  /**
   * Log to console
   */
  private logToConsole(logEntry: any): void {
    const message = JSON.stringify(logEntry, null, 2);

    switch (logEntry.severity) {
      case 'DEBUG':
        if (this.logLevel === 'debug') {
          console.debug(message);
        }
        break;
      case 'INFO':
        if (['debug', 'info'].includes(this.logLevel)) {
          console.info(message);
        }
        break;
      case 'WARNING':
        if (['debug', 'info', 'warn'].includes(this.logLevel)) {
          console.warn(message);
        }
        break;
      case 'ERROR':
        console.error(message);
        break;
    }
  }

  /**
   * Log to file
   */
  private logToFile(logEntry: any): void {
    // This is a simplified implementation
    // In a real application, you would use a proper logging library
    // like Winston or Bunyan with file rotation
    try {
      const fs = require('fs');
      const path = require('path');

      // Ensure log directory exists
      const logDir = path.dirname(this.logFilePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // Append to log file
      fs.appendFileSync(this.logFilePath, JSON.stringify(logEntry) + '\n');

      // Check file size and rotate if necessary
      this.rotateLogFile();
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Rotate log file if it exceeds max size
   */
  private rotateLogFile(): void {
    try {
      const fs = require('fs');

      if (!fs.existsSync(this.logFilePath)) {
        return;
      }

      const stats = fs.statSync(this.logFilePath);

      if (stats.size > this.maxLogFileSize) {
        // Rotate files
        for (let i = this.maxLogFiles - 1; i > 0; i--) {
          const oldFile = `${this.logFilePath}.${i}`;
          const newFile = `${this.logFilePath}.${i + 1}`;

          if (fs.existsSync(oldFile)) {
            fs.renameSync(oldFile, newFile);
          }
        }

        // Move current log to .1
        fs.renameSync(this.logFilePath, `${this.logFilePath}.1`);
      }
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    eventsBySource: Record<string, number>;
  } {
    // This is a simplified implementation
    // In a real application, you would query your log storage
    return {
      totalEvents: 0,
      eventsByType: {},
      eventsBySeverity: {},
      eventsBySource: {},
    };
  }
}
