import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const input = searchParams.get('input');
  const sessionToken = searchParams.get('sessionToken');

  if (!input) {
    return NextResponse.json({ error: 'Missing input parameter' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 });
  }

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify({
        input,
        sessionToken,
      }),
    });

    const data = await res.json();
    
    if (!res.ok) {
       console.error('Places API Error:', data);
       return NextResponse.json({ error: data.error?.message || 'Failed to fetch' }, { status: res.status });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching Google Places autocomplete:', error);
    return NextResponse.json({ error: 'Failed to fetch places' }, { status: 500 });
  }
}
