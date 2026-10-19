/**
 * Types for Orbit Browser Specialist Engine
 */

export interface BrowserAction {
  thought?: string;
  action: 'navigate' | 'click' | 'type' | 'press' | 'scroll' | 'extract' | 'wait' | 'finish';
  target?: string;
  value?: string;
  pressEnter?: boolean;
  timeoutMs?: number;
}

export interface BrowserExecutionResult {
  success: boolean;
  finalUrl?: string;
  pageTitle?: string;
  summaryMarkdown: string;
  extractedData?: any;
  error?: string;
  stepsCount: number;
}

export interface InteractiveElement {
  id: string;
  tag: string;
  type?: string;
  text: string;
  placeholder?: string;
  ariaLabel?: string;
  selector: string;
}

export interface PageSnapshot {
  url: string;
  title: string;
  interactiveElements: InteractiveElement[];
  textContentSample: string;
}
