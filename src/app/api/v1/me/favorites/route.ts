import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { socialService } from '@/server/services/social.service';

export const GET = withErrorHandler(async (req: Request) => {
  const s = await requireUser();
  const url = new URL(req.url);
  const page = Number(url.searchParams.get('page') ?? 1);
  const pageSize = Number(url.searchParams.get('pageSize') ?? 20);
  const result = await socialService.myFavorites(s.userId, page, pageSize);
  return NextResponse.json({ data: result.data, pagination: result.pagination });
});
