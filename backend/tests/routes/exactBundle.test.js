const supabase = require('../../src/db/supabaseClient');
const router = require('../../src/routes/exactBundle');

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

describe('Exact Bundle Router', () => {
  let originalFrom;

  beforeEach(() => {
    originalFrom = supabase.from;
  });

  afterEach(() => {
    supabase.from = originalFrom;
  });

  test('POST /requests/:id/exact-bundle requires admin role', async () => {
    const handlers = getHandler(router, 'POST', 'exact-bundle');
    const roleCheck = handlers[0];

    const req = { user: { id: 'u1', role: 'recipient' } };
    const res = createMockRes();
    let nextCalled = false;

    roleCheck(req, res, () => {
      nextCalled = true;
    });

    expect(res.statusCode).toBe(403);
    expect(nextCalled).toBe(false);
  });

  test('POST /requests/:id/exact-bundle returns 404 if request not found', async () => {
    const handlers = getHandler(router, 'POST', 'exact-bundle');
    const mainHandler = handlers[handlers.length - 1];

    supabase.from = () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: new Error('not found') }),
        }),
      }),
    });

    const req = { params: { id: 'non-existent' }, user: { id: 'admin-id', role: 'admin' } };
    const res = createMockRes();

    await mainHandler(req, res);
    expect(res.statusCode).toBe(404);
  });

  test('POST /requests/:id/exact-bundle finds optimal bundle and returns proposal without modifying quantities', async () => {
    const handlers = getHandler(router, 'POST', 'exact-bundle');
    const mainHandler = handlers[handlers.length - 1];

    const mockRequest = {
      id: 10,
      category: 'grains',
      remaining_quantity: 50,
      needed_by: new Date(Date.now() + 36000000).toISOString(),
      nearest_hub_id: 'H1',
      lat: 21.0,
      lng: 75.0,
    };

    const mockDonations = [
      {
        id: 1,
        category: 'grains',
        remaining_quantity: 30,
        expiry_time: new Date(Date.now() + 86400000).toISOString(),
        nearest_hub_id: 'H1',
        lat: 21.0,
        lng: 75.0,
      },
      {
        id: 2,
        category: 'grains',
        remaining_quantity: 20,
        expiry_time: new Date(Date.now() + 86400000).toISOString(),
        nearest_hub_id: 'H1',
        lat: 21.0,
        lng: 75.0,
      },
      {
        id: 3,
        category: 'grains',
        remaining_quantity: 15,
        expiry_time: new Date(Date.now() + 86400000).toISOString(),
        nearest_hub_id: 'H1',
        lat: 21.0,
        lng: 75.0,
      },
    ];

    supabase.from = (table) => {
      if (table === 'requests') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: mockRequest, error: null }),
            }),
          }),
        };
      }
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
      if (table === 'hubs') {
        return { select: async () => ({ data: [{ id: 'H1', lat: 21.0, lng: 75.0 }], error: null }) };
      }
      if (table === 'hub_edges') {
        return { select: async () => ({ data: [], error: null }) };
      }
    };

    const req = { params: { id: '10' }, user: { id: 'admin-id', role: 'admin' } };
    const res = createMockRes();

    await mainHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.data.request_id).toBe(10);
    expect(res.data.target_quantity).toBe(50);
    expect(res.data.achieved_sum).toBe(50);
    expect(res.data.is_exact_match).toBe(true);
    expect(res.data.selected_batch_ids).toEqual([1, 2]);
    expect(res.data.status).toBe('PROPOSED');
  });
});
