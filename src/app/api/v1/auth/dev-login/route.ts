import { NextResponse } from 'next/server';
import { upsertGoogleUser, createSession } from '@/lib/auth';

// Endpoint for instant simulated Google Login (useful for local development & testing)
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = (body.email || 'user@gmail.com').toLowerCase().trim();
    const name = body.name || email.split('@')[0].replace('.', ' ');

    const user = await upsertGoogleUser({
      sub: `google_sim_${Date.now()}`,
      email,
      name,
      picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
    });

    const { token, expiresAt } = await createSession(user.id);

    const response = NextResponse.json({
      success: true,
      data: {
        user,
        token,
        expires_at: expiresAt,
      },
    });

    response.cookies.set('bv_user_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

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
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message || 'Gagal login simulasi' } },
      { status: 500 }
    );
  }
}
