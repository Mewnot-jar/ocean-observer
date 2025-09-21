import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const min_lon = parseFloat(searchParams.get('min_lon') ?? '-180');
  const min_lat = parseFloat(searchParams.get('min_lat') ?? '-90');
  const max_lon = parseFloat(searchParams.get('max_lon') ?? '180');
  const max_lat = parseFloat(searchParams.get('max_lat') ?? '90');
  const species_id_in = searchParams.get('species_id') ? parseInt(searchParams.get('species_id')!, 10) : null;
  const from_ts = searchParams.get('from') || null;
  const to_ts = searchParams.get('to') || null;
  const min_depth = searchParams.get('min_depth') ? parseFloat(searchParams.get('min_depth')!) : null;
  const max_depth = searchParams.get('max_depth') ? parseFloat(searchParams.get('max_depth')!) : null;

  // si viene include=mine y hay Authorization, añadimos privadas del dueño
  const includeMine = searchParams.get('include') === 'mine';
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const token = includeMine && authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null;

  let include_private_for_user: string | null = null;

  // cliente para llamar al RPC
  const baseClient = token
    ? createClient(supabaseUrl, supabaseAnon, { global: { headers: { Authorization: `Bearer ${token}` } } })
    : createClient(supabaseUrl, supabaseAnon);

  if (token) {
    const { data: userData } = await baseClient.auth.getUser();
    include_private_for_user = userData.user?.id ?? null;
  }

  const { data, error } = await baseClient.rpc('observations_geojson', {
    min_lon, min_lat, max_lon, max_lat,
    species_id_in, from_ts, to_ts, min_depth, max_depth,
    include_private_for_user,     // << NUEVO
  });

  if (error) {
    console.error('RPC error', error);
    return NextResponse.json({ error: 'failed_fetch' }, { status: 500 });
  }

  return NextResponse.json(data ?? { type: 'FeatureCollection', features: [] });
}

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const token =
    authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

  if (!token) return NextResponse.json({ error: 'missing_bearer_token' }, { status: 401 });

  const body = await req.json();
  const {
    species_common,
    species_id: speciesIdInput,
    activity,
    depth_min_m,
    depth_max_m,
    temperature_c,
    notes,
    observed_at,
    is_private = false,
    lat,
    lng,
  } = body || {};

  if (!activity || typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const supabaseAsUser = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData } = await supabaseAsUser.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  let species_id: number | null = speciesIdInput ?? null;
  if (!species_id && species_common) {
    const { data: found } = await supabaseAsUser
      .from('species')
      .select('id')
      .ilike('common_name', species_common)
      .limit(1)
      .maybeSingle();
    if (found?.id) {
      species_id = found.id;
    } else {
      const { data: ins } = await supabaseAsUser
        .from('species')
        .insert({ common_name: species_common })
        .select('id')
        .single();
      species_id = ins?.id ?? null;
    }
  }

  const { data: obs, error } = await supabaseAsUser
    .from('observations')
    .insert({
      user_id: userId,
      species_id,
      activity,
      depth_min_m: depth_min_m ?? null,
      depth_max_m: depth_max_m ?? null,
      temperature_c: temperature_c ?? null,
      notes: notes ?? null,
      observed_at: observed_at ?? new Date().toISOString(),
      is_private,
      geom: `SRID=4326;POINT(${lng} ${lat})`,
    })
    .select('id')
    .single();

  if (error || !obs) {
    console.error('insert error', error);
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
  }

  return NextResponse.json({ id: obs.id }, { status: 201 });
}