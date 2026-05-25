import { validateAlertPolicies } from './alertPolicyUtils.mjs';
import { compileAlertPolicies, readScenarioContract } from './generate-alert-policies-from-contract.mjs';

async function main() {
  const contract = await readScenarioContract();
  const compileResult = compileAlertPolicies(contract);

  if (compileResult.errors.length > 0) {
    for (const error of compileResult.errors) {
      console.error(`Error: ${error}`);
    }

    process.exitCode = 1;
    return;
  }

  const { runtimeScenarios, deployableScenarios, errors, warnings } = await validateAlertPolicies(compileResult.alertPolicies);

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
  console.log(`Validated ${compileResult.alertPolicies.scenarios.length} contract-derived alert policy entries.`);
  console.log(`Validated ${deployableScenarios.length} deployable alert intent entries.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});