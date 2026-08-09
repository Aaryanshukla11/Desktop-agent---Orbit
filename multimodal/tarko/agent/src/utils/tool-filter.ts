/*
 
 */

import { Tool, AgentToolFilterOptions } from '@tarko/agent-interface';
import { filterItems } from '@tarko/shared-utils';

/**
 * Filter tools based on include/exclude patterns
 *
 * @param tools Array of tools to filter
 * @param filterOptions Filter configuration with include/exclude patterns
 * @returns Filtered array of tools
 */
export function filterTools(tools: Tool[], filterOptions?: AgentToolFilterOptions): Tool[] {
  return filterItems(tools, filterOptions, 'tools');
}
