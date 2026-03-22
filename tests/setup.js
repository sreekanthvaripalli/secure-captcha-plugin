"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
63;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.POSTGRES_HOST = 'localhost';
process.env.POSTGRES_PORT = '5432';
process.env.POSTGRES_DB = 'secure_captcha_test';
process.env.POSTGRES_USER = 'test_user';
process.env.POSTGRES_PASSWORD = 'test_password';
jest.setTimeout(30000);
global.testUtils = {
    generateRandomString: (length) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },
    generateTestEmail: () => {
        return `test-${Date.now()}@example.com`;
    },
    wait: (ms) => {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
beforeAll(() => {
    if (!process.env.DEBUG) {
        console.log = jest.fn();
        console.error = jest.fn();
        console.warn = jest.fn();
    }
});
afterAll(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
});
afterEach(() => {
    jest.clearAllMocks();
});
//# sourceMappingURL=setup.js.map