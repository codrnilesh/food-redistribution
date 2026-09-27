const supabase = require('../../src/db/supabaseClient');
const router = require('../../src/routes/allocationRuns');

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
  const layer = routerInstance.stack.find(
    (l) => l.route && l.route.path === path && l.route.methods[method.toLowerCase()]
  );
  if (!layer) throw new Error(`Route ${method} ${path} not found`);
  return layer.route.stack.map((s) => s.handle);
}

describe('Allocation Runs Router', () => {
  let originalFrom;

  beforeEach(() => {
    originalFrom = supabase.from;
  });

  afterEach(() => {
    supabase.from = originalFrom;
  });

  test('POST / requires admin role and returns 403 for non-admin', async () => {
    const handlers = getHandler(router, 'POST', '/');
    const roleCheck = handlers[0];

    const req = { user: { id: 'donor-1', role: 'donor' } };
    const res = createMockRes();
    let nextCalled = false;

    roleCheck(req, res, () => {
      nextCalled = true;
    });

    expect(res.statusCode).toBe(403);
    expect(nextCalled).toBe(false);
  });

  test('POST / triggers run, max-flow, creates run and allocations with status PROPOSED', async () => {
    const handlers = getHandler(router, 'POST', '/');
    const mainHandler = handlers[handlers.length - 1];

    const mockDonations = [
      {
        id: 1,
        category: 'produce',
        remaining_quantity: 20,
        nearest_hub_id: 'H1',
        lat: 21.0,
        lng: 75.0,
        expiry_time: new Date(Date.now() + 86400000).toISOString(),
        status: 'AVAILABLE',
      },
    ];

    const mockRequests = [
      {
        id: 101,
        category: 'produce',
        remaining_quantity: 15,
        nearest_hub_id: 'H1',
        lat: 21.0,
        lng: 75.0,
        urgency_level: 5,
        needed_by: new Date(Date.now() + 36000000).toISOString(),
        status: 'OPEN',
      },
    ];

    let insertedRun = null;
    let insertedAllocations = null;

    supabase.from = (table) => {
      if (table === 'donations') {
        return {
          select: () => ({
            in: () => ({
              gt: () => ({
                gt: async () => ({ data: mockDonations, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'requests') {
        return {
          select: () => ({
            in: () => ({
              gt: () => ({
                gt: async () => ({ data: mockRequests, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'hubs') {
        return { select: async () => ({ data: [{ id: 'H1', lat: 21.0, lng: 75.0 }], error: null }) };
      }
      if (table === 'hub_edges') {
        return { select: async () => ({ data: [], error: null }) };
      }
      if (table === 'allocation_runs') {
        return {
          insert: (payload) => {
            insertedRun = { id: 99, ...payload };
            return {
              select: () => ({
                single: async () => ({ data: insertedRun, error: null }),
              }),
            };
          },
        };
      }
      if (table === 'allocations') {
        return {
          insert: (payloads) => {
            insertedAllocations = payloads.map((p, idx) => ({ id: 500 + idx, ...p }));
            return {
              select: async () => ({ data: insertedAllocations, error: null }),
            };
          },
        };
      }
    };

    const req = { user: { id: 'admin-uuid', role: 'admin' } };
    const res = createMockRes();

    await mainHandler(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.data.id).toBe(99);
    expect(res.data.status).toBe('PROPOSED');
    expect(res.data.allocations).toHaveLength(1);
    expect(res.data.allocations[0].allocated_quantity).toBe(15);
    expect(res.data.allocations[0].status).toBe('PROPOSED');
  });

  test('POST /:id/confirm decrements quantities and marks confirmed or skipped', async () => {
    const handlers = getHandler(router, 'POST', '/:id/confirm');
    const mainHandler = handlers[handlers.length - 1];

    const mockRun = { id: 99, status: 'PROPOSED' };
    const mockAllocations = [
      { id: 1, run_id: 99, donation_id: 1, request_id: 101, allocated_quantity: 10, status: 'PROPOSED' },
      { id: 2, run_id: 99, donation_id: 2, request_id: 102, allocated_quantity: 50, status: 'PROPOSED' }, // insufficient quantity
    ];

    const mockDonations = [
      { id: 1, remaining_quantity: 20 },
      { id: 2, remaining_quantity: 5 }, // 5 < 50 => should be skipped
    ];
    const mockRequests = [
      { id: 101, remaining_quantity: 15 },
      { id: 102, remaining_quantity: 50 },
    ];

    const updatedAllocations = [];
    const updatedDonations = [];
    const updatedRequests = [];

    supabase.from = (table) => {
      if (table === 'allocation_runs') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: mockRun, error: null }),
            }),
          }),
          update: (fields) => ({
            eq: () => ({
              select: () => ({
                single: async () => ({ data: { ...mockRun, ...fields }, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'allocations') {
        return {
          select: () => ({
            eq: async () => ({ data: mockAllocations, error: null }),
          }),
          update: (fields) => ({
            eq: (col, val) => {
              updatedAllocations.push({ id: val, ...fields });
              return {
                select: () => ({
                  single: async () => ({ data: { id: val, ...fields }, error: null }),
                }),
              };
            },
          }),
        };
      }
      if (table === 'donations') {
        return {
          select: () => ({
            in: async () => ({ data: mockDonations, error: null }),
          }),
          update: (fields) => ({
            eq: (col, val) => {
              updatedDonations.push({ id: val, ...fields });
              return Promise.resolve();
            },
          }),
        };
      }
      if (table === 'requests') {
        return {
          select: () => ({
            in: async () => ({ data: mockRequests, error: null }),
          }),
          update: (fields) => ({
            eq: (col, val) => {
              updatedRequests.push({ id: val, ...fields });
              return Promise.resolve();
            },
          }),
        };
      }
    };

    const req = { params: { id: '99' }, user: { id: 'admin-uuid', role: 'admin' } };
    const res = createMockRes();

    await mainHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.data.status).toBe('CONFIRMED');

    // Allocation 1 should be confirmed
    expect(updatedAllocations.some((a) => a.id === 1 && a.status === 'CONFIRMED')).toBe(true);

    // Allocation 2 should be skipped due to insufficient quantity
    expect(res.data.skipped).toHaveLength(1);
    expect(res.data.skipped[0].id).toBe(2);

    // Donation 1 was decremented from 20 to 10
    expect(updatedDonations.find((d) => d.id === 1).remaining_quantity).toBe(10);
  });

  test('POST /:id/discard sets run and proposed allocations to DISCARDED without quantity changes', async () => {
    const handlers = getHandler(router, 'POST', '/:id/discard');
    const mainHandler = handlers[handlers.length - 1];

    let discardedAllocationsCalled = false;
    let discardedRunCalled = false;

    supabase.from = (table) => {
      if (table === 'allocation_runs') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { id: 99, status: 'PROPOSED' }, error: null }),
            }),
          }),
          update: (fields) => {
            if (fields.status === 'DISCARDED') discardedRunCalled = true;
            return {
              eq: () => ({
                select: () => ({
                  single: async () => ({ data: { id: 99, ...fields }, error: null }),
                }),
              }),
            };
          },
        };
      }
      if (table === 'allocations') {
        return {
          update: (fields) => {
            if (fields.status === 'DISCARDED') discardedAllocationsCalled = true;
            return {
              eq: () => ({
                eq: async () => ({ error: null }),
              }),
            };
          },
          select: () => ({
            eq: async () => ({
              data: [{ id: 1, run_id: 99, status: 'DISCARDED' }],
              error: null,
            }),
          }),
        };
      }
    };

    const req = { params: { id: '99' }, user: { id: 'admin-uuid', role: 'admin' } };
    const res = createMockRes();

    await mainHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(discardedRunCalled).toBe(true);
    expect(discardedAllocationsCalled).toBe(true);
    expect(res.data.status).toBe('DISCARDED');
  });
});
