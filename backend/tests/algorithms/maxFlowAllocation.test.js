const runMaxFlowAllocation = require('../../src/algorithms/maxFlowAllocation');

describe('runMaxFlowAllocation (Edmonds–Karp Max-Flow)', () => {
  test('allocates correct maximum flow on a hand-built 3x3 network with known max-flow', () => {
    // 3 donations with total supply = 15 + 25 + 20 = 60
    const donations = [
      { id: 'D1', remaining_quantity: 15 },
      { id: 'D2', remaining_quantity: 25 },
      { id: 'D3', remaining_quantity: 20 },
    ];

    // 3 requests with total demand = 20 + 15 + 10 = 45
    const requests = [
      { id: 'R1', remaining_quantity: 20 },
      { id: 'R2', remaining_quantity: 15 },
      { id: 'R3', remaining_quantity: 10 },
    ];

    // Fully connected 3x3 bipartite eligibility graph
    const eligibilityAdjacency = {
      D1: ['R1', 'R2', 'R3'],
      D2: ['R1', 'R2', 'R3'],
      D3: ['R1', 'R2', 'R3'],
    };

    const priorityOrder = ['R1', 'R2', 'R3'];

    const result = runMaxFlowAllocation(
      donations,
      requests,
      eligibilityAdjacency,
      priorityOrder
    );

    // Since total supply (60) >= total demand (45), max flow must equal total demand (45)
    expect(result.totalFlow).toBe(45);

    // Sum of allocated quantities on returned edges must equal totalFlow
    const sumAllocated = result.edges.reduce((sum, e) => sum + e.allocated_quantity, 0);
    expect(sumAllocated).toBe(45);

    // Verify all requests received their full requested demand
    const requestFulfillments = {};
    for (const edge of result.edges) {
      requestFulfillments[edge.request_id] =
        (requestFulfillments[edge.request_id] || 0) + edge.allocated_quantity;
    }
    expect(requestFulfillments['R1']).toBe(20);
    expect(requestFulfillments['R2']).toBe(15);
    expect(requestFulfillments['R3']).toBe(10);
  });

  test('returns totalFlow = 0 and empty edges when there are no eligible edges', () => {
    const donations = [
      { id: 'D1', remaining_quantity: 25 },
      { id: 'D2', remaining_quantity: 10 },
    ];

    const requests = [
      { id: 'R1', remaining_quantity: 15 },
      { id: 'R2', remaining_quantity: 20 },
    ];

    const emptyAdjacency = {
      D1: [],
      D2: [],
    };

    const result = runMaxFlowAllocation(donations, requests, emptyAdjacency, ['R1', 'R2']);

    expect(result.totalFlow).toBe(0);
    expect(result.edges).toHaveLength(0);
  });

  test('splits a single donation across two requests based on priority order', () => {
    // Donation D1 has 15 units
    const donations = [{ id: 'D1', remaining_quantity: 15 }];

    // Two requests with demand 10 each (total demand 20 > supply 15)
    const requests = [
      { id: 'R1', remaining_quantity: 10 },
      { id: 'R2', remaining_quantity: 10 },
    ];

    const eligibilityAdjacency = {
      D1: ['R1', 'R2'],
    };

    // R1 has higher priority than R2
    const priorityOrder = ['R1', 'R2'];

    const result = runMaxFlowAllocation(
      donations,
      requests,
      eligibilityAdjacency,
      priorityOrder
    );

    // Max flow should be 15
    expect(result.totalFlow).toBe(15);

    // D1 should satisfy R1 first (10 units), and the remaining 5 units go to R2
    const edgeR1 = result.edges.find((e) => e.request_id === 'R1');
    const edgeR2 = result.edges.find((e) => e.request_id === 'R2');

    expect(edgeR1).toBeDefined();
    expect(edgeR1.allocated_quantity).toBe(10);

    expect(edgeR2).toBeDefined();
    expect(edgeR2.allocated_quantity).toBe(5);
  });
});
