import { validateAlertPolicies } from './alertPolicyUtils.mjs';

async function main() {
  const { runtimeScenarios, deployableScenarios, errors, warnings } = await validateAlertPolicies();

  for (const warning of warnings) {
    console.warn(`Warning: ${warning}`);
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`Error: ${error}`);
    }

    process.exitCode = 1;
    return;
  }

  console.log(`Validated ${runtimeScenarios.length} runtime monitoring scenarios.`);
  console.log(`Validated ${deployableScenarios.length} deployable alert intent entries.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});