const { test, expect } = require('@playwright/test');
const {
  cancelActiveRequest,
  clearPostedMessages,
  createAcceptedSelectionMessage,
  createFirstActionGuidanceState,
  dismissFirstActionGuidance,
  getFirstActionGuidance,
  findRegionIdContainingText,
  getPostedMessages,
  getTargetedRegionIds,
  isFirstActionGuidanceHidden,
  isRequestRootHidden,
  mountWebview,
  postExtensionMessage,
  selectFragment,
  setRangeRectOverride,
  setRegionRectOverrides
} = require('./helpers/selectionRequestHarness');

test.describe('webview selection request contract', () => {
  test('renders first-action guidance when the viewer state includes it', async ({ page }) => {
    await mountWebview(page, {
      markdown: 'Alpha beta gamma delta.',
      firstActionGuidance: createFirstActionGuidanceState()
    });

    expect(await isFirstActionGuidanceHidden(page)).toBe(false);
    await expect(getFirstActionGuidance(page)).toContainText('Welcome to Inlinr — edit Markdown by asking, right where you select');
    await expect(getFirstActionGuidance(page)).toContainText('Got it');
  });

  test('dismisses first-action guidance and notifies the extension', async ({ page }) => {
    await mountWebview(page, {
      markdown: 'Alpha beta gamma delta.',
      firstActionGuidance: createFirstActionGuidanceState()
    });

    await dismissFirstActionGuidance(page);

    expect(await isFirstActionGuidanceHidden(page)).toBe(true);
    await expect.poll(() => getPostedMessages(page)).toContainEqual({
      type: 'firstActionGuidance.dismiss'
    });
  });

  test('hides first-action guidance after the first accepted selection', async ({ page }) => {
    await mountWebview(page, {
      markdown: 'Alpha beta gamma delta.',
      firstActionGuidance: createFirstActionGuidanceState()
    });
    const regionId = await findRegionIdContainingText(page, 'Alpha beta gamma delta.');

    await selectFragment(page, {
      startRegionId: regionId,
      startText: 'beta',
      endRegionId: regionId,
      endText: 'gamma'
    });

    const [captureMessage] = await getPostedMessages(page);
    await postExtensionMessage(page, createAcceptedSelectionMessage(captureMessage));

    expect(await isFirstActionGuidanceHidden(page)).toBe(true);
  });

  test('shows the popup quick action buttons after a selection is accepted', async ({ page }) => {
    await mountWebview(page, {
      markdown: 'Alpha beta gamma delta.'
    });
    const regionId = await findRegionIdContainingText(page, 'Alpha beta gamma delta.');

    await selectFragment(page, {
      startRegionId: regionId,
      startText: 'beta',
      endRegionId: regionId,
      endText: 'gamma'
    });

    const [captureMessage] = await getPostedMessages(page);
    await postExtensionMessage(page, createAcceptedSelectionMessage(captureMessage));

    const boldButton = page.locator('[data-selection-request-action-kind="bold"]');
    const italicButton = page.locator('[data-selection-request-action-kind="italic"]');

    await expect(boldButton).toBeVisible();
    await expect(boldButton).toHaveAttribute('aria-label', 'Bold');
    await expect(boldButton).toHaveText('B');
    await expect(italicButton).toBeVisible();
    await expect(italicButton).toHaveAttribute('aria-label', 'Italic');
    await expect(italicButton).toHaveText('I');
    await expect(page.locator('[data-selection-request-action-kind="clearer"]')).toBeVisible();
    await expect(page.locator('[data-selection-request-action-kind="tighten"]')).toBeVisible();
    await expect(page.locator('[data-selection-request-action-kind="add-example"]')).toBeVisible();
  });

  test('submits the make clearer quick action from the popup', async ({ page }) => {
    await mountWebview(page, {
      markdown: 'Alpha beta gamma delta.'
    });
    const regionId = await findRegionIdContainingText(page, 'Alpha beta gamma delta.');

    await selectFragment(page, {
      startRegionId: regionId,
      startText: 'beta',
      endRegionId: regionId,
      endText: 'gamma'
    });

    const [captureMessage] = await getPostedMessages(page);
    await postExtensionMessage(page, createAcceptedSelectionMessage(captureMessage));
    await clearPostedMessages(page);

    await page.locator('[data-selection-request-action-kind="clearer"]').click();

    await expect(page.locator('[data-selection-request-draft]')).toHaveValue(
      'Make the selected text clearer without changing its meaning.'
    );
    expect(await getPostedMessages(page)).toEqual([
      {
        type: 'request.draftChanged',
        sessionId: 'session-1',
        draftText: 'Make the selected text clearer without changing its meaning.'
      },
      {
        type: 'request.submit',
        sessionId: 'session-1',
        draftText: 'Make the selected text clearer without changing its meaning.'
      }
    ]);
  });

  test('captures a normal text selection and opens the popup after acceptance', async ({ page }) => {
    const fixture = await mountWebview(page, {
      markdown: 'Alpha beta gamma delta.'
    });
    const regionId = await findRegionIdContainingText(page, 'Alpha beta gamma delta.');

    await selectFragment(page, {
      startRegionId: regionId,
      startText: 'beta',
      endRegionId: regionId,
      endText: 'gamma'
    });

    const [captureMessage] = await getPostedMessages(page);
    expect(captureMessage).toMatchObject({
      type: 'selection.capture',
      documentVersion: fixture.state.documentVersion,
      selectedText: 'beta gamma',
      renderedRegionIds: [regionId]
    });

    await postExtensionMessage(page, createAcceptedSelectionMessage(captureMessage));

    expect(await isRequestRootHidden(page)).toBe(false);
    await expect(page.locator('[data-selection-request-draft]')).toBeVisible();
    expect(await getTargetedRegionIds(page)).toEqual([regionId]);
  });

  test('captures a reverse selection with the same region payload', async ({ page }) => {
    await mountWebview(page, {
      markdown: 'Alpha beta gamma delta.'
    });
    const regionId = await findRegionIdContainingText(page, 'Alpha beta gamma delta.');

    await selectFragment(page, {
      startRegionId: regionId,
      startText: 'beta',
      endRegionId: regionId,
      endText: 'gamma',
      reverse: true
    });

    const [captureMessage] = await getPostedMessages(page);
    expect(captureMessage).toMatchObject({
      type: 'selection.capture',
      selectedText: 'beta gamma',
      renderedRegionIds: [regionId]
    });
  });

  test('captures a multi-block selection across rendered regions', async ({ page }) => {
    await mountWebview(page, {
      markdown: 'First block sentence.\n\nSecond block sentence.'
    });
    const firstRegionId = await findRegionIdContainingText(page, 'First block sentence.');
    const secondRegionId = await findRegionIdContainingText(page, 'Second block sentence.');

    await selectFragment(page, {
      startRegionId: firstRegionId,
      startText: 'block',
      endRegionId: secondRegionId,
      endText: 'block'
    });

    const [captureMessage] = await getPostedMessages(page);
    expect(captureMessage.type).toBe('selection.capture');
    expect(captureMessage.renderedRegionIds).toEqual([firstRegionId, secondRegionId]);
    expect(captureMessage.selectedText).toContain('block');
    expect(captureMessage.selectedText).toContain('Second');
  });

  test('captures a list-item selection from a selectable list region', async ({ page }) => {
    await mountWebview(page, {
      markdown: '- first item\n- second item\n- third item'
    });
    const secondItemRegionId = await findRegionIdContainingText(page, 'second item');

    await selectFragment(page, {
      startRegionId: secondItemRegionId,
      startText: 'second',
      endRegionId: secondItemRegionId,
      endText: 'item'
    });

    const [captureMessage] = await getPostedMessages(page);
    expect(captureMessage).toMatchObject({
      type: 'selection.capture',
      selectedText: 'second item',
      renderedRegionIds: [secondItemRegionId]
    });
  });

  test('captures a selection that crosses inline formatting boundaries', async ({ page }) => {
    await mountWebview(page, {
      markdown: 'This has **bold words** and _italic text_ inside.'
    });
    const paragraphRegionId = await findRegionIdContainingText(page, 'This has bold words and italic text inside.');

    await selectFragment(page, {
      startRegionId: paragraphRegionId,
      startText: 'has',
      endRegionId: paragraphRegionId,
      endText: 'italic'
    });

    const [captureMessage] = await getPostedMessages(page);
    expect(captureMessage.type).toBe('selection.capture');
    expect(captureMessage.selectedText).toBe('has bold words and italic');
    expect(captureMessage.renderedRegionIds.length).toBeGreaterThan(0);
  });

  test('supports repeated select and deselect cycles without stale popup state', async ({ page }) => {
    await mountWebview(page, {
      markdown: 'First selectable sentence.\n\nSecond selectable sentence.'
    });
    const firstRegionId = await findRegionIdContainingText(page, 'First selectable sentence.');
    const secondRegionId = await findRegionIdContainingText(page, 'Second selectable sentence.');

    await selectFragment(page, {
      startRegionId: firstRegionId,
      startText: 'First',
      endRegionId: firstRegionId,
      endText: 'sentence'
    });

    let [captureMessage] = await getPostedMessages(page);
    await postExtensionMessage(page, createAcceptedSelectionMessage(captureMessage));
    expect(await isRequestRootHidden(page)).toBe(false);

    await cancelActiveRequest(page);

    expect(await isRequestRootHidden(page)).toBe(true);
    let postedMessages = await getPostedMessages(page);
    expect(postedMessages.at(-1)).toMatchObject({
      type: 'request.cancel',
      sessionId: 'session-1'
    });

    await clearPostedMessages(page);
    await selectFragment(page, {
      startRegionId: secondRegionId,
      startText: 'Second',
      endRegionId: secondRegionId,
      endText: 'sentence'
    });

    [captureMessage] = await getPostedMessages(page);
    expect(captureMessage).toMatchObject({
      type: 'selection.capture',
      renderedRegionIds: [secondRegionId]
    });
    await postExtensionMessage(page, createAcceptedSelectionMessage(captureMessage, { sessionId: 'session-2' }));
    postedMessages = await getPostedMessages(page);
    expect(await getTargetedRegionIds(page)).toEqual([secondRegionId]);
    expect(postedMessages.some((message) => message.type === 'request.cancel')).toBe(false);
  });

  test('does not emit a capture message when the selection range has an empty rect', async ({ page }) => {
    await mountWebview(page, {
      markdown: 'Alpha beta gamma delta.'
    });
    const regionId = await findRegionIdContainingText(page, 'Alpha beta gamma delta.');

    await setRangeRectOverride(page, {
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0
    });
    await selectFragment(page, {
      startRegionId: regionId,
      startText: 'beta',
      endRegionId: regionId,
      endText: 'gamma'
    });

    expect(await getPostedMessages(page)).toEqual([]);
  });

  test('keeps the popup hidden when accepted regions do not have a stable rect', async ({ page }) => {
    await mountWebview(page, {
      markdown: 'Alpha beta gamma delta.'
    });
    const regionId = await findRegionIdContainingText(page, 'Alpha beta gamma delta.');

    await setRegionRectOverrides(page, {
      [regionId]: {
        top: Number.NaN,
        left: 16,
        bottom: 40,
        right: 120,
        width: 104,
        height: 24
      }
    });
    await postExtensionMessage(page, {
      type: 'selection.accepted',
      sessionId: 'session-unstable',
      selectedTextPreview: 'beta gamma',
      selectedRegionIds: [regionId],
      draftText: '',
      validationState: 'drafting'
    });

    expect(await isRequestRootHidden(page)).toBe(true);
  });

  test('clears the overlay after a suggestion is applied', async ({ page }) => {
    await mountWebview(page, {
      markdown: 'Alpha beta gamma delta.'
    });
    const regionId = await findRegionIdContainingText(page, 'Alpha beta gamma delta.');

    await postExtensionMessage(page, {
      type: 'selection.accepted',
      sessionId: 'session-apply',
      selectedTextPreview: 'beta gamma',
      selectedRegionIds: [regionId],
      draftText: 'Rewrite this.',
      validationState: 'drafting'
    });
    await postExtensionMessage(page, {
      type: 'suggestion.ready',
      sessionId: 'session-apply',
      proposal: {
        proposalId: 'proposal-1',
        previewMode: 'blended-inline',
        replacementMarkdown: 'Updated text.',
        renderedReplacementHtml: '<p>Updated text.</p>'
      }
    });

    await page.locator('[data-selection-request-apply]').click();

    await expect(page.locator('[data-selection-inline-review-root]')).toBeVisible();

    await postExtensionMessage(page, {
      type: 'suggestion.applied',
      sessionId: 'session-apply',
      message: 'Suggestion applied.'
    });

    expect(await isRequestRootHidden(page)).toBe(true);
    await expect(page.locator('[data-selection-inline-review-root]')).toBeHidden();
    expect(await getTargetedRegionIds(page)).toEqual([]);
  });

  test('keeps first-action guidance hidden when the viewer state omits it', async ({ page }) => {
    await mountWebview(page, {
      markdown: 'Alpha beta gamma delta.'
    });

    expect(await isFirstActionGuidanceHidden(page)).toBe(true);
  });
});
