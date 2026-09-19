import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get('placeId');
  const sessionToken = searchParams.get('sessionToken');

  if (!placeId) {
    return NextResponse.json({ error: 'Missing placeId parameter' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 });
  }

  try {
    const url = new URL(`https://places.googleapis.com/v1/places/${placeId}`);
    if (sessionToken) {
      url.searchParams.append('sessionToken', sessionToken);
    }
    
    // As per user requirements, only fetch minimum fields required
    url.searchParams.append('fields', 'location,displayName,formattedAddress,id');

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
      },
    });

    const data = await res.json();
    
    if (!res.ok) {
       console.error('Places API Details Error:', data);
       return NextResponse.json({ error: data.error?.message || 'Failed to fetch details' }, { status: res.status });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching Google Places details:', error);
    return NextResponse.json({ error: 'Failed to fetch place details' }, { status: 500 });
  }
}
