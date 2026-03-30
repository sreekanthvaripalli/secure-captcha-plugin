/**
 * Type declarations for @testing-library/jest-dom
 */

import '@testing-library/jest-dom';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveTextContent(text: string | RegExp): R;
      toHaveValue(value: string | string[] | number | null): R;
      toBeDisabled(): R;
      toBeEnabled(): R;
      toHaveClass(...classNames: string[]): R;
      toHaveStyle(css: string | Record<string, any>): R;
      toHaveAttribute(attr: string, value?: any): R;
      toHaveFocus(): R;
      toBeVisible(): R;
      toBeEmpty(): R;
      toBeEmptyDOMElement(): R;
      toContainElement(element: HTMLElement | null): R;
      toContainHTML(htmlText: string): R;
      toHaveDescription(text: string | RegExp): R;
      toHaveErrorMessage(text: string | RegExp): R;
      toHaveFormValues(expectedValues: Record<string, any>): R;
      toBeChecked(): R;
      toBePartiallyChecked(): R;
      toHaveDisplayValue(value: string | RegExp | (string | RegExp)[]): R;
      toBeInvalid(): R;
      toBeRequired(): R;
      toBeValid(): R;
      toHaveAccessibleDescription(description?: string | RegExp): R;
      toHaveAccessibleName(name?: string | RegExp): R;
      toHaveRole(role: string): R;
    }
  }
}
