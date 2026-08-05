// Pure logic for walking the Striver A2Z sheet in order.

/** Flatten the nested sheet into a single ordered list of problems. */
export function flattenSheet(sheet) {
  const flat = [];
  for (const step of sheet.steps) {
    for (const subStep of step.subSteps) {
      for (const problem of subStep.problems) {
        flat.push({
          ...problem,
          stepName: step.stepName,
          subStepName: subStep.subStepName,
        });
      }
    }
  }
  return flat;
}

/** Get the next N unsolved problems, in sheet order (never skips ahead). */
export function getNextProblems(sheet, count = 2) {
  const flat = flattenSheet(sheet);
  return flat.filter((p) => p.status === 'todo').slice(0, count);
}

/** Completion stats for the dashboard. */
export function getCompletionStats(sheet) {
  const flat = flattenSheet(sheet);
  const done = flat.filter((p) => p.status === 'done').length;
  return {
    total: flat.length,
    done,
    percent: flat.length > 0 ? Math.round((done / flat.length) * 100) : 0,
  };
}

/** Mark a problem done by id (mutates and returns the sheet — caller persists it). */
export function markDone(sheet, problemId) {
  for (const step of sheet.steps) {
    for (const subStep of step.subSteps) {
      const problem = subStep.problems.find((p) => p.id === problemId);
      if (problem) {
        problem.status = 'done';
        problem.dateCompleted = new Date().toISOString();
        return sheet;
      }
    }
  }
  throw new Error(`Problem ${problemId} not found in sheet`);
}
