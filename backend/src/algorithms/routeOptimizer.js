/**
 * Finds the minimum-cost Hamiltonian PATH (not cycle) starting at stops[0]
 * visiting all given stops exactly once, using the Held–Karp dynamic programming algorithm.
 *
 * Problem Complexity & Scale Constraints:
 * - The Travelling Salesperson Problem (TSP) and Hamiltonian Path are NP-hard problems.
 * - The Held-Karp algorithm uses dynamic programming with bitmasks, requiring O(n^2 * 2^n)
 *   time complexity and O(n * 2^n) space.
 * - For n <= 10, Held-Karp is extremely fast (10^2 * 1024 = 1.02 x 10^5 operations, < 5 ms).
 * - For n > 10, exponential state growth makes exact DP impractical for real-time dispatch;
 *   the intended future fallback for larger inputs is the Nearest-Neighbor greedy heuristic
 *   (or 2-opt local search). This fallback is planned for future extension and intentionally
 *   not implemented here.
 *
 * Dynamic Programming State:
 * - dp[mask][u]: The minimum path cost to start at vertex 0, visit the exact subset of
 *   vertices represented by the bitmask `mask`, and end at vertex `u`.
 * - Base Case: dp[1][0] = 0 (only stop 0 visited, at cost 0).
 * - Transition: dp[mask | (1 << v)][v] = min(dp[mask | (1 << v)][v], dp[mask][u] + dist(u, v)).
 *
 * @param {Array<Object>} stops Array of stop objects to visit (length <= 10), starting at stops[0]
 * @param {function(Object, Object): number} distanceMatrixFn Distance function returning cost between two stops
 * @returns {{ orderedStops: Array<Object>, stopOrder: Array<number>, totalDistance: number }}
 */
function optimizeRoute(stops = [], distanceMatrixFn) {
  if (!Array.isArray(stops)) {
    throw new TypeError('stops must be an array');
  }

  // Guard against exponential blowup due to NP-hardness of TSP
  if (stops.length > 10) {
    throw new Error(
      `stops length (${stops.length}) exceeds the maximum limit of 10. The Travelling Salesperson Problem (TSP) is NP-hard with O(n^2 * 2^n) complexity under Held-Karp. Nearest-neighbor heuristic is the intended future fallback for larger cases.`
    );
  }

  const n = stops.length;
  if (n <= 1) {
    return {
      orderedStops: stops.slice(),
      stopOrder: stops.map((_, idx) => idx),
      totalDistance: 0,
    };
  }

  if (typeof distanceMatrixFn !== 'function') {
    throw new TypeError('distanceMatrixFn must be a function returning distance between two stops');
  }

  // Precompute pairwise distances between all stops
  const dist = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 0 : Number(distanceMatrixFn(stops[i], stops[j]))))
  );

  const numStates = 1 << n; // 2^n states
  // dp[mask][u]: minimum distance starting at 0, visiting subset `mask`, ending at `u`
  const dp = Array.from({ length: numStates }, () => new Float64Array(n).fill(Infinity));
  // parent[mask][u]: predecessor of u in subset `mask` for path reconstruction
  const parent = Array.from({ length: numStates }, () => new Int8Array(n).fill(-1));

  // Base state: mask = 1 (binary ...0001, vertex 0 visited), ending at vertex 0
  dp[1][0] = 0;

  // Iterate over all possible subsets containing vertex 0
  for (let mask = 1; mask < numStates; mask++) {
    // Vertex 0 must be included in the path starting at 0
    if ((mask & 1) === 0) continue;

    for (let u = 0; u < n; u++) {
      if ((mask & (1 << u)) === 0 || dp[mask][u] === Infinity) continue;

      // Try extending path to an unvisited vertex v
      for (let v = 0; v < n; v++) {
        if ((mask & (1 << v)) !== 0) continue; // v is already visited

        const nextMask = mask | (1 << v);
        const cost = dp[mask][u] + dist[u][v];

        if (cost < dp[nextMask][v]) {
          dp[nextMask][v] = cost;
          parent[nextMask][v] = u;
        }
      }
    }
  }

  // Find the optimal ending vertex for the complete Hamiltonian path (mask = 2^n - 1)
  const fullMask = numStates - 1;
  let minCost = Infinity;
  let endVertex = -1;

  for (let u = 0; u < n; u++) {
    if (dp[fullMask][u] < minCost) {
      minCost = dp[fullMask][u];
      endVertex = u;
    }
  }

  // Reconstruct path order from back-pointers
  const stopOrder = [];
  let curr = endVertex;
  let currMask = fullMask;

  while (curr !== -1) {
    stopOrder.push(curr);
    const p = parent[currMask][curr];
    currMask ^= 1 << curr;
    curr = p;
  }

  stopOrder.reverse();

  return {
    orderedStops: stopOrder.map((idx) => stops[idx]),
    stopOrder,
    totalDistance: minCost,
  };
}

optimizeRoute.optimizeRoute = optimizeRoute;
module.exports = optimizeRoute;
module.exports.optimizeRoute = optimizeRoute;
