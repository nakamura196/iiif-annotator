import { NextResponse } from 'next/server';
import { openApiSpec } from '@/lib/openapi';

// OpenAPI 定義を JSON で配信。/api-docs の Swagger UI がこれを読み込む。
export function GET() {
  return NextResponse.json(openApiSpec);
}
