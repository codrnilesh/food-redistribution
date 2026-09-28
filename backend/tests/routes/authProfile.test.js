const supabase = require('../../src/db/supabaseClient');
const router = require('../../src/routes/authProfile');

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

describe('Auth Profile Router', () => {
  let originalFrom;

  beforeEach(() => {
    originalFrom = supabase.from;
  });

  afterEach(() => {
    supabase.from = originalFrom;
  });

  test('POST /profile rejects admin role with 403 Forbidden', async () => {
    const handlers = getHandler(router, 'POST', 'profile');
    const mainHandler = handlers[handlers.length - 1];

    const req = {
      body: { role: 'admin', name: 'Super Admin' },
      user: { id: 'u-1', email: 'admin@example.com' },
    };
    const res = createMockRes();

    await mainHandler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.data.error).toBe('Forbidden');
  });

  test('POST /profile rejects invalid body with 400 Bad Request', async () => {
    const handlers = getHandler(router, 'POST', 'profile');
    const mainHandler = handlers[handlers.length - 1];

    const req = {
      body: { role: 'donor', name: '' }, // missing name
      user: { id: 'u-1', email: 'donor@example.com' },
    };
    const res = createMockRes();

    await mainHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.data.error).toBe('Validation failed');
  });

  test('POST /profile returns 409 Conflict if profile already exists', async () => {
    const handlers = getHandler(router, 'POST', 'profile');
    const mainHandler = handlers[handlers.length - 1];

    supabase.from = (table) => {
      expect(table).toBe('profiles');
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: { id: 'u-1' }, error: null }),
          }),
        }),
      };
    };

    const req = {
      body: { role: 'donor', name: 'Existing User' },
      user: { id: 'u-1', email: 'user@example.com' },
    };
    const res = createMockRes();

    await mainHandler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.data.error).toBe('Profile already exists');
  });

  test('POST /profile inserts new row and returns 201 Created', async () => {
    const handlers = getHandler(router, 'POST', 'profile');
    const mainHandler = handlers[handlers.length - 1];

    let insertedRow = null;
    supabase.from = (table) => {
      expect(table).toBe('profiles');
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: null }), // no existing profile
          }),
        }),
        insert: (payload) => {
          insertedRow = payload;
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { ...payload }, error: null }),
            }),
          };
        },
      };
    };

    const req = {
      body: {
        role: 'donor',
        name: 'New Donor',
        phone: '1234567890',
        address: '100 Green St',
      },
      user: { id: 'u-new', email: 'new@example.com' },
    };
    const res = createMockRes();

    await mainHandler(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.data.id).toBe('u-new');
    expect(res.data.role).toBe('donor');
    expect(res.data.name).toBe('New Donor');
    expect(insertedRow.id).toBe('u-new');
  });

  test('GET /me returns caller profile', async () => {
    const handlers = getHandler(router, 'GET', 'me');
    const mainHandler = handlers[handlers.length - 1];

    const mockProfile = { id: 'u-caller', role: 'volunteer', name: 'Val Volunteer' };
    const req = {
      user: { id: 'u-caller', email: 'vol@example.com', profile: mockProfile },
    };
    const res = createMockRes();

    await mainHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.data.id).toBe('u-caller');
    expect(res.data.name).toBe('Val Volunteer');
  });
});
