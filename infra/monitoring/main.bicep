@description('Environment name for the monitoring deployment, such as dev or prod.')
param environmentName string

@description('Azure region for scheduled query alert resources, such as eastus.')
param monitoringLocation string

@description('Application Insights component resource ID that alert rules should target.')
param applicationInsightsComponentResourceId string

@description('Action group definitions keyed by routeRef from monitoring/alert-policies.yaml.')
param actionGroupDefinitions array = []

var generatedAlertSpec = loadJsonContent('./generated/alert-policies.generated.json')
var alertRules = generatedAlertSpec.alertRules
var requiredRouteRefs = generatedAlertSpec.requiredRouteRefs

resource actionGroups 'Microsoft.Insights/actionGroups@2023-01-01' = [for definition in actionGroupDefinitions: {
	name: definition.name
	location: 'global'
	properties: {
		enabled: true
		groupShortName: definition.shortName
		emailReceivers: [for receiver in (definition.?emailReceivers ?? []): {
			name: receiver.name
			emailAddress: receiver.emailAddress
			useCommonAlertSchema: receiver.?useCommonAlertSchema ?? true
		}]
		webhookReceivers: [for receiver in (definition.?webhookReceivers ?? []): {
			name: receiver.name
			serviceUri: receiver.serviceUri
			useCommonAlertSchema: receiver.?useCommonAlertSchema ?? true
			useAadAuth: receiver.?useAadAuth ?? false
		}]
		armRoleReceivers: []
		automationRunbookReceivers: []
		azureAppPushReceivers: []
		azureFunctionReceivers: []
		eventHubReceivers: []
		itsmReceivers: []
		logicAppReceivers: []
		smsReceivers: [for receiver in (definition.?smsReceivers ?? []): {
			name: receiver.name
			countryCode: replace(string(receiver.countryCode), '+', '')
			phoneNumber: receiver.phoneNumber
		}]
		voiceReceivers: [for receiver in (definition.?voiceReceivers ?? []): {
			name: receiver.name
			countryCode: replace(string(receiver.countryCode), '+', '')
			phoneNumber: receiver.phoneNumber
		}]
	}
}]

resource scheduledQueryRules 'Microsoft.Insights/scheduledQueryRules@2026-03-01' = [for rule in alertRules: {
	name: '${environmentName}-inlinr-${rule.nameSuffix}'
	location: monitoringLocation
	kind: rule.kind
	dependsOn: [
		actionGroups
	]
	properties: {
		description: rule.description
		displayName: '${environmentName} | ${rule.displayName}'
		enabled: true
		evaluationFrequency: rule.evaluationFrequency
		windowSize: rule.windowSize
		skipQueryValidation: false
		scopes: [
			applicationInsightsComponentResourceId
		]
		targetResourceTypes: [
			'microsoft.insights/components'
		]
		severity: int(rule.azureSeverity)
		resolveConfiguration: {
			autoResolved: true
			timeToResolve: rule.windowSize
		}
		criteria: {
			allOf: [
				{
					criterionType: 'StaticThresholdCriterion'
					query: rule.query
					metricMeasureColumn: rule.metricMeasureColumn
					operator: rule.operator
					threshold: int(rule.threshold)
					timeAggregation: rule.timeAggregation
					failingPeriods: {
						numberOfEvaluationPeriods: int(rule.failingPeriods.numberOfEvaluationPeriods)
						minFailingPeriodsToAlert: int(rule.failingPeriods.minFailingPeriodsToAlert)
					}
				}
			]
		}
		actions: {
			actionGroups: map(
				filter(actionGroupDefinitions, definition => definition.routeRef == rule.routeRef),
				definition => resourceId('Microsoft.Insights/actionGroups', definition.name)
			)
			customProperties: {
				managedBy: 'github-actions'
				environmentName: environmentName
				scenarioId: rule.scenarioId
				runtimeScenarioId: rule.runtimeScenarioId
				signalType: rule.signalType
				source: rule.source
				routeRef: rule.routeRef
			}
		}
	}
}]

output environment string = environmentName
output targetComponentId string = applicationInsightsComponentResourceId
output requiredRouteRefs array = requiredRouteRefs
output deployedActionGroupCount int = length(actionGroupDefinitions)
output deployedScheduledQueryRuleCount int = length(alertRules)