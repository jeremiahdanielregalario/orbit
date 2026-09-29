export type Account = { username: string; timestamp: number | null };
export type Snapshot = { followers: Account[]; following: Account[]; pending: Account[]; files: string[]; warnings: string[]; importedAt: string; label: string; demo?: boolean };
export type Group = 'all' | 'mutual' | 'not-following-back' | 'you-dont-follow' | 'pending';
export function normalize(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/^@/, '').toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(name) ? name : null;
}
export function readAccounts(value: unknown, key?: string): { accounts: Account[]; skipped: number } {
  const rows = key && value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>)[key] : value;
  if (!Array.isArray(rows)) throw new Error('This file does not have the expected Instagram JSON structure. Request a new JSON export.');
  const accounts = new Map<string, Account>(); let skipped = 0;
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') { skipped++; continue; }
    const row = raw as { title?: unknown; string_list_data?: { value?: unknown; href?: unknown; timestamp?: unknown }[] };
    const item = Array.isArray(row.string_list_data) ? row.string_list_data[0] : undefined;
    let candidate = item?.value || row.title;
    if (!candidate && typeof item?.href === 'string') {
      try { const url = new URL(item.href); if (['instagram.com','www.instagram.com'].includes(url.hostname)) candidate = url.pathname.replace(/^\/_u\//, '/').split('/').filter(Boolean)[0]; } catch { /* Invalid export URL is skipped. */ }
    }
    const username = normalize(candidate);
    if (!username) { skipped++; continue; }
    const t = item?.timestamp;
    const timestamp = typeof t === 'number' && Number.isFinite(t) && t > 0 && t < 8640000000000 ? t : null;
    const previous = accounts.get(username);
    if (!previous || (!previous.timestamp && timestamp)) accounts.set(username, { username, timestamp });
  }
  return { accounts: [...accounts.values()], skipped };
}
export function classifyFile(path: string): 'followers' | 'following' | 'pending' | null {
  const name = path.split('/').pop()?.toLowerCase() || '';
  if (/^followers(?:_\d+)?\.json$/.test(name)) return 'followers';
  if (/^following(?:_\d+)?\.json$/.test(name)) return 'following';
  if (/^pending_follow_requests\.json$/.test(name)) return 'pending';
  return null;
}
export function parseEntries(entries: { name: string; text: string }[], label: string): Snapshot {
  const result: Snapshot = { followers: [], following: [], pending: [], files: [], warnings: [], importedAt: new Date().toISOString(), label };
  const seen = new Set<string>(); let skipped = 0;
  const directories = new Set<string>();
  for (const entry of entries) {
    const kind = classifyFile(entry.name); if (!kind) continue;
    if (seen.has(entry.name)) throw new Error('Duplicate filenames found. Import one account and one export at a time.');
    seen.add(entry.name);
    if (kind !== 'pending') directories.add(entry.name.includes('/') ? entry.name.slice(0,entry.name.lastIndexOf('/')) : '');
    let parsed: unknown;
    try { parsed = JSON.parse(entry.text); } catch { throw new Error(`${entry.name.split('/').pop()} is not valid JSON.`); }
    const key = kind === 'following' ? 'relationships_following' : kind === 'pending' ? 'relationships_follow_requests_sent' : 'relationships_followers';
    const data = readAccounts(parsed, Array.isArray(parsed) ? undefined : key);
    skipped += data.skipped; result[kind].push(...data.accounts); result.files.push(entry.name);
  }
  if (directories.size > 1) throw new Error('Connection files came from different folders. Import an export for just one Instagram account.');
  for (const kind of ['followers', 'following'] as const) {
    if (!entries.some(e => classifyFile(e.name) === kind)) throw new Error(`Missing ${kind} data. Include following.json and every followers_*.json file from the same export.`);
  }
  if (skipped) throw new Error(`${skipped} account records could not be read safely. Request a fresh JSON export so your results are not incomplete.`);
  for (const kind of ['followers','following','pending'] as const) result[kind] = [...new Map(result[kind].map(a => [a.username, a])).values()];
  result.warnings.push('Results reflect the imported files, not your live account. Use an all-time export and include every follower file.');
  const followerParts = entries.map(e => e.name.split('/').pop()!.match(/^followers_(\d+)\.json$/)).filter(Boolean).map(m=>Number(m![1])).sort((a,b)=>a-b);
  if (followerParts.some((n,i)=>n !== i+1)) throw new Error('A numbered follower file is missing. Select every followers_*.json part.');
  return result;
}
export function relationships(snapshot: Snapshot) {
  const followers = new Set(snapshot.followers.map(a=>a.username));
  const following = new Set(snapshot.following.map(a=>a.username));
  return { mutual: snapshot.following.filter(a=>followers.has(a.username)), notFollowingBack: snapshot.following.filter(a=>!followers.has(a.username)), youDontFollow: snapshot.followers.filter(a=>!following.has(a.username)), all: [...new Map([...snapshot.followers,...snapshot.following].map(a=>[a.username,a])).values()] };
}
export function compareSnapshots(older: Snapshot, newer: Snapshot) {
  const oldFollowers = new Set(older.followers.map(a=>a.username)); const newFollowers = new Set(newer.followers.map(a=>a.username));
  return { added: newer.followers.filter(a=>!oldFollowers.has(a.username)), removed: older.followers.filter(a=>!newFollowers.has(a.username)) };
}
export function timeline(accounts: Account[]) {
  const counts = new Map<string,number>();
  for (const a of accounts) { if (!a.timestamp) continue; const month = new Date(a.timestamp * 1000).toISOString().slice(0,7); counts.set(month,(counts.get(month)||0)+1); }
  const keys = [...counts.keys()].sort(); if (!keys.length) return [];
  const result: { month: string; count: number }[] = []; const cursor = new Date(`${keys[0]}-01T00:00:00Z`); const end = keys[keys.length-1];
  while (cursor.toISOString().slice(0,7) <= end && result.length < 2400) { const month=cursor.toISOString().slice(0,7); result.push({month,count:counts.get(month)||0}); cursor.setUTCMonth(cursor.getUTCMonth()+1); }
  return result;
}
export function csv(accounts: Account[]) { return 'username,profile_url,export_timestamp\r\n' + accounts.map(a=>`${a.username},https://www.instagram.com/${a.username}/,${a.timestamp ? new Date(a.timestamp*1000).toISOString() : ''}`).join('\r\n'); }
export function demoSnapshot(): Snapshot {
  const names = ['alex.rivera','studio.juno','miguel.creates','lena.film','cafe.sunday','jules.wav','the.weekend.edit','marco.illustrates','sophie.in.motion','noah.design','slowmornings','aria.studio'];
  const accounts = Array.from({length: 248},(_,i)=>({ username: names[i] || `${['north','paper','little','made','daily','hello','soft','city'][i%8]}.${['studio','notes','frames','days','collective','light','stories'][i%7]}${i}`, timestamp: Date.UTC(2024+(i%3),i%12,1+(i%27))/1000 }));
  return { followers: accounts.slice(0,196), following: accounts.slice(36), pending: [{ username:'sample.private', timestamp:null }], files:['followers_1.json','following.json','pending_follow_requests.json'], warnings:['Fictional sample data. Import your archive to see your own connections.'], importedAt:new Date().toISOString(), label:'Sample Instagram export', demo:true };
}
