// Ensures modules that construct SDK clients at import time (e.g.
// lib/openai/client.ts's `new OpenAI(...)`) don't throw in the test
// environment just because real provider credentials aren't configured here.
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? 'test-key'
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://example.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'test-service-role-key'
