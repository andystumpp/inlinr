import type { MonitoringScenarioDefinition } from './telemetryContract';

export const CURRENT_MONITORING_SCENARIOS: readonly MonitoringScenarioDefinition[] = [
  {
    scenarioId: 'load_markdown_preview',
    scenarioVersion: '1',
    title: 'Load a Markdown file into the Inlinr preview',
    criticality: 'core',
    startCondition: 'A user opens a Markdown file into Inlinr.',
    successCondition: 'The viewer renders the correct Markdown content and remains usable.',
    safeBlockCondition: 'The viewer stays active and shows a visible failure state without mutating the document.',
    checkpoints: [
      {
        checkpointId: 'route_to_viewer',
        order: 1,
        description: 'Opening a .md file routes into the Inlinr viewer.',
        component: 'viewer'
      },
      {
        checkpointId: 'render_markdown',
        order: 2,
        description: 'The document renders as Markdown rather than raw source.',
        component: 'viewer',
        latencySensitive: true
      },
      {
        checkpointId: 'viewer_usable',
        order: 3,
        description: 'The viewer shows correct content and remains usable for the next interaction.',
        component: 'viewer'
      }
    ],
    primaryAlert: 'synthetic_availability',
    supportingSignals: ['checkpoint', 'latency', 'exception']
  },
  {
    scenarioId: 'show_inline_request_popup',
    scenarioVersion: '1',
    title: 'Show the inline request popup for a rendered selection',
    criticality: 'core',
    startCondition: 'A user makes a non-empty rendered selection.',
    successCondition: 'A single anchored popup appears for the intended selection scope.',
    safeBlockCondition: 'Selection is rejected safely without mutating the document.',
    checkpoints: [
      {
        checkpointId: 'selection_recognized',
        order: 1,
        description: 'A non-empty rendered selection is recognized.',
        component: 'selection'
      },
      {
        checkpointId: 'popup_shown',
        order: 2,
        description: 'The popup appears near the selected text.',
        component: 'selection',
        latencySensitive: true
      },
      {
        checkpointId: 'scope_accurate',
        order: 3,
        description: 'The popup opens for the intended scope rather than drifting.',
        component: 'selection'
      }
    ],
    primaryAlert: 'synthetic_availability',
    supportingSignals: ['checkpoint', 'exception']
  },
  {
    scenarioId: 'submit_request_receive_review',
    scenarioVersion: '1',
    title: 'Submit a request and receive inline review state',
    criticality: 'core',
    startCondition: 'A user submits a request from the inline popup.',
    successCondition: 'Pending feedback appears and a reviewable inline suggestion is rendered at the targeted document location.',
    safeBlockCondition: 'Execution or targeting fails visibly and the document remains unchanged.',
    checkpoints: [
      {
        checkpointId: 'request_submitted',
        order: 1,
        description: 'The request input accepts text and submits successfully.',
        component: 'request_execution'
      },
      {
        checkpointId: 'pending_visible',
        order: 2,
        description: 'The system shows a visible pending state while work is in progress.',
        component: 'request_execution'
      },
      {
        checkpointId: 'review_rendered_inline',
        order: 3,
        description: 'A reviewable inline suggestion appears at the targeted document location.',
        component: 'request_execution',
        latencySensitive: true
      }
    ],
    primaryAlert: 'real_user_failure_rate',
    supportingSignals: ['checkpoint', 'dependency', 'latency', 'exception']
  },
  {
    scenarioId: 'apply_suggested_change',
    scenarioVersion: '1',
    title: 'Apply a suggested change into the document',
    criticality: 'core',
    startCondition: 'A user chooses Apply from inline review state.',
    successCondition: 'Only the intended range mutates and the rendered document refreshes.',
    safeBlockCondition: 'Apply is blocked safely when the target is no longer trustworthy.',
    checkpoints: [
      {
        checkpointId: 'apply_available',
        order: 1,
        description: 'Apply is available from the inline review state.',
        component: 'apply'
      },
      {
        checkpointId: 'mutate_targeted_range',
        order: 2,
        description: 'The targeted range mutates only after explicit apply.',
        component: 'apply'
      },
      {
        checkpointId: 'render_refresh',
        order: 3,
        description: 'The rendered document refreshes to the newly integrated content.',
        component: 'viewer',
        latencySensitive: true
      }
    ],
    primaryAlert: 'real_user_failure_rate',
    supportingSignals: ['checkpoint', 'exception']
  },
  {
    scenarioId: 'reject_suggested_change',
    scenarioVersion: '1',
    title: 'Reject a suggested change without side effects',
    criticality: 'core',
    startCondition: 'A user chooses Reject from inline review state.',
    successCondition: 'The document remains unchanged and the temporary review state is dismissed.',
    safeBlockCondition: 'The product leaves stale UI or hidden mutation after rejection.',
    checkpoints: [
      {
        checkpointId: 'reject_available',
        order: 1,
        description: 'Reject is available from the inline review state.',
        component: 'apply'
      },
      {
        checkpointId: 'document_unchanged',
        order: 2,
        description: 'The document content remains unchanged after rejection.',
        component: 'apply'
      },
      {
        checkpointId: 'review_dismissed',
        order: 3,
        description: 'The temporary review state is dismissed cleanly.',
        component: 'session'
      }
    ],
    primaryAlert: 'non_paging_diagnostic',
    supportingSignals: ['checkpoint', 'exception']
  },
  {
    scenarioId: 'start_next_request_cycle',
    scenarioVersion: '1',
    title: 'Start another request cycle in the same session',
    criticality: 'important',
    startCondition: 'A user completes an apply or reject and makes another selection in the same session.',
    successCondition: 'A new popup flow starts using current document state.',
    safeBlockCondition: 'The previous cycle remains stuck or stale but does not mutate content.',
    checkpoints: [
      {
        checkpointId: 'first_cycle_cleared',
        order: 1,
        description: 'The first request cycle ends cleanly after apply or reject.',
        component: 'session'
      },
      {
        checkpointId: 'fresh_selection_starts_popup',
        order: 2,
        description: 'A fresh selection can start a new popup flow.',
        component: 'selection'
      },
      {
        checkpointId: 'current_state_reused',
        order: 3,
        description: 'The next request uses current document state rather than stale review state.',
        component: 'session'
      }
    ],
    primaryAlert: 'non_paging_diagnostic',
    supportingSignals: ['checkpoint', 'exception']
  },
  {
    scenarioId: 'stable_viewer_on_render_failure',
    scenarioVersion: '1',
    title: 'Keep the viewer stable when preview rendering fails',
    criticality: 'important',
    startCondition: 'Preview rendering fails while a Markdown file is open in Inlinr.',
    successCondition: 'The viewer stays active, shows a clear failure state, and the document stays unchanged.',
    safeBlockCondition: 'The product prevents unsafe fallback or mutation while rendering is unavailable.',
    checkpoints: [
      {
        checkpointId: 'viewer_remains_active',
        order: 1,
        description: 'The viewer remains the active surface on render failure.',
        component: 'viewer'
      },
      {
        checkpointId: 'failure_state_visible',
        order: 2,
        description: 'A visible failure state appears in the viewer.',
        component: 'viewer'
      },
      {
        checkpointId: 'document_preserved',
        order: 3,
        description: 'The underlying document remains unchanged.',
        component: 'viewer'
      }
    ],
    primaryAlert: 'non_paging_diagnostic',
    supportingSignals: ['checkpoint', 'exception']
  },
  {
    scenarioId: 'preserve_document_on_execution_failure',
    scenarioVersion: '1',
    title: 'Keep the document unchanged when execution or targeting fails',
    criticality: 'important',
    startCondition: 'Request execution fails, returns unusable output, or can no longer resolve the intended target safely.',
    successCondition: 'A clear recovery path is visible and the document remains unchanged.',
    safeBlockCondition: 'Review and apply are blocked when the target is unsafe.',
    checkpoints: [
      {
        checkpointId: 'failure_visible',
        order: 1,
        description: 'The failure state is visible to the user.',
        component: 'request_execution'
      },
      {
        checkpointId: 'review_apply_blocked',
        order: 2,
        description: 'Review and apply are blocked when the target is unsafe.',
        component: 'request_execution'
      },
      {
        checkpointId: 'document_preserved',
        order: 3,
        description: 'The document content is preserved without hidden mutation.',
        component: 'apply'
      }
    ],
    primaryAlert: 'non_paging_diagnostic',
    supportingSignals: ['checkpoint', 'dependency', 'exception']
  }
] as const;

