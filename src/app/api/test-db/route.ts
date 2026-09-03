import { NextResponse } from 'next/server';
import postgres from 'postgres';

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ success: false, error: 'DATABASE_URL is missing' });
  }

  try {
    const sql = postgres(dbUrl, { max: 1, idle_timeout: 3 });
    const result = await sql`SELECT 1 as test`;
    
    // Mask password
    const maskedUrl = dbUrl.replace(/:[^:@]*@/, ':***@');

    return NextResponse.json({
      success: true,
      message: 'Connection successful',
      url: maskedUrl,
      result: result[0]
    });
  } catch (error: any) {
    const maskedUrl = dbUrl.replace(/:[^:@]*@/, ':***@');
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code,
      stack: error.stack,
      url: maskedUrl
    }, { status: 500 });
  }
}
