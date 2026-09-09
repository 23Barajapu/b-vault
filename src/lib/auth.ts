import crypto from 'crypto';
import supabase from './supabase';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar_url?: string | null;
  google_id?: string | null;
}

export function getAdminEmails(): string[] {
  const envAdmins = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return ['ops@b-vault.id', 'admin@b-vault.id', 'barajapu23@gmail.com', 'agilezone9@gmail.com', ...envAdmins];
}

export function getAppBaseUrl(req?: Request): string {
  if (req) {
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    if (host) {
      const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
      return `${proto}://${host}`;
    }
  }
  if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost')) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

export function getGoogleConfig() {
  const clientId =
    process.env.GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLII ||
    '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const isConfigured = Boolean(clientId && clientSecret);
  return { clientId, clientSecret, isConfigured };
}

export function buildGoogleAuthUrl(redirectPath = '/', req?: Request): { url: string; isConfigured: boolean } {
  const { clientId } = getGoogleConfig();
  if (!clientId) {
    return { url: '', isConfigured: false };
  }

  const baseUrl = getAppBaseUrl(req);
  const redirectUri = `${baseUrl}/api/v1/auth/google/callback`;
  const state = Buffer.from(JSON.stringify({ redirectPath })).toString('base64');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    state,
  });

  return {
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    isConfigured: true,
  };
}

export async function upsertGoogleUser(profile: {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}): Promise<AuthUser> {
  const email = profile.email.toLowerCase().trim();
  const name = profile.name || email.split('@')[0];
  const avatarUrl = profile.picture || null;
  const googleId = profile.sub;

  // Check if user exists by google_id or email
  const { data: existingUsers } = await supabase
    .from('users')
    .select('*')
    .or(`google_id.eq.${googleId},email.eq.${email}`)
    .limit(1);

  let user = existingUsers?.[0];

  const adminEmails = getAdminEmails();

  if (user) {
    const role = (adminEmails.includes(email) || user.role === 'admin') ? 'admin' : user.role || 'customer';
    const { data: updated, error } = await supabase
      .from('users')
      .update({
        google_id: googleId,
        name,
        avatar_url: avatarUrl || user.avatar_url,
        role,
      })
      .eq('id', user.id)
      .select()
      .single();

    if (!error && updated) user = updated;
  } else {
    const role = adminEmails.includes(email) ? 'admin' : 'customer';
    const { data: inserted, error } = await supabase
      .from('users')
      .insert({
        name,
        email,
        role,
        google_id: googleId,
        avatar_url: avatarUrl,
      })
      .select()
      .single();

    if (!error && inserted) user = inserted;
  }

  return {
    id: user?.id || 1,
    name: user?.name || name,
    email: user?.email || email,
    role: user?.role || 'customer',
    avatar_url: user?.avatar_url || avatarUrl,
    google_id: user?.google_id || googleId,
  };
}

export async function createSession(userId: number, days = 30): Promise<{ token: string; expiresAt: string }> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  await supabase
    .from('user_sessions')
    .insert({
      token,
      user_id: userId,
      expires_at: expiresAt,
    });

  return { token, expiresAt };
}

export async function getSessionUser(token: string): Promise<AuthUser | null> {
  if (!token) return null;

  const { data, error } = await supabase
    .from('user_sessions')
    .select('user_id, expires_at, users:user_id(id, name, email, role, avatar_url, google_id)')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data || !data.users) return null;

  const u = Array.isArray(data.users) ? data.users[0] : (data.users as any);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    avatar_url: u.avatar_url,
    google_id: u.google_id,
  };
}

export async function destroySession(token: string): Promise<void> {
  if (!token) return;
  await supabase.from('user_sessions').delete().eq('token', token);
}
