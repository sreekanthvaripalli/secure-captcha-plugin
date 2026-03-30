/**
 * React Testing Setup
 * Configures jest-dom matchers for React component tests
 */

require('@testing-library/jest-dom');

// Configure React testing library
const { configure } = require('@testing-library/react');

configure({
  testIdAttribute: 'data-testid',
});
