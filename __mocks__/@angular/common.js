/**
 * Mock for @angular/common
 */
const CommonModule = jest.fn().mockImplementation(() => ({
  ngModule: class CommonModule {},
}));
const NgIf = jest.fn();
const NgFor = jest.fn();
const NgStyle = jest.fn();
const NgClass = jest.fn();
const NgSwitch = jest.fn();
const NgSwitchCase = jest.fn();
const NgSwitchDefault = jest.fn();
const NgTemplateOutlet = jest.fn();
const NgComponentOutlet = jest.fn();
const DatePipe = jest.fn();
const UpperCasePipe = jest.fn();
const LowerCasePipe = jest.fn();
const CurrencyPipe = jest.fn();
const DecimalPipe = jest.fn();
const PercentPipe = jest.fn();
const SlicePipe = jest.fn();
const TitleCasePipe = jest.fn();
const JsonPipe = jest.fn();
const AsyncPipe = jest.fn();
const Location = jest.fn().mockImplementation(() => ({
  go: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
}));
const DOCUMENT = jest.fn();

module.exports = {
  CommonModule,
  NgIf,
  NgFor,
  NgStyle,
  NgClass,
  NgSwitch,
  NgSwitchCase,
  NgSwitchDefault,
  NgTemplateOutlet,
  NgComponentOutlet,
  DatePipe,
  UpperCasePipe,
  LowerCasePipe,
  CurrencyPipe,
  DecimalPipe,
  PercentPipe,
  SlicePipe,
  TitleCasePipe,
  JsonPipe,
  AsyncPipe,
  Location,
  DOCUMENT,
};