export function createScenarioRegistry(
  definitions: readonly MonitoringScenarioDefinition[]
): ReadonlyMap<string, MonitoringScenarioDefinition> {
  assertValidMonitoringScenarioDefinitions(definitions);
  const registry = new Map<string, MonitoringScenarioDefinition>();

  for (const definition of definitions) {
    registry.set(definition.scenarioId, definition);
  }

  return registry;
}

export function assertValidMonitoringScenarioDefinitions(
  definitions: readonly MonitoringScenarioDefinition[]
): void {
  const scenarioIds = new Set<string>();

  for (const definition of definitions) {
    assertValidMonitoringScenarioDefinition(definition);

    if (scenarioIds.has(definition.scenarioId)) {
      throw new Error(`Duplicate monitoring scenario id: ${definition.scenarioId}`);
    }

    scenarioIds.add(definition.scenarioId);
  }
}

export const DEFAULT_SCENARIO_REGISTRY = createScenarioRegistry(CURRENT_MONITORING_SCENARIOS);

export function getMonitoringScenarioDefinition(
  scenarioId: string,
  registry: ReadonlyMap<string, MonitoringScenarioDefinition> = DEFAULT_SCENARIO_REGISTRY
): MonitoringScenarioDefinition | undefined {
  return registry.get(scenarioId);
}

export function getScenarioCheckpointDefinition(
  scenario: Pick<MonitoringScenarioDefinition, 'checkpoints'>,
  checkpointId: string
): MonitoringScenarioDefinition['checkpoints'][number] | undefined {
  return scenario.checkpoints.find((checkpoint) => checkpoint.checkpointId === checkpointId);
}

export function assertValidMonitoringScenarioDefinition(definition: MonitoringScenarioDefinition): void {
  if (definition.scenarioId.trim().length === 0) {
    throw new Error('Monitoring scenario definitions require a non-empty scenarioId.');
  }

  if (definition.checkpoints.length === 0) {
    throw new Error(`Monitoring scenario ${definition.scenarioId} must define at least one checkpoint.`);
  }

  let previousOrder = -Infinity;
  const checkpointIds = new Set<string>();

  for (const checkpoint of definition.checkpoints) {
    if (checkpoint.checkpointId.trim().length === 0) {
      throw new Error(`Monitoring scenario ${definition.scenarioId} contains an empty checkpoint id.`);
    }

    if (checkpointIds.has(checkpoint.checkpointId)) {
      throw new Error(`Monitoring scenario ${definition.scenarioId} reuses checkpoint id ${checkpoint.checkpointId}.`);
    }

    if (checkpoint.order <= previousOrder) {
      throw new Error(`Monitoring scenario ${definition.scenarioId} must keep checkpoints strictly ordered.`);
    }

    checkpointIds.add(checkpoint.checkpointId);
    previousOrder = checkpoint.order;
  }
}