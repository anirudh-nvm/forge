import { summarizeEvaluation, loadEvaluationCases, runEvaluation } from "./runner";

const cases = loadEvaluationCases();
console.log(summarizeEvaluation(cases));

if (process.argv.includes("--json")) {
  const { results } = runEvaluation(cases);
  console.log("\nDetailed failures:");
  for (const r of results.filter((r) => !r.pass)) {
    console.log(
      `  ${r.id} "${r.input}" -> ${r.actual.status} ${r.actual.type ?? ""} ${r.actual.target ?? ""}`
    );
  }
}