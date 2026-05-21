(function () {
  const vscodeApi = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
  let viewerState = null;
  let activeRequest = null;
  let pendingSelectionRect = null;
  let requestRoot = null;

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

  function getSelectionRectFromRegionIds(regionIds) {
    const regionElements = regionIds
      .map(function (regionId) {
        return document.querySelector('[data-selection-region-id="' + regionId + '"]');
      })
      .filter(function (element) {
        return element instanceof HTMLElement;
      });

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
      activeRequest.draftText.trim().length === 0;
  }

  function renderOverlay() {
    if (!requestRoot) {
      return;
    }

    if (!activeRequest) {
      requestRoot.hidden = true;
      requestRoot.innerHTML = '';
      return;
    }

    const isSubmitted = activeRequest.validationState === 'submitted';
    const validationClass = isSubmitted
      ? 'selection-request-validation selection-request-validation-submitted'
      : 'selection-request-validation';
    const selectedRegionCount = activeRequest.selectedRegionIds.length;

    requestRoot.innerHTML = `
      <section class="selection-request-popover" aria-label="Selection request popup">
        <p class="selection-request-kicker">Inline request</p>
        ${selectedRegionCount > 1 ? `<p class="selection-request-range">${selectedRegionCount} contiguous prose blocks selected</p>` : ''}
        <p class="selection-request-selection">${escapeHtml(activeRequest.selectedTextPreview)}</p>
        <label class="selection-request-label" for="selection-request-textarea">Ask for changes</label>
        <textarea
          id="selection-request-textarea"
          class="selection-request-textarea"
          placeholder="Ask for changes"
          data-selection-request-draft
          ${isSubmitted ? 'disabled' : ''}
        >${escapeHtml(activeRequest.draftText)}</textarea>
        <p class="${validationClass}">${escapeHtml(activeRequest.validationMessage || '')}</p>
        <div class="selection-request-actions">
          <button type="button" class="selection-request-button ${isSubmitted ? '' : 'selection-request-button-secondary'}" data-selection-request-cancel>
            ${isSubmitted ? 'Close' : 'Cancel'}
          </button>
          ${isSubmitted ? '' : '<button type="button" class="selection-request-button" data-selection-request-submit>Submit</button>'}
        </div>
      </section>`;

    syncOverlayPosition();

    const textarea = requestRoot.querySelector('[data-selection-request-draft]');
    const submitButton = requestRoot.querySelector('[data-selection-request-submit]');
    const cancelButton = requestRoot.querySelector('[data-selection-request-cancel]');

    if (textarea instanceof HTMLTextAreaElement) {
      textarea.addEventListener('input', function () {
        if (!activeRequest) {
          return;
        }

        activeRequest.draftText = textarea.value;
        activeRequest.validationState = 'drafting';
        activeRequest.validationMessage = undefined;
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

    if (cancelButton instanceof HTMLButtonElement) {
      cancelButton.addEventListener('click', function () {
        if (!activeRequest) {
          return;
        }

        const sessionId = activeRequest.sessionId;
        activeRequest = null;
        requestRoot.hidden = true;
        requestRoot.innerHTML = '';
        pendingSelectionRect = null;
        postMessage({
          type: 'request.cancel',
          sessionId
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
      selectionRect: getSelectionRectFromRegionIds(currentViewerState.activeRequest.selectedRegionIds)
    };
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
      if (activeRequest) {
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

    if (!viewerState || !requestRoot) {
      return;
    }

    document.body.dataset.selectionMode = viewerState.kind === 'rendered' ? viewerState.selectionMode : 'disabled';
    wireSelectionCapture(viewerState);
    hydrateActiveRequestFromViewerState(viewerState);
    renderOverlay();
    window.addEventListener('message', handleExtensionMessage);
    window.addEventListener('resize', syncOverlayPosition);
    window.addEventListener('scroll', syncOverlayPosition, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapSelectionRequestShell, { once: true });
  } else {
    bootstrapSelectionRequestShell();
  }
})();