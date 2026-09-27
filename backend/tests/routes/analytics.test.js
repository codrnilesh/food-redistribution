const supabase = require('../../src/db/supabaseClient');
const router = require('../../src/routes/analytics');

function createMockRes() {
  const res = {
    statusCode: 200,
    data: null,
    status(s) {
      res.statusCode = s;
      return res;
    },
    json(d) {
      res.data = d;
      return res;
    },
  };
  return res;
}

function getHandler(routerInstance, method, path) {
  const layer = routerInstance.stack.find((l) => {
    if (!l.route || !l.route.methods[method.toLowerCase()]) return false;
    const paths = Array.isArray(l.route.path) ? l.route.path : [l.route.path];
    return paths.some((p) => typeof p === 'string' && p.includes(path));
  });
  if (!layer) throw new Error(`Route ${method} ${path} not found`);
  return layer.route.stack.map((s) => s.handle);
}

describe('Analytics Router', () => {
  let originalFrom;

  beforeEach(() => {
    originalFrom = supabase.from;
  });

  afterEach(() => {
    supabase.from = originalFrom;
  });

  test('GET /analytics/summary requires admin role', async () => {
    const handlers = getHandler(router, 'GET', 'summary');
    const roleCheck = handlers[0];

    const req = { user: { id: 'u-donor', role: 'donor' } };
    const res = createMockRes();
    let nextCalled = false;

    roleCheck(req, res, () => {
      nextCalled = true;
    });

    expect(res.statusCode).toBe(403);
    expect(nextCalled).toBe(false);
  });

  test('GET /analytics/summary calculates status counts, total allocated, and quickselect medians', async () => {
    const handlers = getHandler(router, 'GET', 'summary');
    const mainHandler = handlers[handlers.length - 1];

    const mockDonations = [
      { status: 'AVAILABLE', remaining_quantity: 10 },
      { status: 'AVAILABLE', remaining_quantity: 20 },
      { status: 'FULLY_ALLOCATED', remaining_quantity: 0 },
    ];

    const mockRequests = [
      { status: 'OPEN', remaining_quantity: 15 },
      { status: 'FULFILLED', remaining_quantity: 0 },
    ];

    const mockAllocations = [
      {
        id: 1,
        status: 'CONFIRMED',
        allocated_quantity: 20,
        distance_km: 4,
        created_at: '2026-09-01T10:00:00Z',
        confirmed_at: '2026-09-01T10:30:00Z', // 30 minutes
      },
      {
        id: 2,
        status: 'CONFIRMED',
        allocated_quantity: 15,
        distance_km: 10,
        created_at: '2026-09-01T11:00:00Z',
        confirmed_at: '2026-09-01T12:00:00Z', // 60 minutes
      },
      {
        id: 3,
        status: 'CONFIRMED',
        allocated_quantity: 10,
        distance_km: 7,
        created_at: '2026-09-01T09:00:00Z',
        confirmed_at: '2026-09-01T09:15:00Z', // 15 minutes
      },
    ];

    supabase.from = (table) => {
      if (table === 'donations') {
        return {
          select: () => Promise.resolve({ data: mockDonations, error: null }),
        };
      }
      if (table === 'requests') {
        return {
          select: () => Promise.resolve({ data: mockRequests, error: null }),
        };
      }
      if (table === 'allocations') {
        return {
          select: () => Promise.resolve({ data: mockAllocations, error: null }),
        };
      }
    };

    const req = { user: { id: 'admin-1', role: 'admin' } };
    const res = createMockRes();

    await mainHandler(req, res);

    expect(res.statusCode).toBe(200);
    // Donations counts
    expect(res.data.donations_by_status.AVAILABLE).toBe(2);
    expect(res.data.donations_by_status.FULLY_ALLOCATED).toBe(1);

    // Requests counts
    expect(res.data.requests_by_status.OPEN).toBe(1);
    expect(res.data.requests_by_status.FULFILLED).toBe(1);

    // Total quantity allocated
    expect(res.data.total_quantity_allocated).toBe(45);

    // Distances: [4, 10, 7] -> sorted [4, 7, 10] -> median 7
    expect(res.data.median_allocation_distance_km).toBe(7);

    // Time-to-confirm: [30, 60, 15] -> sorted [15, 30, 60] -> median 30 minutes
    expect(res.data.median_time_to_confirm_minutes).toBe(30);
  });
});
