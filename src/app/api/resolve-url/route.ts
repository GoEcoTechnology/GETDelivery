import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    // Validate it's a google URL to prevent SSRF
    const urlObj = new URL(url);
    if (!urlObj.hostname.includes('google.com') && !urlObj.hostname.includes('goo.gl')) {
      return NextResponse.json({ error: 'Invalid URL domain' }, { status: 400 });
    }

    // Fetch the URL. By default, fetch follows redirects.
    // We can then inspect the final url that was reached.
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      // We don't need the body, but sometimes sites require a full GET to resolve redirects fully.
    });

    return NextResponse.json({ finalUrl: res.url });
  } catch (error: any) {
    console.error('Error resolving URL:', error);
    return NextResponse.json({ error: 'Failed to resolve URL' }, { status: 500 });
  }
}
