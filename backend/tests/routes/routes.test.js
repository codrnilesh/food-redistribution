const supabase = require('../../src/db/supabaseClient');
const router = require('../../src/routes/routes');

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

describe('Routes Router', () => {
  let originalFrom;

  beforeEach(() => {
    originalFrom = supabase.from;
  });

  afterEach(() => {
    supabase.from = originalFrom;
  });

  test('POST /routes/generate requires admin role', async () => {
    const handlers = getHandler(router, 'POST', 'generate');
    const roleCheck = handlers[0];

    const req = { user: { id: 'vol-1', role: 'volunteer' } };
    const res = createMockRes();
    let nextCalled = false;

    roleCheck(req, res, () => {
      nextCalled = true;
    });

    expect(res.statusCode).toBe(403);
    expect(nextCalled).toBe(false);
  });

  test('POST /routes/generate generates routes and route_stops for unrouted allocations', async () => {
    const handlers = getHandler(router, 'POST', 'generate');
    const mainHandler = handlers[handlers.length - 1];

    const mockAllocations = [
      { id: 1, donation_id: 10, request_id: 20, status: 'CONFIRMED', distance_km: 5 },
    ];
    const mockVolunteers = [{ id: 'vol-1', role: 'volunteer' }];
    const mockDonation = { id: 10, lat: 21.0, lng: 75.0, nearest_hub_id: 'H1' };
    const mockRequest = { id: 20, lat: 21.05, lng: 75.05, nearest_hub_id: 'H1' };

    let insertedRoute = null;
    let insertedStops = [];

    supabase.from = (table) => {
      if (table === 'route_stops') {
        return {
          select: (fields) => {
            if (fields === 'allocation_id') {
              return Promise.resolve({ data: [], error: null });
            }
            return {
              in: () => ({
                order: () => Promise.resolve({ data: insertedStops, error: null }),
              }),
            };
          },
          insert: (payloads) => {
            insertedStops = payloads.map((p, i) => ({ id: 100 + i, ...p }));
            return {
              select: () => Promise.resolve({ data: insertedStops, error: null }),
            };
          },
        };
      }
      if (table === 'allocations') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: mockAllocations, error: null }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: mockVolunteers, error: null }),
          }),
        };
      }
      if (table === 'donations') {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: [mockDonation], error: null }),
          }),
        };
      }
      if (table === 'requests') {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: [mockRequest], error: null }),
          }),
        };
      }
      if (table === 'hubs') {
        return { select: () => Promise.resolve({ data: [{ id: 'H1', lat: 21.0, lng: 75.0 }], error: null }) };
      }
      if (table === 'hub_edges') {
        return { select: () => Promise.resolve({ data: [], error: null }) };
      }
      if (table === 'routes') {
        return {
          insert: (payload) => {
            insertedRoute = { id: 50, ...payload };
            return {
              select: () => ({
                single: () => Promise.resolve({ data: insertedRoute, error: null }),
              }),
            };
          },
        };
      }
    };

    const req = { user: { id: 'admin-id', role: 'admin' } };
    const res = createMockRes();

    await mainHandler(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.data.routes).toHaveLength(1);
    expect(res.data.routes[0].volunteer_id).toBe('vol-1');
    expect(res.data.routes[0].stops).toHaveLength(2); // 1 PICKUP and 1 DROPOFF
    expect(res.data.routes[0].stops[0].stop_type).toBe('PICKUP');
    expect(res.data.routes[0].stops[1].stop_type).toBe('DROPOFF');
  });

  test('GET /routes/mine returns the authenticated volunteer routes and stops', async () => {
    const handlers = getHandler(router, 'GET', 'mine');
    const mainHandler = handlers[handlers.length - 1];

    const mockRoutes = [{ id: 50, volunteer_id: 'vol-1', status: 'ASSIGNED' }];
    const mockStops = [
      { id: 101, route_id: 50, stop_order: 1, stop_type: 'PICKUP', status: 'PENDING' },
      { id: 102, route_id: 50, stop_order: 2, stop_type: 'DROPOFF', status: 'PENDING' },
    ];

    supabase.from = (table) => {
      if (table === 'routes') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: mockRoutes, error: null }),
            }),
          }),
        };
      }
      if (table === 'route_stops') {
        return {
          select: () => ({
            in: () => ({
              order: () => Promise.resolve({ data: mockStops, error: null }),
            }),
          }),
        };
      }
    };

    const req = { user: { id: 'vol-1', role: 'volunteer' } };
    const res = createMockRes();

    await mainHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.data).toHaveLength(1);
    expect(res.data[0].id).toBe(50);
    expect(res.data[0].stops).toHaveLength(2);
  });

  test('PATCH /route-stops/:id updates status to DONE for owning volunteer and rejects non-owner', async () => {
    const handlers = getHandler(router, 'PATCH', 'route-stops');
    const mainHandler = handlers[handlers.length - 1];

    const mockStop = { id: 101, route_id: 50, status: 'PENDING' };
    const mockRoute = { id: 50, volunteer_id: 'vol-1' };

    supabase.from = (table) => {
      if (table === 'route_stops') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: mockStop, error: null }),
            }),
          }),
          update: (fields) => ({
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { ...mockStop, ...fields }, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'routes') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: mockRoute, error: null }),
            }),
          }),
        };
      }
    };

    // 1. Non-owning volunteer
    const forbiddenReq = {
      params: { id: '101' },
      user: { id: 'vol-other', role: 'volunteer' },
    };
    const forbiddenRes = createMockRes();
    await mainHandler(forbiddenReq, forbiddenRes);
    expect(forbiddenRes.statusCode).toBe(403);

    // 2. Owning volunteer
    const ownerReq = {
      params: { id: '101' },
      user: { id: 'vol-1', role: 'volunteer' },
    };
    const ownerRes = createMockRes();
    await mainHandler(ownerReq, ownerRes);
    expect(ownerRes.statusCode).toBe(200);
    expect(ownerRes.data.status).toBe('DONE');
  });
});
