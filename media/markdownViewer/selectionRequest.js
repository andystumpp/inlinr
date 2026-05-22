(function () {
  const vscodeApi = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
  let viewerState = null;
  let activeRequest = null;
  let pendingSelectionRect = null;
  let requestRoot = null;
  let inlineReviewRoot = null;

  function parseViewerState() {
    const stateElement = document.getElementById('inlinr-viewer-state');

    if (!stateElement || !stateElement.textContent) {
      return null;
    }

    try {
      return JSON.parse(stateElement.textContent);
    } catch {
      return null;
    }
  }

  function postMessage(message) {
    if (!vscodeApi) {
      return;
    }

    vscodeApi.postMessage(message);
  }

  function getSelectionRectFromRange(range) {
    const selectionRect = range.getBoundingClientRect();

    if (!selectionRect || (selectionRect.width === 0 && selectionRect.height === 0)) {
      return null;
    }

    return {
      top: selectionRect.top,
      left: selectionRect.left,
      bottom: selectionRect.bottom,
      right: selectionRect.right
    };
  }

  function resolveOverlayPosition(selectionRect) {
    if (!selectionRect) {
      return null;
    }

    const selection = window.getSelection();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const viewportPadding = 12;
    const popoverWidth = Math.min(420, Math.max(280, viewportWidth - viewportPadding * 2));
    const estimatedPopoverHeight = 260;
    const preferredTop = selectionRect.bottom + viewportPadding;
    const preferredLeft = selectionRect.left;
    const maxLeft = Math.max(viewportPadding, viewportWidth - popoverWidth - viewportPadding);
    const anchorLeft = Math.min(maxLeft, Math.max(viewportPadding, preferredLeft));
    const fitsBelowSelection = preferredTop + estimatedPopoverHeight <= viewportHeight - viewportPadding;
    const anchorTop = fitsBelowSelection
      ? preferredTop
      : Math.max(viewportPadding, selectionRect.top - estimatedPopoverHeight - viewportPadding);

    return {
      anchorTop,
      anchorLeft
    };
  }

  function getSelectableRegionElementsFromRange(range) {
    const documentRoot = document.querySelector('.viewer-document');

    if (!(documentRoot instanceof HTMLElement)) {
      return [];
    }

    return Array.from(documentRoot.querySelectorAll('[data-selection-region-id][data-selection-selectable="true"]')).filter(
      function (element) {
        return element instanceof HTMLElement && range.intersectsNode(element);
      }
    );
  }

  function getRegionElementsByIds(regionIds) {
    return regionIds
      .map(function (regionId) {
        return document.querySelector('[data-selection-region-id="' + regionId + '"]');
      })
      .filter(function (element) {
        return element instanceof HTMLElement;
      });
  }

  function getSelectionRectFromRegionIds(regionIds) {
    const regionElements = getRegionElementsByIds(regionIds);

    if (regionElements.length === 0) {
      return null;
    }

    return regionElements.reduce(
      function (combinedRect, element) {
        const rect = element.getBoundingClientRect();

        if (!combinedRect) {
          return {
            top: rect.top,
            left: rect.left,
            bottom: rect.bottom,
            right: rect.right
          };
        }

        return {
          top: Math.min(combinedRect.top, rect.top),
          left: Math.min(combinedRect.left, rect.left),
          bottom: Math.max(combinedRect.bottom, rect.bottom),
          right: Math.max(combinedRect.right, rect.right)
        };
      },
      null
    );
  }

  function findSelectionMessage(currentViewerState) {
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : '';

    if (!selection || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);
    const regionElements = getSelectableRegionElementsFromRange(range);
    const firstRegion = regionElements[0];
    const lastRegion = regionElements[regionElements.length - 1];
    const selectionRect = getSelectionRectFromRange(range);

    if (!selectedText || !firstRegion || !lastRegion || !selectionRect) {
      return null;
    }

    const startMarker = firstRegion.dataset.selectionStartMarker;
    const endMarker = lastRegion.dataset.selectionEndMarker;
    const renderedRegionIds = regionElements
      .map(function (element) {
        return element.dataset.selectionRegionId || '';
      })
      .filter(Boolean);

    if (!startMarker || !endMarker || renderedRegionIds.length === 0) {
      return null;
    }

    pendingSelectionRect = selectionRect;

    return {
      type: 'selection.capture',
      documentVersion: currentViewerState.documentVersion,
      selectedText,
      startMarker,
      endMarker,
      renderedRegionIds,
      selectionRect
    };
  }

  function getOverlaySelectionRect() {
    if (activeRequest && activeRequest.selectionRect) {
      return activeRequest.selectionRect;
    }

    if (!activeRequest) {
      return null;
    }

    return getSelectionRectFromRegionIds(activeRequest.selectedRegionIds);
  }

  function clearActiveRequestOverlay() {
    activeRequest = null;
    pendingSelectionRect = null;

    clearInlineReview();
    syncSelectedRegionState();

    if (!requestRoot) {
      return;
    }

    requestRoot.hidden = true;
    requestRoot.innerHTML = '';
  }

  function blocksReplacementSelection() {
    return !!activeRequest && (
      activeRequest.validationState === 'submitting' ||
      activeRequest.validationState === 'submitted' ||
      activeRequest.validationState === 'executing' ||
      activeRequest.validationState === 'review' ||
      activeRequest.validationState === 'applying'
    );
  }

  function syncOverlayPosition() {
    if (!requestRoot || !activeRequest) {
      return;
    }

    const selectionRect = getOverlaySelectionRect();
    const overlayPosition = resolveOverlayPosition(selectionRect);

    if (!overlayPosition) {
      requestRoot.hidden = true;
      return;
    }

    requestRoot.style.top = overlayPosition.anchorTop + 'px';
    requestRoot.style.left = overlayPosition.anchorLeft + 'px';
    requestRoot.hidden = false;
  }

  function syncSubmitButtonState() {
    if (!requestRoot || !activeRequest) {
      return;
    }

    const submitButton = requestRoot.querySelector('[data-selection-request-submit]');

    if (!(submitButton instanceof HTMLButtonElement)) {
      return;
    }

    submitButton.disabled =
      activeRequest.validationState === 'submitted' ||
      activeRequest.validationState === 'submitting' ||
      activeRequest.validationState === 'executing' ||
      activeRequest.validationState === 'review' ||
      activeRequest.draftText.trim().length === 0;
  }

  function isReviewState() {
    return !!activeRequest && activeRequest.validationState === 'review' && activeRequest.suggestion;
  }

  function shouldRenderInlinePanel() {
    return !!activeRequest && (
      activeRequest.validationState === 'submitted' ||
      activeRequest.validationState === 'executing' ||
      activeRequest.validationState === 'review' ||
      activeRequest.validationState === 'applying'
    );
  }

  function clearInlineReview() {
    if (!inlineReviewRoot) {
      return;
    }

    inlineReviewRoot.hidden = true;
    inlineReviewRoot.innerHTML = '';
  }

  function syncSelectedRegionState() {
    document.querySelectorAll('.selection-request-target, .selection-request-target-review').forEach(function (element) {
      if (!(element instanceof HTMLElement)) {
        return;
      }

      element.classList.remove('selection-request-target', 'selection-request-target-review');
    });

    if (!activeRequest) {
      return;
    }

    getRegionElementsByIds(activeRequest.selectedRegionIds).forEach(function (element) {
      element.classList.add('selection-request-target');

      if (shouldRenderInlinePanel()) {
        element.classList.add('selection-request-target-review');
      }
    });
  }

  function renderInlineReview() {
    if (!inlineReviewRoot || !activeRequest || !shouldRenderInlinePanel()) {
      clearInlineReview();
      return;
    }

    const regionElements = getRegionElementsByIds(activeRequest.selectedRegionIds);

    if (regionElements.length === 0) {
      clearInlineReview();
      return;
    }

    const lastRegion = regionElements[regionElements.length - 1];
    lastRegion.insertAdjacentElement('afterend', inlineReviewRoot);

    if (isReviewState()) {
      const reviewSuggestion = getReviewSuggestionPresentation();

      inlineReviewRoot.innerHTML = `
        <section class="selection-inline-review" aria-label="Selection review">
          <p class="selection-inline-review-kicker">Review suggestion</p>
          <div class="selection-inline-review-grid">
            <section class="selection-inline-review-block">
              <p class="selection-inline-review-label">Current selection</p>
              <pre class="selection-inline-review-content">${escapeHtml(activeRequest.selectedTextPreview)}</pre>
            </section>
            <section class="selection-inline-review-block selection-inline-review-block-proposed">
              <p class="selection-inline-review-label">${escapeHtml(reviewSuggestion.label)}</p>
              <pre class="selection-inline-review-content">${escapeHtml(reviewSuggestion.body)}</pre>
            </section>
          </div>
          <p class="selection-inline-review-status">${escapeHtml(activeRequest.validationMessage || 'Suggestion ready.')}</p>
          <div class="selection-inline-review-actions">
            <button type="button" class="selection-request-button selection-request-button-secondary" data-selection-request-reject>Reject</button>
            <button type="button" class="selection-request-button" data-selection-request-apply>Apply</button>
          </div>
        </section>`;

      const rejectButton = inlineReviewRoot.querySelector('[data-selection-request-reject]');
      const applyButton = inlineReviewRoot.querySelector('[data-selection-request-apply]');

      if (rejectButton instanceof HTMLButtonElement) {
        rejectButton.addEventListener('click', function () {
          if (!activeRequest || !activeRequest.suggestion) {
            return;
          }

          postMessage({
            type: 'suggestion.reject',
            sessionId: activeRequest.sessionId,
            proposalId: activeRequest.suggestion.proposalId
          });
        });
      }

      if (applyButton instanceof HTMLButtonElement) {
        applyButton.addEventListener('click', function () {
          if (!activeRequest || !activeRequest.suggestion) {
            return;
          }

          activeRequest.validationState = 'applying';
          activeRequest.validationMessage = 'Applying suggestion…';
          renderOverlay();
          postMessage({
            type: 'suggestion.apply',
            sessionId: activeRequest.sessionId,
            proposalId: activeRequest.suggestion.proposalId
          });
        });
      }
    } else {
      inlineReviewRoot.innerHTML = `
        <section class="selection-inline-review selection-inline-review-pending" aria-live="polite">
          <p class="selection-inline-review-kicker">Processing request</p>
          <p class="selection-inline-review-status">${escapeHtml(activeRequest.validationMessage || 'Generating suggestion…')}</p>
        </section>`;
    }

    inlineReviewRoot.hidden = false;
  }

  function getReviewSuggestionPresentation() {
    if (!activeRequest || !activeRequest.suggestion) {
      return {
        kicker: 'Proposed revision',
        label: 'Proposed revision',
        body: ''
      };
    }

    if (activeRequest.suggestion.replacementMarkdown.length === 0) {
      return {
        kicker: 'Proposed deletion',
        label: 'Proposed result',
        body: '[Selected content will be removed]'
      };
    }

    return {
      kicker: 'Proposed revision',
      label: 'Proposed revision',
      body: activeRequest.suggestion.replacementMarkdown
    };
  }

  function renderOverlay() {
    if (!requestRoot) {
      return;
    }

    syncSelectedRegionState();

    if (!activeRequest) {
      requestRoot.hidden = true;
      requestRoot.innerHTML = '';
      clearInlineReview();
      return;
    }

    if (shouldRenderInlinePanel()) {
      requestRoot.hidden = true;
      requestRoot.innerHTML = '';
      renderInlineReview();
      return;
    }

    clearInlineReview();

    const validationClass = activeRequest.validationState === 'unavailable' || activeRequest.validationState === 'failed'
      ? 'selection-request-validation selection-request-validation-submitted'
      : activeRequest.validationState === 'invalid'
      ? 'selection-request-validation selection-request-validation-submitted'
      : 'selection-request-validation';

    requestRoot.innerHTML = `
      <section class="selection-request-popover" aria-label="Selection request popup">
        <textarea
          id="selection-request-textarea"
          class="selection-request-textarea"
          aria-label="Ask for changes"
          placeholder="Ask for changes"
          data-selection-request-draft
        >${escapeHtml(activeRequest.draftText)}</textarea>
        <p class="${validationClass}">${escapeHtml(activeRequest.validationMessage || '')}</p>
        <div class="selection-request-actions">
          <button type="button" class="selection-request-button" data-selection-request-submit>Ask for changes</button>
        </div>
      </section>`;

    syncOverlayPosition();

    const textarea = requestRoot.querySelector('[data-selection-request-draft]');
    const submitButton = requestRoot.querySelector('[data-selection-request-submit]');

    if (textarea instanceof HTMLTextAreaElement) {
      textarea.addEventListener('input', function () {
        if (!activeRequest) {
          return;
        }

        activeRequest.draftText = textarea.value;
        if (activeRequest.validationState !== 'drafting') {
          activeRequest.validationState = 'drafting';
          activeRequest.validationMessage = undefined;
        }
        syncSubmitButtonState();

        postMessage({
          type: 'request.draftChanged',
          sessionId: activeRequest.sessionId,
          draftText: textarea.value
        });
      });
    }

    if (submitButton instanceof HTMLButtonElement) {
      submitButton.addEventListener('click', function () {
        if (!activeRequest) {
          return;
        }

        activeRequest.validationState = 'submitting';
        syncSubmitButtonState();
        postMessage({
          type: 'request.submit',
          sessionId: activeRequest.sessionId,
          draftText: activeRequest.draftText
        });
      });
    }

    syncSubmitButtonState();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function hydrateActiveRequestFromViewerState(currentViewerState) {
    if (!currentViewerState || currentViewerState.kind !== 'rendered' || !currentViewerState.activeRequest) {
      activeRequest = null;
      return;
    }

    activeRequest = {
      sessionId: currentViewerState.activeRequest.sessionId,
      selectedTextPreview: currentViewerState.activeRequest.selectedTextPreview,
      selectedRegionIds: currentViewerState.activeRequest.selectedRegionIds,
      draftText: currentViewerState.activeRequest.draftText || '',
      validationState: currentViewerState.activeRequest.validationState,
      validationMessage: currentViewerState.activeRequest.validationMessage,
      suggestion: currentViewerState.activeRequest.suggestion,
      selectionRect: getSelectionRectFromRegionIds(currentViewerState.activeRequest.selectedRegionIds)
    };
  }

  function handlePointerDown(event) {
    if (!activeRequest || shouldRenderInlinePanel()) {
      return;
    }

    if (requestRoot && requestRoot.contains(event.target)) {
      return;
    }

    const sessionId = activeRequest.sessionId;
    clearActiveRequestOverlay();
    postMessage({
      type: 'request.cancel',
      sessionId
    });
  }

  function handleExtensionMessage(event) {
    const message = event.data;

    if (!message || typeof message !== 'object') {
      return;
    }

    switch (message.type) {
      case 'selection.accepted':
        activeRequest = {
          sessionId: message.sessionId,
          selectedTextPreview: message.selectedTextPreview,
          selectedRegionIds: message.selectedRegionIds,
          draftText: message.draftText || '',
          validationState: message.validationState,
          validationMessage: message.validationMessage,
          suggestion: undefined,
          selectionRect: pendingSelectionRect || getSelectionRectFromRegionIds(message.selectedRegionIds)
        };
        renderOverlay();
        return;
      case 'selection.rejected':
        pendingSelectionRect = null;
        return;
      case 'request.invalidated':
        if (!activeRequest || activeRequest.sessionId !== message.sessionId) {
          return;
        }

        activeRequest.validationState = 'invalid';
        activeRequest.validationMessage = message.message;
        activeRequest.suggestion = undefined;
        renderOverlay();
        return;
      case 'request.submitted':
        if (!activeRequest || activeRequest.sessionId !== message.sessionId) {
          return;
        }

        activeRequest.validationState = 'submitted';
        activeRequest.validationMessage = message.message;
        renderOverlay();
        return;
      case 'request.executing':
        if (!activeRequest || activeRequest.sessionId !== message.sessionId) {
          return;
        }

        activeRequest.validationState = 'executing';
        activeRequest.validationMessage = message.message;
        renderOverlay();
        return;
      case 'suggestion.ready':
        if (!activeRequest || activeRequest.sessionId !== message.sessionId) {
          return;
        }

        activeRequest.validationState = 'review';
        activeRequest.validationMessage = 'Suggestion ready.';
        activeRequest.suggestion = message.proposal;
        renderOverlay();
        return;
      case 'request.failed':
        if (!activeRequest || activeRequest.sessionId !== message.sessionId) {
          return;
        }

        activeRequest.validationState = 'failed';
        activeRequest.validationMessage = message.message;
        activeRequest.suggestion = undefined;
        renderOverlay();
        return;
      case 'request.unavailable':
        if (!activeRequest || activeRequest.sessionId !== message.sessionId) {
          return;
        }

        activeRequest.validationState = 'unavailable';
        activeRequest.validationMessage = message.message;
        activeRequest.suggestion = undefined;
        renderOverlay();
        return;
      case 'suggestion.rejected':
        if (!activeRequest || activeRequest.sessionId !== message.sessionId) {
          return;
        }

        activeRequest.validationState = 'drafting';
        activeRequest.validationMessage = message.message;
        activeRequest.draftText = message.draftText || activeRequest.draftText;
        activeRequest.suggestion = undefined;
        renderOverlay();
        return;
      case 'suggestion.applied':
        clearActiveRequestOverlay();
        return;
      default:
        return;
    }
  }

  function wireSelectionCapture(currentViewerState) {
    const documentRoot = document.querySelector('.viewer-document');

    if (!documentRoot || !currentViewerState || currentViewerState.kind !== 'rendered') {
      return;
    }

    documentRoot.addEventListener('mouseup', function () {
      if (blocksReplacementSelection()) {
        return;
      }

      const message = findSelectionMessage(currentViewerState);

      if (message) {
        postMessage(message);
      }
    });
  }

  function bootstrapSelectionRequestShell() {
    viewerState = parseViewerState();
    requestRoot = document.querySelector('[data-selection-request-root]');
    inlineReviewRoot = document.querySelector('[data-selection-inline-review-root]');

    if (!viewerState || !requestRoot || !inlineReviewRoot) {
      return;
    }

    document.body.dataset.selectionMode = viewerState.kind === 'rendered' ? viewerState.selectionMode : 'disabled';
    wireSelectionCapture(viewerState);
    hydrateActiveRequestFromViewerState(viewerState);
    renderOverlay();
    window.addEventListener('message', handleExtensionMessage);
    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('resize', syncOverlayPosition);
    window.addEventListener('scroll', syncOverlayPosition, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapSelectionRequestShell, { once: true });
  } else {
    bootstrapSelectionRequestShell();
  }
})();