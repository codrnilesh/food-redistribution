const scheduleDeliveries = require('../../src/algorithms/deliveryScheduler');

describe('scheduleDeliveries (Greedy Activity Selection)', () => {
  test('assigns non-overlapping jobs to a single volunteer', () => {
    // 3 non-overlapping jobs
    const allocations = [
      { id: 'job-1', start: 8, end: 10 },
      { id: 'job-2', start: 10, end: 12 },
      { id: 'job-3', start: 13, end: 15 },
    ];
    const volunteers = [{ id: 'vol-1' }];

    const result = scheduleDeliveries(allocations, volunteers);

    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].volunteerId).toBe('vol-1');
    expect(result.assignments[0].allocationIds).toEqual(['job-1', 'job-2', 'job-3']);
    expect(result.unassignedAllocationIds).toHaveLength(0);
  });

  test('filters out overlapping jobs when only one volunteer is available', () => {
    // 3 mutually overlapping jobs in the interval 9-13
    const allocations = [
      { id: 'job-a', start: 9, end: 11 },
      { id: 'job-b', start: 10, end: 12 }, // overlaps job-a
      { id: 'job-c', start: 11, end: 13 }, // compatible with job-a
    ];
    const volunteers = [{ id: 'vol-1' }];

    const result = scheduleDeliveries(allocations, volunteers);

    // Greedy choice selects earliest finishing (job-a, ends at 11), then compatible job-c (starts at 11)
    expect(result.assignments[0].allocationIds).toEqual(['job-a', 'job-c']);
    // job-b is unassigned
    expect(result.unassignedAllocationIds).toEqual(['job-b']);
  });

  test('schedules jobs across 2 volunteers when overlapping jobs require a second volunteer', () => {
    // Two pairs of overlapping jobs
    const allocations = [
      { id: 'job-1', start: 1, end: 4 },
      { id: 'job-2', start: 2, end: 5 }, // overlaps job-1
      { id: 'job-3', start: 4, end: 7 }, // compatible with job-1
      { id: 'job-4', start: 5, end: 8 }, // compatible with job-2
    ];
    const volunteers = [{ id: 'vol-1' }, { id: 'vol-2' }];

    const result = scheduleDeliveries(allocations, volunteers);

    expect(result.assignments).toHaveLength(2);

    // Vol 1 gets earliest finishing chain: job-1 (1-4) and job-3 (4-7)
    expect(result.assignments[0].volunteerId).toBe('vol-1');
    expect(result.assignments[0].allocationIds).toEqual(['job-1', 'job-3']);

    // Vol 2 gets remaining chain: job-2 (2-5) and job-4 (5-8)
    expect(result.assignments[1].volunteerId).toBe('vol-2');
    expect(result.assignments[1].allocationIds).toEqual(['job-2', 'job-4']);

    expect(result.unassignedAllocationIds).toHaveLength(0);
  });

  test('derives job window from distance_km using constant speed when explicit window is omitted', () => {
    // 30 km at 30 km/h = 1 hour duration. Start defaults to 0.
    const allocations = [
      { id: 'job-dist', distance_km: 30 },
    ];
    const volunteers = [{ id: 'vol-1' }];

    const result = scheduleDeliveries(allocations, volunteers, { speedKmH: 30 });
    expect(result.assignments[0].allocationIds).toEqual(['job-dist']);
  });
});
