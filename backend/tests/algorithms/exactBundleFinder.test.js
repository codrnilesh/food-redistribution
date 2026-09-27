const findExactBundle = require('../../src/algorithms/exactBundleFinder');

describe('findExactBundle (Backtracking Subset Sum)', () => {
  test('finds an exact match when one exists', () => {
    // Target is 50
    // Batches: 30, 20, 15
    // 30 + 20 = 50 (exact match)
    const candidates = [
      { id: 'b1', quantity: 30 },
      { id: 'b2', quantity: 20 },
      { id: 'b3', quantity: 15 },
    ];

    const result = findExactBundle(50, candidates);

    expect(result.isExactMatch).toBe(true);
    expect(result.achievedSum).toBe(50);
    expect(result.selectedBatchIds).toHaveLength(2);
    expect(result.selectedBatchIds).toContain('b1');
    expect(result.selectedBatchIds).toContain('b2');
  });

  test('returns the best under-target sum when no exact match exists', () => {
    // Target is 45
    // Batches: 30, 20, 10
    // Possible subsets <= 45: {30, 10} = 40, {20, 10} = 30, {30} = 30, {20} = 20, {10} = 10
    // Best under-target sum is 40 (from 30 + 10)
    const candidates = [
      { id: 'b1', quantity: 30 },
      { id: 'b2', quantity: 20 },
      { id: 'b3', quantity: 10 },
    ];

    const result = findExactBundle(45, candidates);

    expect(result.isExactMatch).toBe(false);
    expect(result.achievedSum).toBe(40);
    expect(result.selectedBatchIds).toHaveLength(2);
    expect(result.selectedBatchIds).toContain('b1');
    expect(result.selectedBatchIds).toContain('b3');
  });

  test('handles a single-candidate case correctly', () => {
    // Target = 15, candidate = 15 (exact match)
    const exactResult = findExactBundle(15, [{ id: 'single-1', quantity: 15 }]);
    expect(exactResult.isExactMatch).toBe(true);
    expect(exactResult.achievedSum).toBe(15);
    expect(exactResult.selectedBatchIds).toEqual(['single-1']);

    // Target = 10, candidate = 20 (candidate exceeds target)
    const overResult = findExactBundle(10, [{ id: 'single-2', quantity: 20 }]);
    expect(overResult.isExactMatch).toBe(false);
    expect(overResult.achievedSum).toBe(0);
    expect(overResult.selectedBatchIds).toEqual([]);
  });

  test('handles an empty-candidate case gracefully without crashing', () => {
    const result = findExactBundle(100, []);

    expect(result.achievedSum).toBe(0);
    expect(result.isExactMatch).toBe(false);
    expect(result.selectedBatchIds).toEqual([]);
  });

  test('throws the documented error when candidate batches exceed 25', () => {
    // 26 candidates
    const largeCandidates = Array.from({ length: 26 }, (_, i) => ({
      id: `batch-${i}`,
      quantity: 5,
    }));

    expect(() => findExactBundle(50, largeCandidates)).toThrow(
      /exceeds the maximum allowed limit of 25/
    );
  });
});
