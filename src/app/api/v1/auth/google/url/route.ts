import { NextResponse } from 'next/server';
import { buildGoogleAuthUrl, getGoogleConfig } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const redirectPath = searchParams.get('redirect') || '/';

    const { clientId, isConfigured } = getGoogleConfig();
    const { url } = buildGoogleAuthUrl(redirectPath);

    return NextResponse.json({
      success: true,
      data: {
        isConfigured,
        clientId: clientId ? `${clientId.substring(0, 12)}...` : '',
        authUrl: url,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message || 'Gagal memproses URL Google Auth' } },
      { status: 500 }
    );
  }
}
