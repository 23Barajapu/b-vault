import { NextResponse } from 'next/server';
import { upsertGoogleUser, createSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { credential, id_token } = body;
    const tokenToVerify = credential || id_token;

    if (!tokenToVerify) {
      return NextResponse.json(
        { success: false, error: { message: 'Token kredensial Google wajib disertakan' } },
        { status: 400 }
      );
    }

    // Verify token with Google's tokeninfo endpoint
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenToVerify)}`);
    const payload = await verifyRes.json();

    if (!verifyRes.ok || !payload.email) {
      return NextResponse.json(
        { success: false, error: { message: payload.error_description || 'Token Google tidak valid atau kedaluwarsa' } },
        { status: 401 }
      );
    }

    const user = await upsertGoogleUser({
      sub: payload.sub,
      email: payload.email,
      name: payload.name || payload.email.split('@')[0],
      picture: payload.picture,
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
    });

    if (user.role === 'admin') {
      response.cookies.set('bv_ops_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
    }

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message || 'Gagal memverifikasi token Google' } },
      { status: 500 }
    );
  }
}
