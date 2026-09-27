/**
 * Finds an optimal subset of candidate donation batches whose sum is as close
 * as possible to the target quantity without exceeding it (preferring an exact match).
 *
 * Algorithm Design:
 * - Subset Sum is a well-known NP-complete problem. For unconstrained n, exhaustive
 *   search requires O(2^n) time. To guarantee predictable, sub-second execution in
 *   real-time food redistribution operations, candidateBatches is capped at n = 25
 *   (2^25 ≈ 3.35 x 10^7 maximum states, practically reduced by orders of magnitude via pruning).
 *
 * Backtracking & Pruning:
 * 1. Candidates are sorted descending by quantity, so large batches are tried first.
 * 2. If an exact match is discovered (currentSum === targetQuantity), recursion terminates immediately.
 * 3. Branch pruning via upper bounds: at any node, if (currentSum + sum of all remaining candidates)
 *    cannot beat bestSum found so far, the entire subtree is pruned.
 * 4. Feasibility pruning: if currentSum + candidate.quantity > targetQuantity, the candidate is skipped.
 *
 * @param {number} targetQuantity Desired quantity to fulfill
 * @param {Array<{id: string|number, quantity: number}>} candidateBatches Available donation batches
 * @returns {{ selectedBatchIds: Array<string|number>, achievedSum: number, isExactMatch: boolean }}
 */
function findExactBundle(targetQuantity, candidateBatches = []) {
  if (!Array.isArray(candidateBatches)) {
    throw new TypeError('candidateBatches must be an array');
  }

  // Cap candidateBatches length at 25 to guard against exponential blowup due to NP-completeness
  if (candidateBatches.length > 25) {
    throw new Error(
      `candidateBatches length (${candidateBatches.length}) exceeds the maximum allowed limit of 25. Subset sum is NP-complete and exponential backtracking could cause severe latency for large n.`
    );
  }

  const target = Number(targetQuantity);
  if (isNaN(target) || target <= 0 || candidateBatches.length === 0) {
    return {
      selectedBatchIds: [],
      achievedSum: 0,
      isExactMatch: false,
    };
  }

  // Normalize candidate quantities and sort descending
  const candidates = candidateBatches
    .map((b) => ({
      id: b.id,
      quantity: Number(b.quantity !== undefined ? b.quantity : b.remaining_quantity),
    }))
    .filter((b) => !isNaN(b.quantity) && b.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity);

  const n = candidates.length;
  if (n === 0) {
    return {
      selectedBatchIds: [],
      achievedSum: 0,
      isExactMatch: false,
    };
  }

  // Precompute suffix sums for upper-bound branch-and-bound pruning
  const suffixSum = new Array(n + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    suffixSum[i] = suffixSum[i + 1] + candidates[i].quantity;
  }

  let bestSum = 0;
  let bestSelected = [];
  let isExactMatch = false;

  function backtrack(index, currentSum, currentSelected) {
    if (isExactMatch) return;

    if (currentSum > bestSum && currentSum <= target) {
      bestSum = currentSum;
      bestSelected = currentSelected.slice();
      if (bestSum === target) {
        isExactMatch = true;
        return;
      }
    }

    if (index >= n) return;

    // Prune: if even with all remaining candidates we cannot exceed bestSum, prune this branch
    if (currentSum + suffixSum[index] <= bestSum) {
      return;
    }

    const candidate = candidates[index];

    // Branch 1: Include candidate if it fits within target
    if (currentSum + candidate.quantity <= target) {
      currentSelected.push(candidate.id);
      backtrack(index + 1, currentSum + candidate.quantity, currentSelected);
      currentSelected.pop();
    }

    // Branch 2: Exclude candidate
    backtrack(index + 1, currentSum, currentSelected);
  }

  backtrack(0, 0, []);

  return {
    selectedBatchIds: bestSelected,
    achievedSum: bestSum,
    isExactMatch,
  };
}

findExactBundle.findExactBundle = findExactBundle;
module.exports = findExactBundle;
module.exports.findExactBundle = findExactBundle;
