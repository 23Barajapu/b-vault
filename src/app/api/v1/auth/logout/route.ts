import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { destroySession } from '@/lib/auth';

export async function POST() {
  try {
    const cookieStore = cookies();
    const userToken = cookieStore.get('bv_user_session')?.value;
    const opsToken = cookieStore.get('bv_ops_session')?.value;

    if (userToken) await destroySession(userToken);
    if (opsToken) await destroySession(opsToken);

    const response = NextResponse.json({
      success: true,
      message: 'Sesi login berhasil diakhiri.',
    });

    response.cookies.delete('bv_user_session');
    response.cookies.delete('bv_ops_session');

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message || 'Gagal logout' } },
      { status: 500 }
    );
  }
}
