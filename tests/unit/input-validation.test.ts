import { InputValidationService } from '../../src/security/input-validation';

describe('InputValidationService', () => {
  let service: InputValidationService;

  beforeEach(() => {
    service = new InputValidationService();
  });

  describe('validateSQLInjection', () => {
    it('should return valid for safe input', () => {
      const result = service.validateSQLInjection('Hello World');
      expect(result.isValid).toBe(true);
    });

    it('should return valid for empty input', () => {
      const result = service.validateSQLInjection('');
      expect(result.isValid).toBe(true);
    });

    it('should return valid for non-string input', () => {
      const result = service.validateSQLInjection(null as any);
      expect(result.isValid).toBe(true);
    });

    it('should detect SQL injection with SELECT', () => {
      const result = service.validateSQLInjection('1 OR 1=1; SELECT * FROM users');
      expect(result.isValid).toBe(false);
      expect(result.threat).toBe('SQL injection attempt detected');
    });

    it('should detect SQL injection with UNION', () => {
      const result = service.validateSQLInjection('1 UNION SELECT username, password FROM users');
      expect(result.isValid).toBe(false);
    });

    it('should detect SQL injection with DROP TABLE', () => {
      const result = service.validateSQLInjection("'; DROP TABLE users; --");
      expect(result.isValid).toBe(false);
    });

    it('should detect SQL injection with OR 1=1', () => {
      const result = service.validateSQLInjection("admin' OR 1=1 --");
      expect(result.isValid).toBe(false);
    });

    it('should detect SQL injection with INSERT', () => {
      const result = service.validateSQLInjection("'; INSERT INTO users VALUES ('hacker'); --");
      expect(result.isValid).toBe(false);
    });

    it('should detect SQL injection with EXECUTE', () => {
      const result = service.validateSQLInjection("'; EXECUTE xp_cmdshell('dir'); --");
      expect(result.isValid).toBe(false);
    });

    it('should detect SQL injection with ALTER TABLE', () => {
      const result = service.validateSQLInjection(
        "'; ALTER TABLE users ADD COLUMN hack VARCHAR(100); --"
      );
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateXSS', () => {
    it('should return valid for safe input', () => {
      const result = service.validateXSS('Hello World');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('Hello World');
    });

    it('should return valid for empty input', () => {
      const result = service.validateXSS('');
      expect(result.isValid).toBe(true);
    });

    it('should return valid for non-string input', () => {
      const result = service.validateXSS(null as any);
      expect(result.isValid).toBe(true);
    });

    it('should detect XSS with script tag', () => {
      const result = service.validateXSS('<script>alert("XSS")</script>');
      expect(result.isValid).toBe(false);
      expect(result.threat).toBe('XSS attack attempt detected');
    });

    it('should detect XSS with javascript: protocol', () => {
      const result = service.validateXSS('javascript:alert("XSS")');
      expect(result.isValid).toBe(false);
    });

    it('should detect XSS with onload event', () => {
      const result = service.validateXSS('<img src=x onload=alert("XSS")>');
      expect(result.isValid).toBe(false);
    });

    it('should detect XSS with iframe', () => {
      const result = service.validateXSS('<iframe src="http://evil.com"></iframe>');
      expect(result.isValid).toBe(false);
    });

    it('should detect XSS with onerror event', () => {
      const result = service.validateXSS('<img src=x onerror=alert("XSS")>');
      expect(result.isValid).toBe(false);
    });

    it('should detect XSS with onclick event', () => {
      const result = service.validateXSS('<div onclick=alert("XSS")>Click me</div>');
      expect(result.isValid).toBe(false);
    });

    it('should detect XSS with onmouseover event', () => {
      const result = service.validateXSS('<div onmouseover=alert("XSS")>Hover me</div>');
      expect(result.isValid).toBe(false);
    });

    it('should detect XSS with onfocus event', () => {
      const result = service.validateXSS('<input onfocus=alert("XSS")>');
      expect(result.isValid).toBe(false);
    });

    it('should detect XSS with object tag', () => {
      const result = service.validateXSS('<object data="http://evil.com"></object>');
      expect(result.isValid).toBe(false);
    });

    it('should detect XSS with embed tag', () => {
      const result = service.validateXSS('<embed src="http://evil.com"></embed>');
      expect(result.isValid).toBe(false);
    });

    it('should sanitize HTML entities', () => {
      const result = service.validateXSS('Hello <b>World</b>');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toContain('<');
    });

    it('should sanitize single quotes', () => {
      const result = service.validateXSS("test'input");
      expect(result.sanitized).toContain('&#x27;');
    });

    it('should sanitize forward slashes', () => {
      const result = service.validateXSS('test/input');
      expect(result.sanitized).toContain('&#x2F;');
    });
  });

  describe('validateCSRFToken', () => {
    it('should return valid for matching tokens', () => {
      const result = service.validateCSRFToken('token123', 'token123');
      expect(result.isValid).toBe(true);
    });

    it('should return invalid for missing token', () => {
      const result = service.validateCSRFToken('', 'token123');
      expect(result.isValid).toBe(false);
      expect(result.threat).toBe('Missing CSRF token');
    });

    it('should return invalid for missing expected token', () => {
      const result = service.validateCSRFToken('token123', '');
      expect(result.isValid).toBe(false);
      expect(result.threat).toBe('Missing CSRF token');
    });

    it('should return invalid for token length mismatch', () => {
      const result = service.validateCSRFToken('abc', 'abcdef');
      expect(result.isValid).toBe(false);
      expect(result.threat).toBe('Invalid CSRF token length');
    });

    it('should return invalid for token mismatch', () => {
      const result = service.validateCSRFToken('token123', 'token456');
      expect(result.isValid).toBe(false);
      expect(result.threat).toBe('CSRF token mismatch');
    });
  });

  describe('validateParameterPollution', () => {
    it('should return valid for clean params', () => {
      const result = service.validateParameterPollution({ name: 'John', age: '25' });
      expect(result.isValid).toBe(true);
      expect(result.cleanParams).toBeDefined();
    });

    it('should detect SQL injection in params', () => {
      const result = service.validateParameterPollution({ name: "'; DROP TABLE users; --" });
      expect(result.isValid).toBe(false);
      expect(result.threat).toContain('SQL injection');
    });

    it('should detect XSS in params', () => {
      const result = service.validateParameterPollution({ comment: '<script>alert(1)</script>' });
      expect(result.isValid).toBe(false);
      expect(result.threat).toContain('XSS');
    });

    it('should detect invalid parameter names', () => {
      const result = service.validateParameterPollution({ 'invalid-name': 'value' });
      expect(result.isValid).toBe(false);
      expect(result.threat).toContain('Invalid parameter name');
    });

    it('should validate nested objects', () => {
      const result = service.validateParameterPollution({
        user: { name: 'John', email: 'john@example.com' },
      });
      expect(result.isValid).toBe(true);
    });

    it('should detect SQL injection in nested objects', () => {
      const result = service.validateParameterPollution({
        user: { name: "'; DROP TABLE users; --" },
      });
      expect(result.isValid).toBe(false);
    });

    it('should handle non-string values', () => {
      const result = service.validateParameterPollution({ count: 42, active: true });
      expect(result.isValid).toBe(true);
    });

    it('should handle null values', () => {
      const result = service.validateParameterPollution({ name: null });
      expect(result.isValid).toBe(true);
    });

    it('should handle undefined values', () => {
      const result = service.validateParameterPollution({ name: undefined });
      expect(result.isValid).toBe(true);
    });

    it('should handle empty params', () => {
      const result = service.validateParameterPollution({});
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateJSONSchema', () => {
    it('should validate string type', () => {
      const result = service.validateJSONSchema('hello', { type: 'string' });
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid string type', () => {
      const result = service.validateJSONSchema(123, { type: 'string' });
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.includes('string'))).toBe(true);
    });

    it('should validate string maxLength', () => {
      const result = service.validateJSONSchema('hi', { type: 'string', maxLength: 5 });
      expect(result.isValid).toBe(true);
    });

    it('should reject string exceeding maxLength', () => {
      const result = service.validateJSONSchema('hello world', { type: 'string', maxLength: 5 });
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.includes('too long'))).toBe(true);
    });

    it('should validate string minLength', () => {
      const result = service.validateJSONSchema('hello', { type: 'string', minLength: 3 });
      expect(result.isValid).toBe(true);
    });

    it('should reject string below minLength', () => {
      const result = service.validateJSONSchema('hi', { type: 'string', minLength: 5 });
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.includes('too short'))).toBe(true);
    });

    it('should validate number type', () => {
      const result = service.validateJSONSchema(42, { type: 'number' });
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid number type', () => {
      const result = service.validateJSONSchema('42', { type: 'number' });
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.includes('number'))).toBe(true);
    });

    it('should validate number maximum', () => {
      const result = service.validateJSONSchema(50, { type: 'number', maximum: 100 });
      expect(result.isValid).toBe(true);
    });

    it('should reject number exceeding maximum', () => {
      const result = service.validateJSONSchema(150, { type: 'number', maximum: 100 });
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.includes('too large'))).toBe(true);
    });

    it('should validate number minimum', () => {
      const result = service.validateJSONSchema(50, { type: 'number', minimum: 0 });
      expect(result.isValid).toBe(true);
    });

    it('should reject number below minimum', () => {
      const result = service.validateJSONSchema(-10, { type: 'number', minimum: 0 });
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.includes('too small'))).toBe(true);
    });

    it('should validate object type', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      };
      const result = service.validateJSONSchema({ name: 'John', age: 25 }, schema);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid object type', () => {
      const result = service.validateJSONSchema('not an object', { type: 'object' });
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.includes('object'))).toBe(true);
    });

    it('should reject missing required fields', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      };
      const result = service.validateJSONSchema({ age: 25 }, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('name: Required field missing');
    });

    it('should validate array type', () => {
      const schema = {
        type: 'array',
        items: { type: 'string' },
      };
      const result = service.validateJSONSchema(['a', 'b', 'c'], schema);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid array type', () => {
      const result = service.validateJSONSchema('not an array', {
        type: 'array',
        items: { type: 'string' },
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.includes('array'))).toBe(true);
    });

    it('should validate array items', () => {
      const schema = {
        type: 'array',
        items: { type: 'number' },
      };
      const result = service.validateJSONSchema([1, 2, 'three'], schema);
      expect(result.isValid).toBe(false);
    });

    it('should handle null data for object type', () => {
      const result = service.validateJSONSchema(null, { type: 'object' });
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should handle nested object validation', () => {
      const schema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'number' },
            },
            required: ['name'],
          },
        },
        required: ['user'],
      };
      const result = service.validateJSONSchema({ user: { name: 'John', age: 25 } }, schema);
      expect(result.isValid).toBe(true);
    });

    it('should handle nested array validation', () => {
      const schema = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number' },
          },
        },
      };
      const result = service.validateJSONSchema([{ id: 1 }, { id: 'two' }], schema);
      expect(result.isValid).toBe(false);
    });

    it('should catch schema validation errors', () => {
      const result = service.validateJSONSchema('test', null as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('validateWhitelist', () => {
    it('should return valid for input matching whitelist', () => {
      const result = service.validateWhitelist('abc', ['a', 'b', 'c']);
      expect(result.isValid).toBe(true);
    });

    it('should return invalid for input with characters not in whitelist', () => {
      const result = service.validateWhitelist('abc123', ['a', 'b', 'c']);
      expect(result.isValid).toBe(false);
      expect(result.filtered).toBe('abc');
    });

    it('should return valid for empty input', () => {
      const result = service.validateWhitelist('', ['a', 'b', 'c']);
      expect(result.isValid).toBe(true);
    });

    it('should return valid for non-string input', () => {
      const result = service.validateWhitelist(null as any, ['a', 'b', 'c']);
      expect(result.isValid).toBe(true);
    });

    it('should filter special characters', () => {
      const result = service.validateWhitelist('abc!@#', ['a', 'b', 'c']);
      expect(result.isValid).toBe(false);
      expect(result.filtered).toBe('abc');
    });
  });

  describe('sanitizeInput', () => {
    it('should return empty string for null input', () => {
      const result = service.sanitizeInput(null as any);
      expect(result).toBe('');
    });

    it('should return empty string for undefined input', () => {
      const result = service.sanitizeInput(undefined as any);
      expect(result).toBe('');
    });

    it('should return empty string for non-string input', () => {
      const result = service.sanitizeInput(123 as any);
      expect(result).toBe('');
    });

    it('should trim whitespace by default', () => {
      const result = service.sanitizeInput('  hello  ');
      expect(result).toBe('hello');
    });

    it('should not trim whitespace when option is false', () => {
      const result = service.sanitizeInput('  hello  ', { trimWhitespace: false });
      expect(result).toBe('  hello  ');
    });

    it('should limit length when maxLength is set', () => {
      const result = service.sanitizeInput('hello world', { maxLength: 5 });
      expect(result).toBe('hello');
    });

    it('should sanitize HTML when allowHTML is false', () => {
      const result = service.sanitizeInput('<script>alert(1)</script>');
      // sanitizeXSS escapes < and > characters and forward slashes
      // The output breaks the script tag by escaping the forward slash
      expect(result).toContain('&#x2F;');
      expect(result).toContain('alert(1)');
    });

    it('should allow HTML when allowHTML is true', () => {
      const result = service.sanitizeInput('<b>bold</b>', { allowHTML: true });
      expect(result).toBe('<b>bold</b>');
    });

    it('should apply all options together', () => {
      const result = service.sanitizeInput('  <b>hello world</b>  ', {
        maxLength: 10,
        trimWhitespace: true,
        allowHTML: false,
      });
      expect(result.length).toBeLessThanOrEqual(10);
      // HTML entities are escaped (< and >)
      expect(result).toContain('<');
    });
  });

  describe('validateEmail', () => {
    it('should return invalid for empty email', () => {
      const result = service.validateEmail('');
      expect(result.isValid).toBe(false);
    });

    it('should return invalid for null email', () => {
      const result = service.validateEmail(null as any);
      expect(result.isValid).toBe(false);
    });

    it('should return invalid for non-string email', () => {
      const result = service.validateEmail(123 as any);
      expect(result.isValid).toBe(false);
    });

    it('should validate valid email', () => {
      const result = service.validateEmail('user@example.com');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('user@example.com');
    });

    it('should validate email with plus sign', () => {
      const result = service.validateEmail('user+tag@example.com');
      expect(result.isValid).toBe(true);
    });

    it('should validate email with subdomain', () => {
      const result = service.validateEmail('user@mail.example.com');
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid email without @', () => {
      const result = service.validateEmail('userexample.com');
      expect(result.isValid).toBe(false);
    });

    it('should reject invalid email without domain', () => {
      const result = service.validateEmail('user@');
      expect(result.isValid).toBe(false);
    });

    it('should lowercase and trim email', () => {
      const result = service.validateEmail('USER@EXAMPLE.COM');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('user@example.com');
    });

    it('should validate email with special characters', () => {
      const result = service.validateEmail('user.name+tag@example.co.uk');
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateURL', () => {
    it('should return invalid for empty URL', () => {
      const result = service.validateURL('');
      expect(result.isValid).toBe(false);
    });

    it('should return invalid for null URL', () => {
      const result = service.validateURL(null as any);
      expect(result.isValid).toBe(false);
    });

    it('should return invalid for non-string URL', () => {
      const result = service.validateURL(123 as any);
      expect(result.isValid).toBe(false);
    });

    it('should validate valid HTTP URL', () => {
      const result = service.validateURL('http://example.com');
      expect(result.isValid).toBe(true);
    });

    it('should validate valid HTTPS URL', () => {
      const result = service.validateURL('https://example.com/path?query=value');
      expect(result.isValid).toBe(true);
    });

    it('should reject FTP URL', () => {
      const result = service.validateURL('ftp://example.com');
      expect(result.isValid).toBe(false);
    });

    it('should reject invalid URL', () => {
      const result = service.validateURL('not-a-url');
      expect(result.isValid).toBe(false);
    });

    it('should reject javascript: URL', () => {
      const result = service.validateURL('javascript:alert(1)');
      expect(result.isValid).toBe(false);
    });

    it('should validate URL with port', () => {
      const result = service.validateURL('https://example.com:8080/path');
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateFileUpload', () => {
    it('should validate valid image file', () => {
      const file = {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        size: 1024 * 100,
      };
      const result = service.validateFileUpload(file, {
        allowedTypes: ['image/jpeg', 'image/png'],
        maxSize: 1024 * 1024 * 5,
        allowedExtensions: ['.jpg', '.jpeg', '.png'],
      });
      expect(result.isValid).toBe(true);
    });

    it('should reject dangerous file extension', () => {
      const file = {
        originalname: 'malware.exe',
        mimetype: 'application/octet-stream',
        size: 1024,
      };
      const result = service.validateFileUpload(file);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Dangerous file extension: .exe');
    });

    it('should reject disallowed MIME type', () => {
      const file = {
        originalname: 'script.js',
        mimetype: 'application/javascript',
        size: 1024,
      };
      const result = service.validateFileUpload(file, {
        allowedTypes: ['image/jpeg', 'image/png'],
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('MIME type not allowed: application/javascript');
    });

    it('should reject file exceeding size limit', () => {
      const file = {
        originalname: 'large.jpg',
        mimetype: 'image/jpeg',
        size: 1024 * 1024 * 10,
      };
      const result = service.validateFileUpload(file, {
        maxSize: 1024 * 1024 * 5,
        allowedExtensions: ['.jpg'],
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.includes('size exceeds'))).toBe(true);
    });

    it('should reject file with disallowed extension', () => {
      const file = {
        originalname: 'document.txt',
        mimetype: 'text/plain',
        size: 1024,
      };
      const result = service.validateFileUpload(file, {
        allowedExtensions: ['.jpg', '.png'],
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.includes('not allowed'))).toBe(true);
    });

    it('should reject file with invalid name', () => {
      const file = {
        originalname: '',
        mimetype: 'image/jpeg',
        size: 1024,
      };
      const result = service.validateFileUpload(file);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid file name');
    });

    it('should detect dangerous extensions', () => {
      const dangerousExtensions = [
        '.bat',
        '.cmd',
        '.com',
        '.pif',
        '.scr',
        '.vbs',
        '.js',
        '.jar',
        '.sh',
      ];
      for (const ext of dangerousExtensions) {
        const file = {
          originalname: `malware${ext}`,
          mimetype: 'application/octet-stream',
          size: 1024,
        };
        const result = service.validateFileUpload(file);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(`Dangerous file extension: ${ext}`);
      }
    });

    it('should detect PE executable signature', () => {
      const file = {
        originalname: 'program.exe',
        mimetype: 'application/octet-stream',
        size: 1024,
        buffer: Buffer.from('MZ' + 'rest of file'),
      };
      const result = service.validateFileUpload(file);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Potential malicious file detected');
    });

    it('should detect PDF signature', () => {
      const file = {
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('%PDF' + 'rest of file'),
      };
      const result = service.validateFileUpload(file);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Potential malicious file detected');
    });

    it('should pass for safe file buffer', () => {
      const file = {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('safe image data'),
      };
      const result = service.validateFileUpload(file, {
        allowedTypes: ['image/jpeg'],
        allowedExtensions: ['.jpg'],
      });
      expect(result.isValid).toBe(true);
    });

    it('should validate without options', () => {
      const file = {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
      };
      const result = service.validateFileUpload(file);
      expect(result.isValid).toBe(true);
    });

    it('should handle file without buffer', () => {
      const file = {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
      };
      const result = service.validateFileUpload(file);
      expect(result.isValid).toBe(true);
    });
  });
});
