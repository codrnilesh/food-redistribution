/**
 * Computes the priority score of a food request.
 *
 * Formula:
 *   score = urgencyLevel * 100 - hoursUntilNeeded(needed_by)
 *
 * Higher score corresponds to higher priority.
 *
 * @param {Object} request Food request object
 * @param {number} [now=Date.now()] Reference timestamp in milliseconds
 * @returns {number} Computed score
 */
function computePriorityScore(request, now = Date.now()) {
  const urgency = Number(request.urgency_level ?? request.urgency ?? 1);
  const neededByMs = new Date(request.needed_by).getTime();
  const hoursUntilNeeded = (neededByMs - now) / (1000 * 60 * 60);
  return urgency * 100 - hoursUntilNeeded;
}

/**
 * Standard Merge Sort implementation built from scratch.
 * Time Complexity: Theta(n log n) in all cases (best, worst, and average).
 * Space Complexity: Theta(n) for auxiliary merge buffers.
 * Stability: Guaranteed by selecting left element on non-strictly greater comparisons (<= 0).
 *
 * @template T
 * @param {Array<T>} items Input array
 * @param {function(T, T): number} compareFn Comparator returning <0 if a before b, >0 if b before a, 0 if equal
 * @returns {Array<T>} New sorted array
 */
function mergeSort(items, compareFn) {
  if (!Array.isArray(items) || items.length <= 1) {
    return Array.isArray(items) ? items.slice() : [];
  }

  const mid = Math.floor(items.length / 2);
  const left = mergeSort(items.slice(0, mid), compareFn);
  const right = mergeSort(items.slice(mid), compareFn);

  return merge(left, right, compareFn);
}

/**
 * Merges two sorted subarrays stably.
 */
function merge(left, right, compareFn) {
  const merged = [];
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    // <= 0 ensures left element is chosen on equality, preserving stability
    if (compareFn(left[i], right[j]) <= 0) {
      merged.push(left[i]);
      i++;
    } else {
      merged.push(right[j]);
      j++;
    }
  }

  while (i < left.length) {
    merged.push(left[i++]);
  }
  while (j < right.length) {
    merged.push(right[j++]);
  }

  return merged;
}

/**
 * Sorts food requests descending by priority score:
 *   score = urgencyLevel * 100 - hoursUntilNeeded(needed_by)
 *
 * Ties are broken stably:
 * 1. Oldest created_at first (if created_at is present on both requests).
 * 2. Original relative order preserved (guaranteed by Merge Sort stability).
 *
 * Algorithm Complexity: Theta(n log n) always.
 *
 * @param {Array<Object>} requests Array of request objects
 * @param {number} [now=Date.now()] Optional reference timestamp for testing
 * @returns {Array<Object>} Sorted array of request objects
 */
function sortRequestsByPriority(requests = [], now = Date.now()) {
  if (!Array.isArray(requests)) {
    return [];
  }

  return mergeSort(requests, (a, b) => {
    const scoreA = computePriorityScore(a, now);
    const scoreB = computePriorityScore(b, now);

    // Descending order: higher score comes first
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }

    // Tie-break: oldest created_at first
    if (a.created_at && b.created_at) {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
        return timeA - timeB;
      }
    }

    // Tie: preserve original relative order
    return 0;
  });
}

sortRequestsByPriority.sortRequestsByPriority = sortRequestsByPriority;
sortRequestsByPriority.computePriorityScore = computePriorityScore;
module.exports = sortRequestsByPriority;
module.exports.sortRequestsByPriority = sortRequestsByPriority;
