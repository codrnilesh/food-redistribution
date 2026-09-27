const optimizeRoute = require('../../src/algorithms/routeOptimizer');

describe('optimizeRoute (Held-Karp Hamiltonian Path DP)', () => {
  // Helper to compute all permutations of an array
  function permute(arr) {
    if (arr.length <= 1) return [arr];
    const result = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      for (const p of permute(rest)) {
        result.push([arr[i], ...p]);
      }
    }
    return result;
  }

  // Brute force Hamiltonian path starting at stops[0]
  function bruteForceHamiltonianPath(stops, distFn) {
    const indicesToPermute = Array.from({ length: stops.length - 1 }, (_, i) => i + 1);
    const permutations = permute(indicesToPermute);

    let minCost = Infinity;
    let bestOrder = null;

    for (const p of permutations) {
      const fullPath = [0, ...p];
      let currentCost = 0;
      for (let i = 0; i < fullPath.length - 1; i++) {
        currentCost += distFn(stops[fullPath[i]], stops[fullPath[i + 1]]);
      }

      if (currentCost < minCost) {
        minCost = currentCost;
        bestOrder = fullPath;
      }
    }

    return { minCost, bestOrder };
  }

  test('matches brute-force optimum on a 5-point non-symmetric instance', () => {
    // 5 points in a 2D coordinate space
    const stops = [
      { id: 'origin', x: 0, y: 0 },
      { id: 'p1', x: 10, y: 5 },
      { id: 'p2', x: 2, y: 8 },
      { id: 'p3', x: 7, y: 1 },
      { id: 'p4', x: 12, y: 11 },
    ];

    const euclideanDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    const bruteForceResult = bruteForceHamiltonianPath(stops, euclideanDistance);
    const heldKarpResult = optimizeRoute(stops, euclideanDistance);

    // Assert that the Held-Karp DP total distance exactly matches the brute-force optimum
    expect(heldKarpResult.totalDistance).toBeCloseTo(bruteForceResult.minCost, 5);

    // The path must start at stops[0]
    expect(heldKarpResult.stopOrder[0]).toBe(0);
    expect(heldKarpResult.orderedStops[0].id).toBe('origin');

    // All stops must be visited exactly once
    expect(heldKarpResult.orderedStops).toHaveLength(stops.length);
    const visitedIds = new Set(heldKarpResult.orderedStops.map((s) => s.id));
    expect(visitedIds.size).toBe(stops.length);
  });

  test('throws the documented error when stops.length > 10 due to NP-hardness of TSP', () => {
    const elevenStops = Array.from({ length: 11 }, (_, i) => ({ id: `stop-${i}`, x: i, y: i }));
    const dummyDist = () => 1;

    expect(() => optimizeRoute(elevenStops, dummyDist)).toThrow(
      /exceeds the maximum limit of 10/
    );
  });

  test('handles 0 and 1 stop edge cases gracefully', () => {
    expect(optimizeRoute([], () => 0)).toEqual({
      orderedStops: [],
      stopOrder: [],
      totalDistance: 0,
    });

    const single = [{ id: 'solo', x: 5, y: 5 }];
    expect(optimizeRoute(single, () => 0)).toEqual({
      orderedStops: single,
      stopOrder: [0],
      totalDistance: 0,
    });
  });
});
