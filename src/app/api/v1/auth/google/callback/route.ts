import { NextResponse } from 'next/server';
import { getAppBaseUrl, getGoogleConfig, upsertGoogleUser, createSession } from '@/lib/auth';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  let redirectPath = '/';
  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
      if (decoded.redirectPath) redirectPath = decoded.redirectPath;
    } catch {}
  }

  const baseUrl = getAppBaseUrl(request);

  if (error || !code) {
    const errorUrl = new URL(redirectPath, baseUrl);
    errorUrl.searchParams.set('auth_error', error || 'Google login dibatalkan');
    return NextResponse.redirect(errorUrl.toString());
  }

  try {
    const { clientId, clientSecret } = getGoogleConfig();
    const redirectUri = `${baseUrl}/api/v1/auth/google/callback`;

    // 1. Exchange code for Google access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || 'Gagal menukar authorization code Google');
    }

    // 2. Fetch user profile from Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userData = await userRes.json();
    if (!userRes.ok || !userData.email) {
      throw new Error('Gagal mengambil profil akun Google');
    }

    // 3. Upsert user in database
    const user = await upsertGoogleUser({
      sub: userData.id || userData.sub,
      email: userData.email,
      name: userData.name || userData.email.split('@')[0],
      picture: userData.picture,
    });

    // 4. Create session
    const { token, expiresAt } = await createSession(user.id);

    // 5. Smart redirect:
    // If admin -> direct to /ops
    // If buyer -> direct to /vault (or redirectPath if already on a specific page)
    let targetPath = redirectPath;
    if (user.role === 'admin') {
      if (!redirectPath || redirectPath === '/') {
        targetPath = '/ops';
      }
    } else {
      if (!redirectPath || redirectPath === '/') {
        targetPath = '/vault';
      }
    }

    const successUrl = new URL(targetPath, baseUrl);
    successUrl.searchParams.set('auth_success', '1');

    const response = NextResponse.redirect(successUrl.toString());

    response.cookies.set('bv_user_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    // If admin, also set bv_ops_session so user can access /ops immediately
    if (user.role === 'admin') {
      response.cookies.set('bv_ops_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
    }

    return response;
  } catch (err: any) {
    const errorUrl = new URL(redirectPath, baseUrl);
    errorUrl.searchParams.set('auth_error', encodeURIComponent(err.message || 'Gagal login Google'));
    return NextResponse.redirect(errorUrl.toString());
  }
}
