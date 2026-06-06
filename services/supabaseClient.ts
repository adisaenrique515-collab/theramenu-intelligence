import { supabaseUrl, supabaseAnonKey } from '../utils/appMode';

function headers() {
  return {
    'Content-Type': 'application/json',
    'apikey': supabaseAnonKey,
    'Authorization': `Bearer ${supabaseAnonKey}`,
    'Prefer': 'return=representation',
  };
}

export async function supabaseInsert<T>(table: string, row: Record<string, unknown>): Promise<T | null> {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(row),
  });
  if (!res.ok) return null;
  const rows = await res.json() as T[];
  return rows[0] ?? null;
}

export async function supabaseSelect<T>(table: string, query?: string): Promise<T[]> {
  const url = `${supabaseUrl}/rest/v1/${table}${query ? `?${query}` : ''}`;
  const res = await fetch(url, { method: 'GET', headers: headers() });
  if (!res.ok) return [];
  return res.json() as Promise<T[]>;
}

export async function supabasePatch(table: string, match: string, body: Record<string, unknown>): Promise<void> {
  await fetch(`${supabaseUrl}/rest/v1/${table}?${match}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(body),
  });
}
