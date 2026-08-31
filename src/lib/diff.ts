/**
 * Line-level diff, deliberately naive: we only need to tell the agent which
 * lines are new since the last save, not render a pretty patch.
 */
export function diffLines(before: string, after: string) {
  const beforeLines = new Set(
    before
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  );
  const afterLines = after
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const added = afterLines.filter((l) => !beforeLines.has(l));
  const afterSet = new Set(afterLines);
  const removed = [...beforeLines].filter((l) => !afterSet.has(l));

  return { added, removed };
}

/** Characters of genuinely new prose. Used to decide if a run is worth it. */
export function addedCharCount(before: string, after: string) {
  return diffLines(before, after).added.join("\n").length;
}
