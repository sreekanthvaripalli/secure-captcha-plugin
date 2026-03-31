module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/__tests__/**/*.tsx',
    '**/?(*.)+(spec|test).ts',
    '**/?(*.)+(spec|test).tsx'
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
      diagnostics: true,
      useESM: true
    }]
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/types/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  projects: [
    {
      displayName: 'node',
      testMatch: ['**/*.test.ts'],
      testPathIgnorePatterns: ['/node_modules/', 'vue-captcha.test.ts'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
      transform: {
        '^.+\\.(ts|js|mjs)$': ['ts-jest', {
          tsconfig: 'tsconfig.test.json',
          diagnostics: true,
          useESM: true
        }]
      },
      transformIgnorePatterns: [
        'node_modules/(?!(uuid|@angular)/)'
      ],
    },
    {
      displayName: 'react',
      testMatch: ['**/*.test.tsx'],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/tests/setup-react.ts'],
      transform: {
        '^.+\\.[tj]sx?$': ['ts-jest', {
          tsconfig: 'tsconfig.test.json',
          diagnostics: true,
          useESM: true
        }]
      }
    },
    {
      displayName: 'vue',
      testMatch: ['**/vue-captcha.test.ts'],
      testEnvironment: 'jsdom',
      testEnvironmentOptions: {
        customExportConditions: ['node', 'node-addons'],
      },
      setupFilesAfterEnv: ['<rootDir>/tests/setup-vue.ts'],
      transform: {
        '^.+\\.ts$': ['ts-jest', {
          tsconfig: 'tsconfig.test.json',
          diagnostics: true,
          useESM: true
        }]
      }
    }
  ],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@security/(.*)$': '<rootDir>/src/security/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@tensorflow/tfjs-node$': '<rootDir>/__mocks__/@tensorflow/tfjs-node.js',
    '^uuid$': '<rootDir>/__mocks__/uuid.js',
    '^@angular/core$': '<rootDir>/__mocks__/@angular/core.js',
    '^@angular/core/testing$': '<rootDir>/__mocks__/@angular/core/testing.js',
    '^@angular/platform-browser$': '<rootDir>/__mocks__/@angular/platform-browser.js',
    '^@angular/common$': '<rootDir>/__mocks__/@angular/common.js',
    '^@angular/forms$': '<rootDir>/__mocks__/@angular/forms.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|@angular)/)'
  ],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
      diagnostics: true,
      useESM: true
    }
  }
};
