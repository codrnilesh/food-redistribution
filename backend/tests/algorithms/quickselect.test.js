const quickselectMedian = require('../../src/algorithms/quickselect');

describe('quickselectMedian (Randomized Quickselect)', () => {
  test('computes median correctly for an odd-length array', () => {
    // Unsorted array with 5 elements: [7, 1, 3, 4, 9]
    // Sorted order: [1, 3, 4, 7, 9] -> Median is 4
    const oddArray = [7, 1, 3, 4, 9];
    const median = quickselectMedian(oddArray);
    expect(median).toBe(4);
  });

  test('computes median correctly for an even-length array', () => {
    // Unsorted array with 6 elements: [12, 3, 5, 7, 19, 1]
    // Sorted order: [1, 3, 5, 7, 12, 19] -> Median is (5 + 7) / 2 = 6
    const evenArray = [12, 3, 5, 7, 19, 1];
    const median = quickselectMedian(evenArray);
    expect(median).toBe(6);

    // Another even-length test with 4 elements
    expect(quickselectMedian([10, 20, 30, 40])).toBe(25);
  });

  test('computes median correctly for a single-element array', () => {
    expect(quickselectMedian([42])).toBe(42);
    expect(quickselectMedian([0])).toBe(0);
    expect(quickselectMedian([-15.5])).toBe(-15.5);
  });

  test('handles empty and duplicated arrays gracefully', () => {
    expect(quickselectMedian([])).toBe(0);
    expect(quickselectMedian([5, 5, 5, 5, 5])).toBe(5);
    expect(quickselectMedian([2, 8, 2, 8])).toBe(5);
  });
});
