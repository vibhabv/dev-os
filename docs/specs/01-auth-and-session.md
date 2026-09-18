# 01 — Authentication & Session Management

Implements PRD US-001, FR-01; engineering doc Flows 1–2, Section 5 (routing/middleware), Section 6 (auth core system).

## User flow

1. Landing page (`app/(marketing)/page.tsx`) renders "Sign In" and "Get Started Free" CTAs.
2. "Get Started Free" opens `components/auth/SignUpModal.tsx` (Client Component, focus-trapped, `Esc`-dismissible per WCAG 2.1 AA).
3. Form fields: `email` (type=email, required), `password` (type=password, required, min 8 chars — enforced client-side before calling Supabase, which additionally enforces its own minimum).
4. On submit: `await supabase.auth.signUp({ email, password })` via `lib/supabase/client.ts`.
   - Success: show confirmation state inside the modal: "Check your email to verify your account." Do not redirect yet — Supabase requires email confirmation before a session is issued (project auth setting: "Confirm email" = ON).
   - Failure: map the raw Supabase error message through `lib/utils/authErrors.ts` (see below) and show inline under the form, in place of raising a toast — the acceptance criterion requires a "clear error message" in-context.
5. User clicks the verification link in the email → browser navigates to `app/auth/callback/route.ts`.
6. `SignInModal.tsx` (parallel component) calls `supabase.auth.signInWithPassword({ email, password })`; on success, `router.push('/dashboard')`; on failure, inline error "Invalid email or password."

## `app/auth/callback/route.ts`

```ts
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const supabase = createServerClient(/* cookies */);
  const { data, error } = await supabase.auth.exchangeCodeForSession(code!);
  if (error || !data.session) {
    return NextResponse.redirect(new URL('/?error=auth_callback_failed', req.url));
  }

  if (process.env.BETA_MODE_ENABLED === 'true') {
    const admin = createAdminClient(); // service-role — required because grant_beta_access() grants EXECUTE only to service_role (docs/specs/supabase-schema.sql)
    const { data: granted, error: rpcError } = await admin.rpc('grant_beta_access', { p_user_id: data.session.user.id });
    if (rpcError) {
      // Fail closed on an unexpected RPC error rather than silently granting or looping —
      // send the user to the waitlist and let them retry; this does not consume a cohort slot.
      return NextResponse.redirect(new URL('/beta-waitlist', req.url));
    }
    return NextResponse.redirect(new URL(granted ? '/dashboard' : '/beta-waitlist', req.url));
  }

  return NextResponse.redirect(new URL('/dashboard', req.url));
}
```

**Atomicity:** `grant_beta_access(p_user_id)` (`docs/specs/supabase-schema.sql`) is a single `SECURITY DEFINER` Postgres function that takes a `pg_advisory_xact_lock` before checking the cohort count and inserting, serializing concurrent callback invocations against each other so the count-then-insert genuinely cannot race and over-admit the cohort — matching the engineering doc Section 7 claim verbatim ("atomically counts existing rows and inserts only if the count is below 50, preventing a race condition"). The function is idempotent (a user who already has a `beta_access` row gets `true` back immediately without re-checking the count), so a user who reloads or double-clicks the verification link is never blocked by their own prior grant. Only `service_role` has `EXECUTE` on this function (revoked from `authenticated`/`anon`/`public` in the schema) — an ordinary authenticated user cannot call it directly to self-grant access for an arbitrary `user_id`.

## `middleware.ts`

```ts
export const config = { matcher: ['/dashboard/:path*', '/contracts/:path*', '/account'] };

export async function middleware(req: NextRequest) {
  const supabase = createServerClient(/* cookies from req/res */);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    const url = new URL('/', req.url);
    url.searchParams.set('redirect', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (process.env.BETA_MODE_ENABLED === 'true') {
    const { data: betaRow } = await supabase
      .from('beta_access')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (!betaRow && req.nextUrl.pathname !== '/beta-waitlist') {
      return NextResponse.redirect(new URL('/beta-waitlist', req.url));
    }
  }

  return NextResponse.next();
}
```

Post-login redirect: the landing page reads `?redirect=` on successful sign-in and navigates there instead of the default `/dashboard`.

## `hooks/useAuth.ts`

```ts
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, loading, signOut: () => supabase.auth.signOut() };
}
```

## `lib/utils/authErrors.ts`

Maps raw Supabase Auth error messages/codes to user-friendly strings:

```ts
const MAP: Record<string, string> = {
  'Invalid login credentials': 'Invalid email or password.',
  'User already registered': 'An account with this email already exists. Try signing in instead.',
  'Password should be at least 6 characters': 'Password must be at least 8 characters.',
  'Email not confirmed': 'Please verify your email before signing in — check your inbox for the confirmation link.',
};

export function mapAuthError(rawMessage: string): string {
  return MAP[rawMessage] ?? 'Something went wrong. Please try again.';
}
```

## Sign out

`components/ui/UserMenu.tsx` (dashboard header) calls `await supabase.auth.signOut()` then `router.push('/')`.

## Edge cases

| Case | Behavior |
|---|---|
| User submits sign-up with an email already registered | Supabase returns "User already registered" → mapped friendly message; no session created |
| User clicks an expired/reused verification link | `exchangeCodeForSession` errors → redirect to `/?error=auth_callback_failed`; landing page shows a toast: "That verification link has expired. Please sign up again." |
| Session expires mid-session (JWT expiry) | `@supabase/ssr` auto-refreshes via refresh token; if refresh fails, `onAuthStateChange` fires `SIGNED_OUT`, `useAuth` clears session, next protected navigation is caught by `middleware.ts` |
| User signs in while `BETA_MODE_ENABLED=true` and cohort is full, but they already have a `beta_access` row (granted earlier) | `middleware.ts` finds their row and allows access regardless of current cohort count — the cap only blocks *new* grants |
| `BETA_MODE_ENABLED` flips from `true` to `false` mid-operation (Public Launch cutover) | All `beta_access` / `middleware.ts` checks become no-ops immediately (env var read on every request, no caching) — every verified user gets full access |

## Acceptance criteria mapping

- US-001: auth completes ≤10s (no artificial delay introduced; Supabase Auth typically responds in <1s) — invalid credentials show a clear inline error (`mapAuthError`).
