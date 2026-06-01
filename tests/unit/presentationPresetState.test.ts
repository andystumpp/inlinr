import assert from 'node:assert/strict';
import { PresentationPresetState } from '../../src/presentation/presentationPresetState';
import { createMockMemento } from '../integration/helpers';

suite('Presentation preset state', () => {
  test('defaults to the balanced preset when nothing has been stored', () => {
    const presetState = new PresentationPresetState(createMockMemento());

    assert.equal(presetState.getCurrentPreset(), 'balanced');
  });

  test('persists the selected preset in user state', async () => {
    const memento = createMockMemento();
    const presetState = new PresentationPresetState(memento);

    await presetState.setCurrentPreset('comfortable-reading');

    assert.equal(presetState.getCurrentPreset(), 'comfortable-reading');
    assert.deepEqual(memento.snapshot(), {
      'inlinr.presentationPreset': 'comfortable-reading'
    });
  });
});
