const sortRequestsByPriority = require('../../src/algorithms/prioritySort');

describe('sortRequestsByPriority (Merge Sort)', () => {
  const referenceTime = new Date('2026-10-01T00:00:00Z').getTime();

  test('sorts requests descending by priority score: urgencyLevel * 100 - hoursUntilNeeded', () => {
    // Score formula: urgency * 100 - (needed_by - now) / 1hr
    // r1: urgency 4, needed in 10 hours -> score = 400 - 10 = 390
    // r2: urgency 5, needed in 50 hours -> score = 500 - 50 = 450
    // r3: urgency 2, needed in 5 hours  -> score = 200 - 5  = 195
    const requests = [
      { id: 'r1', urgency_level: 4, needed_by: new Date(referenceTime + 10 * 3600000).toISOString() },
      { id: 'r2', urgency_level: 5, needed_by: new Date(referenceTime + 50 * 3600000).toISOString() },
      { id: 'r3', urgency_level: 2, needed_by: new Date(referenceTime + 5 * 3600000).toISOString() },
    ];

    const sorted = sortRequestsByPriority(requests, referenceTime);
    expect(sorted.map((r) => r.id)).toEqual(['r2', 'r1', 'r3']);
  });

  test('breaks ties by oldest created_at first', () => {
    // Both requests have identical urgency and needed_by (identical score = 300 - 20 = 280)
    // r-old was created on 2026-09-01 (older)
    // r-new was created on 2026-09-15 (newer)
    const requests = [
      {
        id: 'r-new',
        urgency_level: 3,
        needed_by: new Date(referenceTime + 20 * 3600000).toISOString(),
        created_at: '2026-09-15T12:00:00Z',
      },
      {
        id: 'r-old',
        urgency_level: 3,
        needed_by: new Date(referenceTime + 20 * 3600000).toISOString(),
        created_at: '2026-09-01T08:00:00Z',
      },
    ];

    const sorted = sortRequestsByPriority(requests, referenceTime);
    expect(sorted.map((r) => r.id)).toEqual(['r-old', 'r-new']);
  });

  test('maintains stable original order when scores and created_at are identical', () => {
    const identicalTime = '2026-09-10T00:00:00Z';
    const requests = [
      { id: 'tie-1', urgency_level: 3, needed_by: new Date(referenceTime + 24 * 3600000).toISOString(), created_at: identicalTime },
      { id: 'tie-2', urgency_level: 3, needed_by: new Date(referenceTime + 24 * 3600000).toISOString(), created_at: identicalTime },
      { id: 'tie-3', urgency_level: 3, needed_by: new Date(referenceTime + 24 * 3600000).toISOString(), created_at: identicalTime },
    ];

    const sorted = sortRequestsByPriority(requests, referenceTime);
    expect(sorted.map((r) => r.id)).toEqual(['tie-1', 'tie-2', 'tie-3']);
  });
});
