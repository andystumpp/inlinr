const fs = require('node:fs');
const path = require('node:path');
const { renderMarkdownWithMetadata } = require('../../../out/src/rendering/markdownRenderer.js');
const { createRenderedState } = require('../../../out/src/webview/viewerState.js');

const selectionRequestScript = fs.readFileSync(
  path.resolve(__dirname, '..', '..', '..', 'media', 'markdownViewer', 'selectionRequest.js'),
  'utf8'
);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJsonForHtml(value) {
  return value.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function buildHarnessHtml(markdown, options = {}) {
  const { html, selectionMetadata } = renderMarkdownWithMetadata(markdown);
  const state = createRenderedState({
    uri: options.uri ?? 'file:///fixture.md',
    title: options.title ?? 'Fixture document',
    documentVersion: options.documentVersion ?? 1,
    html,
    selectionMetadata,
    activeRequest: options.activeRequest ?? null
  });
  if (options.firstActionGuidance) {
    state.firstActionGuidance = {
      ...options.firstActionGuidance
    };
  }
  const serializedState = escapeJsonForHtml(JSON.stringify(state));

  return {
    state,
    selectionMetadata,
    html: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(state.title)}</title>
    <style>
      body {
        margin: 0;
        font-family: sans-serif;
        line-height: 1.5;
      }

      .viewer-main {
        max-width: 720px;
        padding: 24px;
      }

      .selection-request-root {
        position: absolute;
        z-index: 10;
        max-width: 560px;
      }

      .selection-request-target {
        outline: 2px solid #4f8cff;
      }
    </style>
  </head>
  <body class="viewer-shell" data-state-kind="${state.kind}">
    <main class="viewer-main">
      <article class="viewer-document markdown-body" data-selection-mode="${state.selectionMode}">${state.html}</article>
      <section class="selection-inline-review-root" data-selection-inline-review-root hidden></section>
      <aside class="first-action-guidance-root" data-first-action-guidance-root hidden></aside>
      <aside class="selection-request-root" data-selection-request-root hidden></aside>
    </main>
    <script>
      (() => {
        const originalRangeGetBoundingClientRect = Range.prototype.getBoundingClientRect;
        const originalElementGetBoundingClientRect = Element.prototype.getBoundingClientRect;

        function toDomRect(rect) {
          return {
            x: rect.left,
            y: rect.top,
            top: rect.top,
            left: rect.left,
            bottom: rect.bottom,
            right: rect.right,
            width: rect.width,
            height: rect.height,
            toJSON() {
              return this;
            }
          };
        }

        window.__inlinrPostedMessages = [];
        window.__inlinrRectOverrides = {
          rangeRect: null,
          regionRects: {}
        };
        window.acquireVsCodeApi = () => ({
          postMessage(message) {
            window.__inlinrPostedMessages.push(message);
          }
        });

        Range.prototype.getBoundingClientRect = function () {
          if (window.__inlinrRectOverrides.rangeRect) {
            return toDomRect(window.__inlinrRectOverrides.rangeRect);
          }

          return originalRangeGetBoundingClientRect.call(this);
        };

        Element.prototype.getBoundingClientRect = function () {
          const regionId = this instanceof HTMLElement ? this.dataset.selectionRegionId : undefined;
          const override = regionId ? window.__inlinrRectOverrides.regionRects[regionId] : undefined;

          if (override) {
            return toDomRect(override);
          }

          return originalElementGetBoundingClientRect.call(this);
        };
      })();
    </script>
    <script id="inlinr-viewer-state" type="application/json">${serializedState}</script>
    <script>${selectionRequestScript}</script>
  </body>
</html>`
  };
}

async function mountWebview(page, options) {
  const fixture = buildHarnessHtml(options.markdown, options);
  await page.setContent(fixture.html, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    return document.body.dataset.selectionMode === 'enabled';
  });
  return fixture;
}

async function getRegionIds(page) {
  return page.locator('[data-selection-region-id]').evaluateAll((elements) => {
    return elements
      .map((element) => element.getAttribute('data-selection-region-id'))
      .filter(Boolean);
  });
}

async function findRegionIdContainingText(page, text) {
  return page.locator('[data-selection-region-id]').evaluateAll((elements, expectedText) => {
    const match = elements.find((element) => element.textContent.includes(expectedText));
    return match ? match.getAttribute('data-selection-region-id') : null;
  }, text);
}

async function selectFragment(page, selection) {
  await page.evaluate(({ startRegionId, startText, endRegionId, endText, reverse }) => {
    function getRegionElement(regionId) {
      return document.querySelector(`[data-selection-region-id="${regionId}"]`);
    }

    function resolveOffsetFromText(regionId, text, useEnd) {
      const element = getRegionElement(regionId);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Could not find region ${regionId}.`);
      }

      const content = element.textContent || '';
      const startIndex = content.indexOf(text);
      if (startIndex === -1) {
        throw new Error(`Could not find "${text}" in region ${regionId}.`);
      }

      return {
        element,
        offset: useEnd ? startIndex + text.length : startIndex
      };
    }

    function resolveTextNodePosition(element, targetOffset) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let traversed = 0;
      let currentNode = walker.nextNode();

      while (currentNode) {
        const nextTraversed = traversed + currentNode.textContent.length;
        if (targetOffset <= nextTraversed) {
          return {
            node: currentNode,
            offset: targetOffset - traversed
          };
        }

        traversed = nextTraversed;
        currentNode = walker.nextNode();
      }

      if (!element.lastChild) {
        throw new Error(`Could not resolve text node position for offset ${targetOffset}.`);
      }

      return {
        node: element.lastChild,
        offset: element.lastChild.textContent ? element.lastChild.textContent.length : 0
      };
    }

    const start = resolveOffsetFromText(startRegionId, startText, false);
    const end = resolveOffsetFromText(endRegionId, endText, true);
    const startPosition = resolveTextNodePosition(start.element, start.offset);
    const endPosition = resolveTextNodePosition(end.element, end.offset);
    const browserSelection = window.getSelection();

    browserSelection.removeAllRanges();

    if (reverse && typeof browserSelection.setBaseAndExtent === 'function') {
      browserSelection.setBaseAndExtent(
        endPosition.node,
        endPosition.offset,
        startPosition.node,
        startPosition.offset
      );
    } else {
      const range = document.createRange();
      range.setStart(startPosition.node, startPosition.offset);
      range.setEnd(endPosition.node, endPosition.offset);
      browserSelection.addRange(range);

      if (reverse && typeof browserSelection.extend === 'function') {
        browserSelection.collapse(endPosition.node, endPosition.offset);
        browserSelection.extend(startPosition.node, startPosition.offset);
      }
    }

    document.querySelector('.viewer-document').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }, selection);
}

