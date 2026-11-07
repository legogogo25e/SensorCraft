/* Vercel 日志代理：与 Cloudflare Worker 等价，token 只存在于 Vercel 环境变量。 */
const GITHUB_API = 'https://api.github.com';

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://legogogoagent.github.io')
    .split(',')
    .map(function (value) {
      return value.trim();
    })
    .filter(Boolean);
  const localOrigin = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  // CORS 允许 Pages 与本地 localhost；Vercel 版没有内置限流。
  const isAllowed = allowedOrigins.indexOf(origin) >= 0 || localOrigin;

  res.setHeader('Vary', 'Origin');
  if (isAllowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({
      ok: true,
      configured: !!process.env.GITHUB_TOKEN,
      owner: process.env.GITHUB_OWNER || 'legogogoagent',
      repo: process.env.GITHUB_REPO || 'biomed-quest'
    });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  if (!isAllowed) {
    res.status(403).json({ error: 'origin_not_allowed' });
    return;
  }

  if (!process.env.GITHUB_TOKEN) {
    res.status(500).json({ error: 'server_not_configured', message: 'GITHUB_TOKEN is not set' });
    return;
  }

  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch (error) {
    res.status(400).json({ error: 'invalid_json' });
    return;
  }

  const title = String(payload.title || '').trim().slice(0, 200);
  const body = String(payload.body || '').trim().slice(0, 20000);
  if (!title || !body) {
    res.status(400).json({ error: 'missing_fields', message: 'title and body are required' });
    return;
  }

  const owner = process.env.GITHUB_OWNER || 'legogogoagent';
  const repo = process.env.GITHUB_REPO || 'biomed-quest';
  const labels = (process.env.ISSUE_LABELS || '')
    .split(',')
    .map(function (value) {
      return value.trim();
    })
    .filter(Boolean);

  // 给 Issue 加隐藏标记，方便筛选。
  const issueBody = {
    title: title,
    body: '<!-- sensorcraft-log -->\n' + body
  };
  if (labels.length) issueBody.labels = labels;

  let ghResponse;
  try {
    ghResponse = await fetch(GITHUB_API + '/repos/' + owner + '/' + repo + '/issues', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.GITHUB_TOKEN,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'SENSORCRAFT-logger',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(issueBody)
    });
  } catch (error) {
    res.status(502).json({ error: 'github_unreachable', message: 'Could not reach GitHub.' });
    return;
  }

  const data = await ghResponse.json().catch(function () {
    return {};
  });
  if (!ghResponse.ok) {
    res.status(502).json({
      error: 'github_error',
      status: ghResponse.status,
      message: data.message || 'GitHub API rejected the request.'
    });
    return;
  }

  res.status(200).json({
    ok: true,
    issue: {
      number: data.number,
      url: data.html_url
    }
  });
}
