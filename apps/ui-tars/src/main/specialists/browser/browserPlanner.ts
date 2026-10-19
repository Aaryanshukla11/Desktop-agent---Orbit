import { SettingStore } from '../../store/setting';
import { logger } from '../../logger';
import type { BrowserAction, PageSnapshot } from './types';

export class BrowserPlanner {
  public async planNextAction(
    goalInstructions: string,
    currentSnapshot: PageSnapshot,
    actionHistory: BrowserAction[] = [],
  ): Promise<BrowserAction> {
    const settings = SettingStore.getStore();

    let baseUrl = settings.vlmBaseUrl?.trim() || process.env.VLM_BASE_URL || process.env.OPENAI_BASE_URL || '';
    const apiKey = settings.vlmApiKey?.trim() || process.env.VLM_API_KEY || process.env.OPENAI_API_KEY || '';
    const model = settings.vlmModelName?.trim() || process.env.VLM_MODEL_NAME || process.env.OPENAI_MODEL_NAME || 'gpt-4o';

    if (!baseUrl && apiKey) {
      baseUrl = 'https://api.openai.com/v1';
    }

    if (baseUrl && apiKey) {
      try {
        const aiAction = await this.queryLlmForAction(goalInstructions, currentSnapshot, actionHistory, baseUrl, apiKey, model);
        if (aiAction) {
          return aiAction;
        }
      } catch (err: any) {
        logger.warn(`[BrowserPlanner] LLM action generation failed: ${err?.message || err}. Using heuristic planner.`);
      }
    }

    return this.fallbackHeuristicAction(goalInstructions, currentSnapshot, actionHistory);
  }

  private async queryLlmForAction(
    goal: string,
    snapshot: PageSnapshot,
    history: BrowserAction[],
    baseUrl: string,
    apiKey: string,
    model: string,
  ): Promise<BrowserAction | null> {
    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    const endpoint = `${cleanBaseUrl}/chat/completions`;

    const elementsJson = JSON.stringify(
      snapshot.interactiveElements.map((el) => ({
        id: el.id,
        tag: el.tag,
        text: el.text,
        placeholder: el.placeholder,
        selector: el.selector,
      })),
      null,
      2,
    );

    const historySummary = history.map((h, i) => `${i + 1}. [${h.action}] target="${h.target || ''}" value="${h.value || ''}"`).join('\n') || 'None';

    const systemPrompt = `You are the ORBIT Browser Specialist Agent.
Your job is to inspect the current web page and choose the single next deterministic action to accomplish the user's goal.

Output strictly valid JSON with this exact schema:
{
  "thought": "brief explanation of reasoning",
  "action": "navigate" | "click" | "type" | "scroll" | "extract" | "wait" | "finish",
  "target": "CSS selector or element text/placeholder (if applicable)",
  "value": "string value to type or URL to navigate (if applicable)",
  "pressEnter": true or false (optional, true if submitting search/form after typing)
}

Rules:
1. Prefer explicit CSS selectors or ID/name from the Available Interactive Elements list.
2. If the goal requires going to a website and we are on 'about:blank', output "action": "navigate", "value": "https://...".
3. When searching, you can type with "pressEnter": true.
4. When the goal is completely achieved, output "action": "finish".
5. Do NOT include markdown code fences or conversational text outside the JSON.`;

    const userPrompt = `User Goal: "${goal}"

Current URL: ${snapshot.url}
Page Title: "${snapshot.title}"

Action History:
${historySummary}

Available Interactive Elements (Top 40):
${elementsJson}

Page Text Snippet:
${snapshot.textContentSample.slice(0, 800)}

Choose the NEXT single action in JSON:`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) return null;

      const parsed = JSON.parse(content);
      if (parsed.action) {
        return parsed as BrowserAction;
      }
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private fallbackHeuristicAction(
    goal: string,
    snapshot: PageSnapshot,
    history: BrowserAction[],
  ): BrowserAction {
    const lower = goal.toLowerCase();

    // Step 1: Initial navigation if at about:blank or starting
    if (history.length === 0 || snapshot.url === 'about:blank' || !snapshot.url.startsWith('http')) {
      if (lower.includes('google')) return { action: 'navigate', value: 'https://www.google.com', thought: 'Navigating to Google' };
      if (lower.includes('youtube')) return { action: 'navigate', value: 'https://www.youtube.com', thought: 'Navigating to YouTube' };
      if (lower.includes('amazon')) return { action: 'navigate', value: 'https://www.amazon.com', thought: 'Navigating to Amazon' };
      if (lower.includes('github')) return { action: 'navigate', value: 'https://www.github.com', thought: 'Navigating to GitHub' };
      if (lower.includes('reddit')) return { action: 'navigate', value: 'https://www.reddit.com', thought: 'Navigating to Reddit' };
      if (lower.includes('wikipedia')) return { action: 'navigate', value: 'https://www.wikipedia.org', thought: 'Navigating to Wikipedia' };
      
      const urlMatch = goal.match(/(https?:\/\/[^\s]+|[a-zA-Z0-9-]+\.(com|org|io|net|edu|gov|co|in)[^\s]*)/i);
      if (urlMatch) {
        const u = urlMatch[0].startsWith('http') ? urlMatch[0] : `https://${urlMatch[0]}`;
        return { action: 'navigate', value: u, thought: `Navigating directly to ${u}` };
      }

      // Default to Google search
      return {
        action: 'navigate',
        value: `https://www.google.com/search?q=${encodeURIComponent(goal)}`,
        thought: 'Navigating to Google Search with user query',
      };
    }

    // Step 2: If on search page and haven't searched yet, find input box
    const searchInput = snapshot.interactiveElements.find(
      (el) =>
        el.tag === 'input' &&
        (el.type === 'text' || el.type === 'search' || !el.type) &&
        (el.placeholder?.toLowerCase().includes('search') || el.ariaLabel?.toLowerCase().includes('search') || el.selector.includes('q') || el.selector.includes('search')),
    );

    if (searchInput && history.length === 1 && history[0].action === 'navigate') {
      return {
        action: 'type',
        target: searchInput.selector,
        value: goal.replace(/^(search|look up|find|open)\s+/i, ''),
        pressEnter: true,
        thought: 'Typing search query into detected search input',
      };
    }

    // Step 3: Finish if we have already navigated and searched/clicked
    if (history.length >= 2) {
      return {
        action: 'finish',
        thought: 'Task completed and results loaded.',
      };
    }

    return {
      action: 'extract',
      thought: 'Extracting page content to fulfill request',
    };
  }
}
