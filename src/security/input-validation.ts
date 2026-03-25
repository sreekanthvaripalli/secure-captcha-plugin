/**
 * Input Validation Service
 * Implements comprehensive input validation with OWASP security standards
 */

export class InputValidationService {
  private readonly sqlInjectionPatterns: RegExp[];
  private readonly xssPatterns: RegExp[];

  constructor() {
    // SQL Injection patterns
    this.sqlInjectionPatterns = [
      /(\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|\bunion\b|\bexec\b|\bexecute\b)/i,
      /(')|(;)|(--)|(\|(%27)|(%3B)|(%2D%2D)|(%7C))/i,
      /(\bor\b|\band\b)\s+\w+\s*[=<>]/i,
      /(\b1=1\b|\b'1'='1'\b|\btrue\b)/i,
      /(\bdrop\s+table\b|\bcreate\s+table\b|\balter\s+table\b)/i
    ];

  // XSS patterns
  this.xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi,
    /onmouseover\s*=/gi,
    /onfocus\s*=/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi
  ];
}

  /**
   * Validate input against SQL injection attacks
   */
  validateSQLInjection(input: string): { isValid: boolean; threat?: string } {
    if (!input || typeof input !== 'string') {
      return { isValid: true };
    }

    for (const pattern of this.sqlInjectionPatterns) {
      if (pattern.test(input)) {
        return {
          isValid: false,
          threat: 'SQL injection attempt detected'
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Validate input against XSS attacks
   */
  validateXSS(input: string): { isValid: boolean; threat?: string; sanitized?: string } {
    if (!input || typeof input !== 'string') {
      return { isValid: true };
    }

    // Check for XSS patterns
    for (const pattern of this.xssPatterns) {
      if (pattern.test(input)) {
        return {
          isValid: false,
          threat: 'XSS attack attempt detected',
          sanitized: this.sanitizeXSS(input)
        };
      }
    }

    // Sanitize potentially dangerous characters
    const sanitized = this.sanitizeXSS(input);
    return {
      isValid: true,
      sanitized
    };
  }

  /**
   * Validate CSRF token
   */
  validateCSRFToken(token: string, expectedToken: string): { isValid: boolean; threat?: string } {
    if (!token || !expectedToken) {
      return {
        isValid: false,
        threat: 'Missing CSRF token'
      };
    }

    // Constant-time comparison to prevent timing attacks
    if (token.length !== expectedToken.length) {
      return {
        isValid: false,
        threat: 'Invalid CSRF token length'
      };
    }

    let result = 0;
    for (let i = 0; i < token.length; i++) {
      result |= token.charCodeAt(i) ^ expectedToken.charCodeAt(i);
    }

    if (result !== 0) {
      return {
        isValid: false,
        threat: 'CSRF token mismatch'
      };
    }

    return { isValid: true };
  }

  /**
   * Validate against parameter pollution
   */
  validateParameterPollution(params: Record<string, unknown>): { isValid: boolean; threat?: string; cleanParams?: Record<string, unknown> } {
    const cleanParams: Record<string, unknown> = {};
    const seenParams = new Set<string>();

    for (const [key, value] of Object.entries(params)) {
      // Check for duplicate parameters
      if (seenParams.has(key)) {
        return {
          isValid: false,
          threat: `Parameter pollution detected: duplicate parameter '${key}'`
        };
      }
      seenParams.add(key);

      // Validate parameter name
      if (!this.isValidParameterName(key)) {
        return {
          isValid: false,
          threat: `Invalid parameter name: '${key}'`
        };
      }

      // Validate parameter value
      if (typeof value === 'string') {
        const sqlValidation = this.validateSQLInjection(value);
        if (!sqlValidation.isValid) {
          return {
            isValid: false,
            threat: `SQL injection in parameter '${key}': ${sqlValidation.threat}`
          };
        }

        const xssValidation = this.validateXSS(value);
        if (!xssValidation.isValid) {
          return {
            isValid: false,
            threat: `XSS in parameter '${key}': ${xssValidation.threat}`
          };
        }

        cleanParams[key] = xssValidation.sanitized || value;
      } else if (typeof value === 'object' && value !== null) {
        // Recursively validate nested objects
        const nestedValidation = this.validateParameterPollution(value as Record<string, unknown>);
        if (!nestedValidation.isValid) {
          return nestedValidation;
        }
        cleanParams[key] = nestedValidation.cleanParams || value;
      } else {
        cleanParams[key] = value;
      }
    }

    return {
      isValid: true,
      cleanParams
    };
  }

  /**
   * Validate JSON schema
   */
  validateJSONSchema(data: unknown, schema: Record<string, unknown>): { isValid: boolean; errors?: string[] } {
    const errors: string[] = [];
    
    try {
      this.validateSchemaRecursive(data, schema, '', errors);
      return {
        isValid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Schema validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Whitelist-based input filtering
   */
  validateWhitelist(input: string, whitelist: string[]): { isValid: boolean; filtered?: string } {
    if (!input || typeof input !== 'string') {
      return { isValid: true };
    }

    // Remove any characters not in whitelist
    const filtered = input.split('').filter(char => whitelist.includes(char)).join('');
    
    if (filtered !== input) {
      return {
        isValid: false,
        filtered
      };
    }

    return { isValid: true };
  }

  /**
   * Comprehensive input sanitization
   */
  sanitizeInput(input: string, options: {
    allowHTML?: boolean;
    maxLength?: number;
    trimWhitespace?: boolean;
  } = {}): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    let sanitized = input;

    // Trim whitespace
    if (options.trimWhitespace !== false) {
      sanitized = sanitized.trim();
    }

    // Limit length
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    // Sanitize HTML if not allowed
    if (!options.allowHTML) {
      sanitized = this.sanitizeXSS(sanitized);
    }

    return sanitized;
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): { isValid: boolean; sanitized?: string } {
    if (!email || typeof email !== 'string') {
      return { isValid: false };
    }

    // RFC 5322 compliant email regex
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (!emailRegex.test(email)) {
      return { isValid: false };
    }

    return {
      isValid: true,
      sanitized: email.toLowerCase().trim()
    };
  }

  /**
   * Validate URL format
   */
  validateURL(url: string): { isValid: boolean; sanitized?: string } {
    if (!url || typeof url !== 'string') {
      return { isValid: false };
    }

    try {
      const urlObj = new URL(url);
      
      // Only allow HTTP and HTTPS protocols
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { isValid: false };
      }

      return {
        isValid: true,
        sanitized: urlObj.toString()
      };
    } catch {
      return { isValid: false };
    }
  }

  /**
   * Validate file upload
   */
  validateFileUpload(file: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer?: Buffer;
  }, options: {
    allowedTypes?: string[];
    maxSize?: number;
    allowedExtensions?: string[];
  } = {}): { isValid: boolean; errors?: string[] } {
    const errors: string[] = [];

    // Validate file name
    if (!file.originalname || typeof file.originalname !== 'string') {
      errors.push('Invalid file name');
    } else {
      // Check for dangerous file extensions
      const dangerousExtensions = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar', '.sh'];
      const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
      
      if (dangerousExtensions.includes(fileExtension)) {
        errors.push(`Dangerous file extension: ${fileExtension}`);
      }

      // Check for allowed extensions
      if (options.allowedExtensions && !options.allowedExtensions.includes(fileExtension)) {
        errors.push(`File extension not allowed: ${fileExtension}`);
      }
    }

    // Validate MIME type
    if (options.allowedTypes && file.mimetype && !options.allowedTypes.includes(file.mimetype)) {
      errors.push(`MIME type not allowed: ${file.mimetype}`);
    }

    // Validate file size
    if (options.maxSize && file.size > options.maxSize) {
      errors.push(`File size exceeds limit: ${file.size} bytes`);
    }

    // Basic virus scanning (signature-based)
    if (file.buffer) {
      const virusSignatures = [
        Buffer.from('MZ'), // PE executable signature
        Buffer.from('%PDF'), // PDF signature (potential for embedded scripts)
      ];

      for (const signature of virusSignatures) {
        if (file.buffer.subarray(0, signature.length).equals(signature)) {
          errors.push('Potential malicious file detected');
          break;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Private helper methods
   */
  private sanitizeXSS(input: string): string {
    return input
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  private isValidParameterName(name: string): boolean {
    // Parameter names should only contain alphanumeric characters and underscores
    return /^[a-zA-Z0-9_]+$/.test(name);
  }

  private validateSchemaRecursive(data: unknown, schema: Record<string, unknown>, path: string, errors: string[]): void {
    if (schema.type === 'string') {
      if (typeof data !== 'string') {
        errors.push(`${path}: Expected string, got ${typeof data}`);
      }
      if (schema.maxLength && (data as string).length > (schema.maxLength as number)) {
        errors.push(`${path}: String too long (max ${schema.maxLength})`);
      }
      if (schema.minLength && (data as string).length < (schema.minLength as number)) {
        errors.push(`${path}: String too short (min ${schema.minLength})`);
      }
    } else if (schema.type === 'number') {
      if (typeof data !== 'number') {
        errors.push(`${path}: Expected number, got ${typeof data}`);
      }
      if (schema.maximum !== undefined && (data as number) > (schema.maximum as number)) {
        errors.push(`${path}: Number too large (max ${schema.maximum})`);
      }
      if (schema.minimum !== undefined && (data as number) < (schema.minimum as number)) {
        errors.push(`${path}: Number too small (min ${schema.minimum})`);
      }
    } else if (schema.type === 'object') {
      if (typeof data !== 'object' || data === null) {
        errors.push(`${path}: Expected object, got ${typeof data}`);
      } else {
        for (const [key, value] of Object.entries(schema.properties || {})) {
          const propertyPath = path ? `${path}.${key}` : key;
          if ((data as Record<string, unknown>)[key] !== undefined) {
            this.validateSchemaRecursive((data as Record<string, unknown>)[key], value as Record<string, unknown>, propertyPath, errors);
          } else if (schema.required && (schema.required as string[]).includes(key)) {
            errors.push(`${propertyPath}: Required field missing`);
          }
        }
      }
    } else if (schema.type === 'array') {
      if (!Array.isArray(data)) {
        errors.push(`${path}: Expected array, got ${typeof data}`);
      } else {
        for (let i = 0; i < (data as unknown[]).length; i++) {
          this.validateSchemaRecursive((data as unknown[])[i], schema.items as Record<string, unknown>, `${path}[${i}]`, errors);
        }
      }
    }
  }
}