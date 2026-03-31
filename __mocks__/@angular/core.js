/**
 * Mock for @angular/core
 */
const Component = jest.fn().mockImplementation((config) => (target) => target);
const Injectable = jest.fn().mockImplementation((config) => (target) => target);
const NgModule = jest.fn().mockImplementation((config) => (target) => target);
const Input = jest.fn().mockImplementation(() => (target, key) => {});
const Output = jest.fn().mockImplementation(() => (target, key) => {});
const EventEmitter = jest.fn().mockImplementation(() => ({
  emit: jest.fn(),
  subscribe: jest.fn(),
}));
const OnInit = jest.fn();
const OnDestroy = jest.fn();
const ChangeDetectionStrategy = { Default: 0, OnPush: 1 };
const ChangeDetectorRef = jest.fn().mockImplementation(() => ({
  detectChanges: jest.fn(),
  markForCheck: jest.fn(),
}));
const InjectionToken = jest.fn().mockImplementation((name) => ({ name }));
const Inject = jest.fn().mockImplementation(() => (target, key, index) => {});
const Optional = jest.fn().mockImplementation(() => (target, key, index) => {});
const ViewChild = jest.fn().mockImplementation(() => (target, key) => {});
const ViewChildren = jest.fn().mockImplementation(() => (target, key) => {});
const ContentChild = jest.fn().mockImplementation(() => (target, key) => {});
const ContentChildren = jest.fn().mockImplementation(() => (target, key) => {});
const HostBinding = jest.fn().mockImplementation(() => (target, key) => {});
const HostListener = jest.fn().mockImplementation(() => (target, key) => {});
const Directive = jest.fn().mockImplementation((config) => (target) => target);
const Pipe = jest.fn().mockImplementation((config) => (target) => target);
const ElementRef = jest.fn().mockImplementation(() => ({ nativeElement: {} }));
const TemplateRef = jest.fn();
const ViewContainerRef = jest.fn();
const Renderer2 = jest.fn();
const NgZone = jest.fn().mockImplementation(() => ({
  run: jest.fn((fn) => fn()),
  runOutsideAngular: jest.fn((fn) => fn()),
}));
const Injector = jest.fn();
const forwardRef = jest.fn((fn) => fn);
const VERSION = { full: '17.0.0', major: '17' };

module.exports = {
  Component,
  Injectable,
  NgModule,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  InjectionToken,
  Inject,
  Optional,
  ViewChild,
  ViewChildren,
  ContentChild,
  ContentChildren,
  HostBinding,
  HostListener,
  Directive,
  Pipe,
  ElementRef,
  TemplateRef,
  ViewContainerRef,
  Renderer2,
  NgZone,
  Injector,
  forwardRef,
  VERSION,
};