async function getPostedMessages(page) {
  return page.evaluate(() => window.__inlinrPostedMessages.slice());
}

async function clearPostedMessages(page) {
  await page.evaluate(() => {
    window.__inlinrPostedMessages.length = 0;
  });
}

async function setRangeRectOverride(page, rect) {
  await page.evaluate((nextRect) => {
    window.__inlinrRectOverrides.rangeRect = nextRect;
  }, rect);
}

async function setRegionRectOverrides(page, regionRects) {
  await page.evaluate((nextRegionRects) => {
    window.__inlinrRectOverrides.regionRects = nextRegionRects;
  }, regionRects);
}

async function postExtensionMessage(page, message) {
  await page.evaluate((nextMessage) => {
    window.dispatchEvent(new MessageEvent('message', { data: nextMessage }));
  }, message);
}

async function cancelActiveRequest(page) {
  await page.locator('body').dispatchEvent('pointerdown');
}

async function isRequestRootHidden(page) {
  return page.locator('[data-selection-request-root]').evaluate((element) => element.hidden);
}

function createFirstActionGuidanceState(overrides = {}) {
  return {
    title: overrides.title ?? 'Welcome to Inlinr — edit Markdown by asking, right where you select',
    body: overrides.body ?? 'Highlight Markdown you want to change, then describe the edit.',
    dismissLabel: overrides.dismissLabel ?? 'Got it',
    completionState: overrides.completionState ?? 'pending'
  };
}

function getFirstActionGuidance(page) {
  return page.locator('[data-first-action-guidance-root]');
}

async function isFirstActionGuidanceHidden(page) {
  return getFirstActionGuidance(page).evaluate((element) => element.hidden);
}

async function dismissFirstActionGuidance(page) {
  await page.locator('[data-first-action-guidance-dismiss]').first().click();
}

async function getTargetedRegionIds(page) {
  return page.locator('.selection-request-target').evaluateAll((elements) => {
    return elements
      .map((element) => element.getAttribute('data-selection-region-id'))
      .filter(Boolean);
  });
}

function createAcceptedSelectionMessage(captureMessage, overrides = {}) {
  return {
    type: 'selection.accepted',
    sessionId: overrides.sessionId ?? 'session-1',
    selectedTextPreview: overrides.selectedTextPreview ?? captureMessage.selectedText,
    selectedRegionIds: overrides.selectedRegionIds ?? captureMessage.renderedRegionIds,
    draftText: overrides.draftText ?? '',
    validationState: overrides.validationState ?? 'drafting',
    validationMessage: overrides.validationMessage
  };
}

module.exports = {
  cancelActiveRequest,
  clearPostedMessages,
  createAcceptedSelectionMessage,
  createFirstActionGuidanceState,
  dismissFirstActionGuidance,
  findRegionIdContainingText,
  getFirstActionGuidance,
  getPostedMessages,
  getRegionIds,
  getTargetedRegionIds,
  isFirstActionGuidanceHidden,
  isRequestRootHidden,
  mountWebview,
  postExtensionMessage,
  selectFragment,
  setRangeRectOverride,
  setRegionRectOverrides
};
