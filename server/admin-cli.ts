const base = (process.env.GROUP_API_URL || 'http://127.0.0.1:43124').replace(/\/$/, '');
const token = process.env.ADMIN_TOKEN?.trim() ?? '';
const [command, code, memberId, movieId] = process.argv.slice(2);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!token) fail('Set ADMIN_TOKEN to the same value the server is using.');
if (command !== 'list' && command !== 'remove') {
  fail('Usage: npm run reports -- list\n       npm run reports -- remove CODE MEMBER_ID MOVIE_ID');
}

const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

if (command === 'list') {
  const response = await fetch(`${base}/admin/reports`, { headers });
  const body = await response.json();
  if (!response.ok) fail(body.error || `Request failed (${response.status})`);
  console.log(JSON.stringify(body.reports, null, 2));
} else {
  if (!code || !memberId || !movieId) fail('remove needs CODE MEMBER_ID MOVIE_ID');
  const response = await fetch(`${base}/admin/remove`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ code, memberId, movieId }),
  });
  const body = await response.json();
  if (!response.ok) fail(body.error || `Request failed (${response.status})`);
  console.log(`Removed ${body.removed} rating(s).`);
}
