/**
 
 */
import {
  tavily,
  TavilyClientOptions,
  TavilySearchOptions,
  TavilySearchResponse,
} from '@tavily/core';

// rename to keep same naming style with other search providers.
export type TavilySearchConfig = TavilyClientOptions;
export type { TavilySearchOptions, TavilySearchResponse };

export { tavily };
