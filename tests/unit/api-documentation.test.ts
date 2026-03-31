/**
 * API Documentation Tests
 * Validates OpenAPI specification, Swagger UI, and Postman collection
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

describe('API Documentation', () => {
  const docsDir = path.join(__dirname, '../../docs');

  describe('OpenAPI Specification', () => {
    let openApiSpec: any;

    beforeAll(() => {
      const openApiPath = path.join(docsDir, 'openapi.yaml');
      const content = fs.readFileSync(openApiPath, 'utf8');
      openApiSpec = yaml.load(content) as any;
    });

    test('should have valid OpenAPI file', () => {
      expect(openApiSpec).toBeDefined();
      expect(openApiSpec.openapi).toBe('3.0.3');
    });

    test('should have info section', () => {
      expect(openApiSpec.info).toBeDefined();
      expect(openApiSpec.info.title).toBe('Secure CAPTCHA Plugin API');
      expect(openApiSpec.info.version).toBe('1.0.0');
      expect(openApiSpec.info.description).toContain('Enterprise-grade');
    });

    test('should have servers defined', () => {
      expect(openApiSpec.servers).toBeDefined();
      expect(openApiSpec.servers.length).toBeGreaterThan(0);
      expect(openApiSpec.servers[0].url).toContain('api.secure-captcha.com');
    });

    test('should have tags defined', () => {
      expect(openApiSpec.tags).toBeDefined();
      const tagNames = openApiSpec.tags.map((t: any) => t.name);
      expect(tagNames).toContain('Health');
      expect(tagNames).toContain('CAPTCHA');
      expect(tagNames).toContain('Configuration');
      expect(tagNames).toContain('Metrics');
    });

    test('should have health endpoint', () => {
      expect(openApiSpec.paths['/health']).toBeDefined();
      expect(openApiSpec.paths['/health'].get).toBeDefined();
      expect(openApiSpec.paths['/health'].get.summary).toBe('Health Check');
      expect(openApiSpec.paths['/health'].get.responses['200']).toBeDefined();
    });

    test('should have metrics endpoint', () => {
      expect(openApiSpec.paths['/metrics']).toBeDefined();
      expect(openApiSpec.paths['/metrics'].get).toBeDefined();
      expect(openApiSpec.paths['/metrics'].get.summary).toBe('Prometheus Metrics');
    });

    test('should have captcha generate endpoint', () => {
      expect(openApiSpec.paths['/captcha/generate']).toBeDefined();
      expect(openApiSpec.paths['/captcha/generate'].post).toBeDefined();
      expect(openApiSpec.paths['/captcha/generate'].post.summary).toBe('Generate CAPTCHA');
      expect(openApiSpec.paths['/captcha/generate'].post.requestBody).toBeDefined();
    });

    test('should have captcha validate endpoint', () => {
      expect(openApiSpec.paths['/captcha/validate']).toBeDefined();
      expect(openApiSpec.paths['/captcha/validate'].post).toBeDefined();
      expect(openApiSpec.paths['/captcha/validate'].post.summary).toBe('Validate CAPTCHA Response');
    });

    test('should have captcha types endpoint', () => {
      expect(openApiSpec.paths['/captcha/types']).toBeDefined();
      expect(openApiSpec.paths['/captcha/types'].get).toBeDefined();
      expect(openApiSpec.paths['/captcha/types'].get.summary).toBe('Get Available CAPTCHA Types');
    });

    test('should have GenerateCaptchaRequest schema', () => {
      const schema = openApiSpec.components.schemas.GenerateCaptchaRequest;
      expect(schema).toBeDefined();
      expect(schema.required).toContain('type');
      expect(schema.required).toContain('difficulty');
      expect(schema.properties.type.enum).toContain('text');
      expect(schema.properties.type.enum).toContain('math');
      expect(schema.properties.type.enum).toContain('logic');
      expect(schema.properties.type.enum).toContain('image');
    });

    test('should have ValidateCaptchaRequest schema', () => {
      const schema = openApiSpec.components.schemas.ValidateCaptchaRequest;
      expect(schema).toBeDefined();
      expect(schema.required).toContain('sessionId');
      expect(schema.required).toContain('response');
      expect(schema.required).toContain('type');
    });

    test('should have ErrorResponse schema', () => {
      const schema = openApiSpec.components.schemas.ErrorResponse;
      expect(schema).toBeDefined();
      expect(schema.properties.error).toBeDefined();
    });

    test('should have security schemes defined', () => {
      expect(openApiSpec.components.securitySchemes).toBeDefined();
      expect(openApiSpec.components.securitySchemes.ApiKeyAuth).toBeDefined();
      expect(openApiSpec.components.securitySchemes.JWTAuth).toBeDefined();
    });

    test('should have examples for generate endpoint', () => {
      const examples =
        openApiSpec.paths['/captcha/generate'].post.requestBody.content['application/json']
          .examples;
      expect(examples).toBeDefined();
      expect(examples.text_easy).toBeDefined();
      expect(examples.math_medium).toBeDefined();
    });

    test('should have examples for validate endpoint', () => {
      const examples =
        openApiSpec.paths['/captcha/validate'].post.requestBody.content['application/json']
          .examples;
      expect(examples).toBeDefined();
      expect(examples.valid_response).toBeDefined();
      expect(examples.invalid_response).toBeDefined();
    });

    test('should define rate limit error response', () => {
      const responses = openApiSpec.paths['/captcha/generate'].post.responses;
      expect(responses['429']).toBeDefined();
      expect(responses['429'].content['application/json'].schema.$ref).toContain('ErrorResponse');
    });

    test('should define session expired error response', () => {
      const responses = openApiSpec.paths['/captcha/validate'].post.responses;
      expect(responses['410']).toBeDefined();
    });

    test('should define session not found error response', () => {
      const responses = openApiSpec.paths['/captcha/validate'].post.responses;
      expect(responses['404']).toBeDefined();
    });
  });

  describe('Swagger UI', () => {
    let swaggerHtml: string;

    beforeAll(() => {
      const swaggerPath = path.join(docsDir, 'swagger/index.html');
      swaggerHtml = fs.readFileSync(swaggerPath, 'utf8');
    });

    test('should have valid HTML file', () => {
      expect(swaggerHtml).toBeDefined();
      expect(swaggerHtml).toContain('<!DOCTYPE html>');
    });

    test('should have correct title', () => {
      expect(swaggerHtml).toContain('<title>Secure CAPTCHA Plugin - API Documentation</title>');
    });

    test('should include Swagger UI CSS', () => {
      expect(swaggerHtml).toContain('swagger-ui.css');
    });

    test('should include Swagger UI bundle', () => {
      expect(swaggerHtml).toContain('swagger-ui-bundle.js');
    });

    test('should include Swagger UI standalone preset', () => {
      expect(swaggerHtml).toContain('swagger-ui-standalone-preset.js');
    });

    test('should reference OpenAPI spec', () => {
      expect(swaggerHtml).toContain('../openapi.yaml');
    });

    test('should have API banner', () => {
      expect(swaggerHtml).toContain('api-banner');
      expect(swaggerHtml).toContain('Secure CAPTCHA Plugin API');
    });

    test('should have swagger-ui container', () => {
      expect(swaggerHtml).toContain('id="swagger-ui"');
    });

    test('should have deep linking enabled', () => {
      expect(swaggerHtml).toContain('deepLinking: true');
    });

    test('should have filter enabled', () => {
      expect(swaggerHtml).toContain('filter: true');
    });

    test('should have request snippets enabled', () => {
      expect(swaggerHtml).toContain('requestSnippetsEnabled: true');
    });

    test('should have multiple language generators', () => {
      expect(swaggerHtml).toContain('curl_bash');
      expect(swaggerHtml).toContain('node');
      expect(swaggerHtml).toContain('python');
    });
  });

  describe('Postman Collection', () => {
    let postmanCollection: any;

    beforeAll(() => {
      const postmanPath = path.join(docsDir, 'postman/secure-captcha-api.postman_collection.json');
      const content = fs.readFileSync(postmanPath, 'utf8');
      postmanCollection = JSON.parse(content);
    });

    test('should have valid Postman collection', () => {
      expect(postmanCollection).toBeDefined();
      expect(postmanCollection.info.name).toBe('Secure CAPTCHA Plugin API');
      expect(postmanCollection.info.schema).toContain('getpostman.com');
    });

    test('should have collection variables', () => {
      const variables = postmanCollection.variable;
      const varNames = variables.map((v: any) => v.key);
      expect(varNames).toContain('baseUrl');
      expect(varNames).toContain('apiKey');
      expect(varNames).toContain('sessionId');
    });

    test('should have baseUrl variable with correct default', () => {
      const baseUrl = postmanCollection.variable.find((v: any) => v.key === 'baseUrl');
      expect(baseUrl.value).toBe('http://localhost:3000/api/v1');
    });

    test('should have Health folder', () => {
      const healthFolder = postmanCollection.item.find((i: any) => i.name === 'Health');
      expect(healthFolder).toBeDefined();
    });

    test('should have Metrics folder', () => {
      const metricsFolder = postmanCollection.item.find((i: any) => i.name === 'Metrics');
      expect(metricsFolder).toBeDefined();
    });

    test('should have CAPTCHA folder', () => {
      const captchaFolder = postmanCollection.item.find((i: any) => i.name === 'CAPTCHA');
      expect(captchaFolder).toBeDefined();
    });

    test('should have Configuration folder', () => {
      const configFolder = postmanCollection.item.find((i: any) => i.name === 'Configuration');
      expect(configFolder).toBeDefined();
    });

    test('should have health check request', () => {
      const healthFolder = postmanCollection.item.find((i: any) => i.name === 'Health');
      const healthRequest = healthFolder.item.find((i: any) => i.name === 'Health Check');
      expect(healthRequest).toBeDefined();
      expect(healthRequest.request.method).toBe('GET');
      expect(healthRequest.request.url.path).toContain('health');
    });

    test('should have generate text captcha request', () => {
      const captchaFolder = postmanCollection.item.find((i: any) => i.name === 'CAPTCHA');
      const generateRequest = captchaFolder.item.find((i: any) => i.name.includes('Generate Text'));
      expect(generateRequest).toBeDefined();
      expect(generateRequest.request.method).toBe('POST');
    });

    test('should have generate math captcha request', () => {
      const captchaFolder = postmanCollection.item.find((i: any) => i.name === 'CAPTCHA');
      const generateRequest = captchaFolder.item.find((i: any) => i.name.includes('Generate Math'));
      expect(generateRequest).toBeDefined();
      expect(generateRequest.request.method).toBe('POST');
    });

    test('should have validate captcha request', () => {
      const captchaFolder = postmanCollection.item.find((i: any) => i.name === 'CAPTCHA');
      const validateRequest = captchaFolder.item.find((i: any) =>
        i.name.includes('Validate CAPTCHA')
      );
      expect(validateRequest).toBeDefined();
      expect(validateRequest.request.method).toBe('POST');
    });

    test('should have get captcha types request', () => {
      const configFolder = postmanCollection.item.find((i: any) => i.name === 'Configuration');
      const typesRequest = configFolder.item.find((i: any) => i.name.includes('CAPTCHA Types'));
      expect(typesRequest).toBeDefined();
      expect(typesRequest.request.method).toBe('GET');
    });

    test('should have error test cases', () => {
      const captchaFolder = postmanCollection.item.find((i: any) => i.name === 'CAPTCHA');
      const errorRequests = captchaFolder.item.filter(
        (i: any) =>
          i.name.includes('Invalid') || i.name.includes('Missing') || i.name.includes('Expired')
      );
      expect(errorRequests.length).toBeGreaterThan(0);
    });

    test('should have test scripts for session extraction', () => {
      const captchaFolder = postmanCollection.item.find((i: any) => i.name === 'CAPTCHA');
      const generateRequest = captchaFolder.item.find((i: any) => i.name.includes('Generate Text'));
      expect(generateRequest.event).toBeDefined();
      const testEvent = generateRequest.event.find((e: any) => e.listen === 'test');
      expect(testEvent).toBeDefined();
      expect(testEvent.script.exec.join('')).toContain('sessionId');
    });

    test('should have example responses', () => {
      const healthFolder = postmanCollection.item.find((i: any) => i.name === 'Health');
      const healthRequest = healthFolder.item.find((i: any) => i.name === 'Health Check');
      expect(healthRequest.response).toBeDefined();
      expect(healthRequest.response.length).toBeGreaterThan(0);
    });
  });

  describe('API Documentation Markdown', () => {
    let apiDoc: string;

    beforeAll(() => {
      const docPath = path.join(docsDir, 'API_DOCUMENTATION.md');
      apiDoc = fs.readFileSync(docPath, 'utf8');
    });

    test('should have documentation file', () => {
      expect(apiDoc).toBeDefined();
    });

    test('should have overview section', () => {
      expect(apiDoc).toContain('## Overview');
    });

    test('should have table of contents', () => {
      expect(apiDoc).toContain('## Table of Contents');
    });

    test('should have authentication section', () => {
      expect(apiDoc).toContain('## Authentication');
      expect(apiDoc).toContain('API Key Authentication');
      expect(apiDoc).toContain('JWT Token Authentication');
    });

    test('should have rate limiting section', () => {
      expect(apiDoc).toContain('## Rate Limiting');
      expect(apiDoc).toContain('Default Rate Limits');
      expect(apiDoc).toContain('Rate Limit Headers');
    });

    test('should have API versioning section', () => {
      expect(apiDoc).toContain('## API Versioning');
    });

    test('should document all endpoints', () => {
      expect(apiDoc).toContain('### Health Check');
      expect(apiDoc).toContain('### Prometheus Metrics');
      expect(apiDoc).toContain('### Generate CAPTCHA');
      expect(apiDoc).toContain('### Validate CAPTCHA');
      expect(apiDoc).toContain('### Get CAPTCHA Types');
    });

    test('should have error codes section', () => {
      expect(apiDoc).toContain('## Error Codes');
      expect(apiDoc).toContain('INVALID_REQUEST');
      expect(apiDoc).toContain('INVALID_CAPTCHA_TYPE');
      expect(apiDoc).toContain('RATE_LIMIT_EXCEEDED');
      expect(apiDoc).toContain('SESSION_NOT_FOUND');
      expect(apiDoc).toContain('SESSION_EXPIRED');
    });

    test('should have request/response examples', () => {
      expect(apiDoc).toContain('## Request/Response Examples');
      expect(apiDoc).toContain('curl');
    });

    test('should have SDK integration examples', () => {
      expect(apiDoc).toContain('## SDK Integration');
      expect(apiDoc).toContain('JavaScript/TypeScript');
      expect(apiDoc).toContain('Python');
    });

    test('should reference additional resources', () => {
      expect(apiDoc).toContain('## Additional Resources');
      expect(apiDoc).toContain('openapi.yaml');
      expect(apiDoc).toContain('swagger/index.html');
      expect(apiDoc).toContain('postman_collection.json');
    });
  });

  describe('Documentation Consistency', () => {
    test('should have consistent endpoint paths across all docs', () => {
      // Read OpenAPI spec
      const openApiPath = path.join(docsDir, 'openapi.yaml');
      const openApiContent = fs.readFileSync(openApiPath, 'utf8');
      const openApiSpec = yaml.load(openApiContent) as any;

      // Read Postman collection
      const postmanPath = path.join(docsDir, 'postman/secure-captcha-api.postman_collection.json');
      const postmanContent = JSON.parse(fs.readFileSync(postmanPath, 'utf8'));

      // Verify endpoints match
      const openApiPaths = Object.keys(openApiSpec.paths);
      expect(openApiPaths).toContain('/health');
      expect(openApiPaths).toContain('/metrics');
      expect(openApiPaths).toContain('/captcha/generate');
      expect(openApiPaths).toContain('/captcha/validate');
      expect(openApiPaths).toContain('/captcha/types');

      // Verify Postman has same endpoints
      const allRequests: string[] = [];
      postmanContent.item.forEach((folder: any) => {
        if (folder.item) {
          folder.item.forEach((request: any) => {
            if (request.request && request.request.url) {
              const url = request.request.url.path.join('/');
              allRequests.push(url);
            }
          });
        }
      });

      expect(allRequests.join(' ')).toContain('health');
      expect(allRequests.join(' ')).toContain('captcha/generate');
      expect(allRequests.join(' ')).toContain('captcha/validate');
      expect(allRequests.join(' ')).toContain('captcha/types');
    });

    test('should have consistent error codes across all docs', () => {
      // Read OpenAPI spec
      const openApiPath = path.join(docsDir, 'openapi.yaml');
      const openApiContent = fs.readFileSync(openApiPath, 'utf8');
      const openApiSpec = yaml.load(openApiContent) as any;

      // Read API documentation
      const apiDocPath = path.join(docsDir, 'API_DOCUMENTATION.md');
      const apiDoc = fs.readFileSync(apiDocPath, 'utf8');

      // Extract error codes from OpenAPI examples
      const errorCodes: string[] = [];
      Object.values(openApiSpec.paths).forEach((pathObj: any) => {
        Object.values(pathObj).forEach((operation: any) => {
          if (operation.responses) {
            Object.values(operation.responses).forEach((response: any) => {
              if (response.content && response.content['application/json']) {
                const examples = response.content['application/json'].examples;
                if (examples) {
                  Object.values(examples).forEach((example: any) => {
                    if (example.value && example.value.error && example.value.error.code) {
                      errorCodes.push(example.value.error.code);
                    }
                  });
                }
              }
            });
          }
        });
      });

      // Verify error codes are documented
      errorCodes.forEach(code => {
        expect(apiDoc).toContain(code);
      });
    });
  });
});
