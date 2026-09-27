const computeHubDistanceMatrix = require('../../src/algorithms/hubDistances');

describe('computeHubDistanceMatrix (Floyd–Warshall)', () => {
  test('relaxes a 4-hub graph with a non-trivial shortest path through 2 intermediates', () => {
    // 4 hubs: H1, H2, H3, H4
    const hubs = [
      { id: 'H1', name: 'Hub 1' },
      { id: 'H2', name: 'Hub 2' },
      { id: 'H3', name: 'Hub 3' },
      { id: 'H4', name: 'Hub 4' },
    ];

    // Direct edge H1-H4 is suboptimal (25 km).
    // Path H1 -> H2 -> H3 -> H4 passes through 2 intermediates (H2, H3) with total distance 3 + 4 + 5 = 12 km.
    const hubEdges = [
      { hub_a_id: 'H1', hub_b_id: 'H2', distance_km: 3 },
      { hub_a_id: 'H2', hub_b_id: 'H3', distance_km: 4 },
      { hub_a_id: 'H3', hub_b_id: 'H4', distance_km: 5 },
      { hub_a_id: 'H1', hub_b_id: 'H4', distance_km: 25 },
    ];

    const matrix = computeHubDistanceMatrix(hubs, hubEdges);

    // Diagonal elements must be 0
    expect(matrix['H1']['H1']).toBe(0);
    expect(matrix['H2']['H2']).toBe(0);
    expect(matrix['H3']['H3']).toBe(0);
    expect(matrix['H4']['H4']).toBe(0);

    // Shortest path between H1 and H4 should be relaxed through H2 and H3 to 12 km
    expect(matrix['H1']['H4']).toBe(12);
    expect(matrix['H4']['H1']).toBe(12); // Undirected symmetry

    // Other paths
    expect(matrix['H1']['H3']).toBe(7); // H1 -> H2 -> H3 = 3 + 4 = 7
    expect(matrix['H2']['H4']).toBe(9); // H2 -> H3 -> H4 = 4 + 5 = 9

    // Access by 0-based array index should also work
    expect(matrix[0][3]).toBe(12);
    expect(matrix[3][0]).toBe(12);
    expect(matrix[0][0]).toBe(0);
  });

  test('handles disconnected hubs with Infinity', () => {
    const hubs = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
    const hubEdges = [{ hub_a_id: 'A', hub_b_id: 'B', distance_km: 10 }];

    const matrix = computeHubDistanceMatrix(hubs, hubEdges);

    expect(matrix['A']['B']).toBe(10);
    expect(matrix['B']['A']).toBe(10);
    expect(matrix['A']['C']).toBe(Infinity);
    expect(matrix['B']['C']).toBe(Infinity);
  });
});
