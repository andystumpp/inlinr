import assert from 'node:assert/strict';
import { DEFAULT_FIRST_ACTION_GUIDANCE_VIEW_STATE, FirstActionGuidanceState } from '../../src/onboarding/firstActionGuidanceState';
import { createMockMemento } from '../integration/helpers';

suite('First action guidance state', () => {
  test('returns pending guidance when no completion has been recorded', () => {
    const guidanceState = new FirstActionGuidanceState(createMockMemento());

    assert.deepEqual(guidanceState.getPendingViewState(), DEFAULT_FIRST_ACTION_GUIDANCE_VIEW_STATE);
    assert.equal(guidanceState.isCompleted(), false);
  });

  test('persists completion metadata and suppresses pending guidance', async () => {
    const guidanceState = new FirstActionGuidanceState(createMockMemento(), () => new Date('2026-05-29T19:24:27.259Z'));

    await guidanceState.markCompleted('dismissed');

    assert.equal(guidanceState.isCompleted(), true);
    assert.deepEqual(guidanceState.getCompletionRecord(), {
      completionSource: 'dismissed',
      completedAt: '2026-05-29T19:24:27.259Z'
    });
    assert.equal(guidanceState.getPendingViewState(), null);
  });

  test('clears stored completion state when reset', async () => {
    const guidanceState = new FirstActionGuidanceState(createMockMemento());

    await guidanceState.markCompleted('selection');
    await guidanceState.reset();

    assert.equal(guidanceState.isCompleted(), false);
    assert.equal(guidanceState.getCompletionRecord(), null);
  });
});
