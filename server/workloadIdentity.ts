import { GoogleAuth } from 'google-auth-library';

export const DATASTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
type TokenSource = () => Promise<string | null | undefined>;

// Single-flight refresh/initialization, with bounded caller wait and sanitized errors.
// The official Google client caches and refreshes short-lived credentials.
export function createWorkloadTokenProvider(source: TokenSource, timeoutMs = 8000) {
  let pending: Promise<string> | undefined;
  return async (): Promise<string> => {
    if (!pending) {
      pending = Promise.resolve().then(source).then(value => {
        if (typeof value !== 'string' || !value.trim()) throw new Error('Workload access token unavailable');
        return value;
      }).catch(() => { throw new Error('Workload identity unavailable'); });
      const active = pending;
      void active.then(() => { if (pending === active) pending = undefined; }, () => { if (pending === active) pending = undefined; });
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([pending, new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Workload identity timed out')), timeoutMs);
      })]);
    } finally { if (timer) clearTimeout(timer); }
  };
}

let googleAuth: GoogleAuth | undefined;
const adc = createWorkloadTokenProvider(async () => {
  googleAuth ??= new GoogleAuth({ scopes: [DATASTORE_SCOPE] });
  return googleAuth.getAccessToken();
});

export async function getDatastoreAccessToken(env: NodeJS.ProcessEnv = process.env): Promise<string> {
  // Fixed tokens are intentionally restricted to the isolated unit test fixture.
  if (env.GOOGLE_OAUTH_ACCESS_TOKEN) {
    if (env.NODE_ENV === 'test' && env.FIREBASE_PROJECT_ID === 'nexustalent-test') return env.GOOGLE_OAUTH_ACCESS_TOKEN;
    throw new Error('Static access tokens are not supported outside unit tests');
  }
  return adc();
}
