/**
 * Mock for @angular/forms
 */
const FormsModule = jest.fn().mockImplementation(() => ({
  ngModule: class FormsModule {},
}));
const ReactiveFormsModule = jest.fn().mockImplementation(() => ({
  ngModule: class ReactiveFormsModule {},
}));
const NgModel = jest.fn();
const FormControl = jest.fn().mockImplementation((value, validators) => ({
  value,
  setValue: jest.fn(),
  patchValue: jest.fn(),
  reset: jest.fn(),
  markAsTouched: jest.fn(),
  markAsDirty: jest.fn(),
  markAsPristine: jest.fn(),
  markAsUntouched: jest.fn(),
  updateValueAndValidity: jest.fn(),
  valid: true,
  invalid: false,
  dirty: false,
  pristine: true,
  touched: false,
  untouched: true,
  errors: null,
  valueChanges: { subscribe: jest.fn() },
  statusChanges: { subscribe: jest.fn() },
}));
const FormGroup = jest.fn().mockImplementation((controls) => ({
  controls,
  value: {},
  setValue: jest.fn(),
  patchValue: jest.fn(),
  reset: jest.fn(),
  markAsTouched: jest.fn(),
  markAsDirty: jest.fn(),
  markAsPristine: jest.fn(),
  markAsUntouched: jest.fn(),
  updateValueAndValidity: jest.fn(),
  valid: true,
  invalid: false,
  dirty: false,
  pristine: true,
  touched: false,
  untouched: true,
  errors: null,
  valueChanges: { subscribe: jest.fn() },
  statusChanges: { subscribe: jest.fn() },
  get: jest.fn((name) => controls[name] || null),
}));
const FormArray = jest.fn().mockImplementation((controls) => ({
  controls,
  value: [],
  push: jest.fn(),
  removeAt: jest.fn(),
  insert: jest.fn(),
  setValue: jest.fn(),
  patchValue: jest.fn(),
  reset: jest.fn(),
  markAsTouched: jest.fn(),
  markAsDirty: jest.fn(),
  markAsPristine: jest.fn(),
  markAsUntouched: jest.fn(),
  updateValueAndValidity: jest.fn(),
  valid: true,
  invalid: false,
  dirty: false,
  pristine: true,
  touched: false,
  untouched: true,
  errors: null,
  valueChanges: { subscribe: jest.fn() },
  statusChanges: { subscribe: jest.fn() },
  at: jest.fn((index) => controls[index] || null),
}));
const Validators = {
  required: jest.fn(),
  minLength: jest.fn(),
  maxLength: jest.fn(),
  pattern: jest.fn(),
  email: jest.fn(),
  min: jest.fn(),
  max: jest.fn(),
  nullValidator: jest.fn(),
  compose: jest.fn(),
  composeAsync: jest.fn(),
};
const NG_VALUE_ACCESSOR = jest.fn();
const NG_VALIDATORS = jest.fn();
const DefaultValueAccessor = jest.fn();
const CheckboxControlValueAccessor = jest.fn();
const SelectControlValueAccessor = jest.fn();
const RadioControlValueAccessor = jest.fn();

module.exports = {
  FormsModule,
  ReactiveFormsModule,
  NgModel,
  FormControl,
  FormGroup,
  FormArray,
  Validators,
  NG_VALUE_ACCESSOR,
  NG_VALIDATORS,
  DefaultValueAccessor,
  CheckboxControlValueAccessor,
  SelectControlValueAccessor,
  RadioControlValueAccessor,
};