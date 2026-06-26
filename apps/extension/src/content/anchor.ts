import {
  describeTextQuote,
  createTextQuoteSelectorMatcher,
  createTextPositionSelectorMatcher,
  highlightText,
} from '@apache-annotator/dom';
import type { Annotation } from '@highlighter/core';

export const HIGHLIGHT_ATTR = 'data-wh-id';
export const DEFAULT_COLOR = '#fef08a';

export interface SelectionData {
  quote: string;
  prefix: string;
  suffix: string;
  textPosition?: { start: number; end: number };
  range: Range;
}

export async function describeSelection(range: Range): Promise<SelectionData> {
  const sel = await describeTextQuote(range, document.body);
  return {
    quote: sel.exact,
    prefix: sel.prefix ?? '',
    suffix: sel.suffix ?? '',
    textPosition: getTextPosition(range),
    range: range.cloneRange(),
  };
}

function getTextPosition(range: Range): { start: number; end: number } | undefined {
  try {
    const pre = document.createRange();
    pre.setStart(document.body, 0);
    pre.setEnd(range.startContainer, range.startOffset);
    const start = pre.toString().length;
    return { start, end: start + range.toString().length };
  } catch {
    return undefined;
  }
}

export async function anchorAnnotation(annotation: Annotation): Promise<(() => void) | null> {
  // Strategy 1: TextQuoteSelector with prefix/suffix
  try {
    const matcher = createTextQuoteSelectorMatcher({
      type: 'TextQuoteSelector',
      exact: annotation.quote,
      prefix: annotation.prefix || undefined,
      suffix: annotation.suffix || undefined,
    });
    const gen = matcher(document.body);
    const { value, done } = await gen.next();
    if (!done && value) {
      return applyHighlight(annotation.id, annotation.color, value);
    }
  } catch {
    // fall through to strategy 2
  }

  // Strategy 2: TextPositionSelector
  if (annotation.textPosition) {
    try {
      const matcher = createTextPositionSelectorMatcher({
        type: 'TextPositionSelector',
        start: annotation.textPosition.start,
        end: annotation.textPosition.end,
      });
      const gen = matcher(document.body);
      const { value, done } = await gen.next();
      if (!done && value) {
        return applyHighlight(annotation.id, annotation.color, value);
      }
    } catch {
      // fall through
    }
  }

  // Strategy 3: orphaned — don't render
  return null;
}

function applyHighlight(id: string, color: string, range: Range): () => void {
  return highlightText(range, 'mark', {
    [HIGHLIGHT_ATTR]: id,
    style: `background-color:${color};cursor:pointer;border-radius:2px;`,
  });
}

export function applyHighlightToRange(id: string, color: string, range: Range): () => void {
  return applyHighlight(id, color, range);
}
