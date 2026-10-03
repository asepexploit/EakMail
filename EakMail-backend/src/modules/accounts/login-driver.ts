/**
 * Login driver: bridges the accounts service to whichever Session Manager is
 * active. In mock mode it simulates the phone->code->2FA handshake deterministically
 * (so the dashboard's login flow works fully offline); in real mode it delegates
 * to the GramJS LoginFlow. TASKS Phase 3b.
 *
 * The service depends on this small interface, never on GramJS directly.
 */
import { config } from '../../config/index.js';
import { encrypt } from '../../lib/crypto.js';
import { getSessionManager } from '../../telegram/session-manager/index.js';
import { GramjsSessionManager } from '../../telegram/session-manager/gramjs-session-manager.js';

export interface LoginStart {
  loginId: string;
}

export interface LoginCompletion {
  needsPassword: boolean;
  done: boolean;
  sessionEnc?: string;
}

export interface LoginDriver {
  start(loginId: string, phone: string): Promise<LoginStart>;
  submitCode(loginId: string, code: string, password?: string): Promise<LoginCompletion>;
}

/** Deterministic mock login: any 5-digit code succeeds; code "00000" demands 2FA. */
class MockLoginDriver implements LoginDriver {
  private readonly phones = new Map<string, string>();

  async start(loginId: string, phone: string): Promise<LoginStart> {
    this.phones.set(loginId, phone);
    return { loginId };
  }

  async submitCode(loginId: string, code: string, password?: string): Promise<LoginCompletion> {
    const phone = this.phones.get(loginId) ?? 'unknown';
    // Reserve one code path to exercise the 2FA branch deterministically.
    if (code === '00000' && !password) {
      return { needsPassword: true, done: false };
    }
    const session = `mock-session:${phone}:${loginId}`;
    this.phones.delete(loginId);
    return { needsPassword: false, done: true, sessionEnc: encrypt(session) };
  }
}

/** Real login: delegates to the GramJS session manager's LoginFlow. */
class GramjsLoginDriver implements LoginDriver {
  constructor(private readonly manager: GramjsSessionManager) {}

  async start(loginId: string, phone: string): Promise<LoginStart> {
    const res = await this.manager.login.start(loginId, phone);
    return { loginId: res.loginId };
  }

  submitCode(loginId: string, code: string, password?: string): Promise<LoginCompletion> {
    return this.manager.login.submitCode(loginId, code, password);
  }
}

let driver: LoginDriver | null = null;

export function getLoginDriver(): LoginDriver {
  if (driver) return driver;
  if (config.USE_MOCKS) {
    driver = new MockLoginDriver();
  } else {
    const manager = getSessionManager();
    driver = new GramjsLoginDriver(manager as GramjsSessionManager);
  }
  return driver;
}
