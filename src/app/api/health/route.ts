import { NextResponse } from 'next/server';

// 健康检查。阶段 0 仅返回基础存活；阶段 1/2 起接入 DB/Redis/MinIO 三依赖 ping。
export async function GET() {
  return NextResponse.json({
    ok: true,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
