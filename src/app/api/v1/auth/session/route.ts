import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const cookieStore = cookies();
    const tokenFromCookie = cookieStore.get('bv_user_session')?.value || cookieStore.get('bv_ops_session')?.value;
    
    // Also check Authorization header
    const authHeader = request.headers.get('authorization');
    const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    const token = tokenFromCookie || tokenFromHeader;

    if (!token) {
      return NextResponse.json({
        success: true,
        data: { authenticated: false, user: null },
      });
    }

    const user = await getSessionUser(token);

    if (!user) {
      return NextResponse.json({
        success: true,
        data: { authenticated: false, user: null },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        authenticated: true,
        user,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message || 'Gagal memuat sesi pengguna' } },
      { status: 500 }
    );
  }
}
