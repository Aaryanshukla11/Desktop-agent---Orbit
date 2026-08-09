/*
 
 */

import { Agent } from '../../../src';

/**
 * Mock Agent data type for improved type safety in tests
 */
export interface MockAgentData {
  options: {
    timeout: number;
    retries: number;
    [key: string]: any;
  };
  state: {
    initialized: boolean;
    running: boolean;
    [key: string]: any;
  };
}

/**
 * Type guard to verify if an object is an Agent instance
 */
export function isAgent(obj: any): obj is Agent {
  return obj instanceof Agent;
}
