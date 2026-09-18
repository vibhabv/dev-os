// Minimal chainable mock of the subset of the Supabase JS query builder API
// used by lib/api/withApiAuth.ts and the Route Handlers under test. Real
// integration tests against a live Supabase project (per docs/specs/18's
// "Integration" row) require the `supabase` CLI + Docker and a schema-applied
// test project, neither of which is available in this environment — these
// tests instead verify the Route Handler contract (auth guard, validation,
// error envelope shape) against a controllable mock of the same client shape.

export function createMockSupabaseServer(overrides: {
  session?: { user: { id: string } } | null
  from?: (table: string) => any
} = {}) {
  const session = overrides.session === undefined ? { user: { id: 'user-1' } } : overrides.session

  return {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session } }),
    },
    from: overrides.from ?? jest.fn(() => chainableEmpty()),
  }
}

export function chainableEmpty() {
  const builder: any = {
    select: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    update: jest.fn(() => builder),
    delete: jest.fn(() => builder),
    upsert: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    gt: jest.fn(() => builder),
    gte: jest.fn(() => builder),
    lt: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    then: (resolve: any) => resolve({ data: [], error: null, count: 0 }),
  }
  return builder
}
