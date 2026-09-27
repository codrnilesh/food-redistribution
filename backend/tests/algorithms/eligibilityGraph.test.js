const buildEligibilityGraph = require('../../src/algorithms/eligibilityGraph');
const computeHubDistanceMatrix = require('../../src/algorithms/hubDistances');

describe('buildEligibilityGraph', () => {
  const hubs = [
    { id: 'H1', lat: 21.0, lng: 75.0 },
    { id: 'H2', lat: 21.05, lng: 75.05 },
    { id: 'H3', lat: 21.5, lng: 75.5 },
  ];

  const hubEdges = [
    { hub_a_id: 'H1', hub_b_id: 'H2', distance_km: 8 },
    { hub_a_id: 'H2', hub_b_id: 'H3', distance_km: 25 },
  ];

  const hubDistanceMatrix = computeHubDistanceMatrix(hubs, hubEdges);

  test('donation/request pair eligibility based on distance threshold (<= 15 km vs > 15 km)', () => {
    const futureExpiry = new Date(Date.now() + 86400000 * 2).toISOString();
    const neededBy = new Date(Date.now() + 86400000).toISOString();

    const donations = [
      {
        id: 'd-close',
        category: 'produce',
        nearest_hub_id: 'H1',
        lat: 21.0,
        lng: 75.0,
        expiry_time: futureExpiry,
      },
      {
        id: 'd-far',
        category: 'produce',
        nearest_hub_id: 'H1',
        lat: 21.0,
        lng: 75.0,
        expiry_time: futureExpiry,
      },
    ];

    const requests = [
      {
        id: 'r-near', // H1 -> H2 = 8 km <= 15 km
        category: 'produce',
        nearest_hub_id: 'H2',
        lat: 21.05,
        lng: 75.05,
        needed_by: neededBy,
      },
      {
        id: 'r-far', // H1 -> H3 = 33 km > 15 km
        category: 'produce',
        nearest_hub_id: 'H3',
        lat: 21.5,
        lng: 75.5,
        needed_by: neededBy,
      },
    ];

    const result = buildEligibilityGraph(donations, requests, hubDistanceMatrix, {
      maxRadiusKm: 15,
      hubs,
    });

    // d-close to r-near is 8 km <= 15 km -> eligible
    expect(result.adjacency['d-close']).toContain('r-near');
    expect(result.adjacency['r-near']).toContain('d-close');

    // d-close to r-far is 33 km > 15 km -> NOT eligible
    expect(result.adjacency['d-close']).not.toContain('r-far');
    expect(result.adjacency['d-far']).not.toContain('r-far');

    // r-far cannot be reached by either donation within 15 km -> isolatedRequest
    expect(result.isolatedRequests).toContain('r-far');
  });

  test('donation/request pair eligibility based on expiry time vs needed_by', () => {
    const now = Date.now();
    const neededByTime = new Date(now + 86400000).toISOString(); // needed in 24 hours
    const freshExpiry = new Date(now + 86400000 * 2).toISOString(); // expires in 48 hours (fresh)
    const expiredExpiry = new Date(now + 3600000).toISOString(); // expires in 1 hour (cannot deliver in time)

    const donations = [
      {
        id: 'd-fresh',
        category: 'cooked_meals',
        nearest_hub_id: 'H1',
        lat: 21.0,
        lng: 75.0,
        expiry_time: freshExpiry,
      },
      {
        id: 'd-expiring-soon',
        category: 'cooked_meals',
        nearest_hub_id: 'H1',
        lat: 21.0,
        lng: 75.0,
        expiry_time: expiredExpiry,
      },
    ];

    const requests = [
      {
        id: 'r-needed-tomorrow',
        category: 'cooked_meals',
        nearest_hub_id: 'H1',
        lat: 21.0,
        lng: 75.0,
        needed_by: neededByTime,
      },
    ];

    const result = buildEligibilityGraph(donations, requests, hubDistanceMatrix, {
      maxRadiusKm: 15,
      hubs,
    });

    // d-fresh expires after needed_by -> eligible
    expect(result.adjacency['d-fresh']).toContain('r-needed-tomorrow');

    // d-expiring-soon expires before needed_by -> ineligible
    expect(result.adjacency['d-expiring-soon']).not.toContain('r-needed-tomorrow');
    expect(result.isolatedDonations).toContain('d-expiring-soon');
  });

  test('identifies an isolated donation with no matching category', () => {
    const futureTime = new Date(Date.now() + 86400000).toISOString();

    const donations = [
      {
        id: 'd-dairy',
        category: 'dairy',
        nearest_hub_id: 'H1',
        lat: 21.0,
        lng: 75.0,
        expiry_time: futureTime,
      },
      {
        id: 'd-produce',
        category: 'produce',
        nearest_hub_id: 'H1',
        lat: 21.0,
        lng: 75.0,
        expiry_time: futureTime,
      },
    ];

    const requests = [
      {
        id: 'r-produce',
        category: 'produce',
        nearest_hub_id: 'H1',
        lat: 21.0,
        lng: 75.0,
        needed_by: futureTime,
      },
    ];

    const result = buildEligibilityGraph(donations, requests, hubDistanceMatrix, {
      maxRadiusKm: 15,
      hubs,
    });

    // d-produce matches r-produce category
    expect(result.adjacency['d-produce']).toContain('r-produce');
    expect(result.isolatedDonations).not.toContain('d-produce');

    // d-dairy has no matching request -> isolated donation
    expect(result.adjacency['d-dairy']).toHaveLength(0);
    expect(result.isolatedDonations).toContain('d-dairy');
    expect(result.isolatedRequests).toHaveLength(0);
  });
});
