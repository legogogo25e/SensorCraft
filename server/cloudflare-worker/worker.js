/* Cloudflare Worker 日志代理：接收网页日志，调用 GitHub Issues API 创建 Issue。GITHUB_TOKEN 只存在于 Worker Secret。 */
const GITHUB_API = 'https://api.github.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = (env.ALLOWED_ORIGINS || 'https://legogogoagent.github.io')
      .split(',')
      .map(function (value) {
        return value.trim();
      })
      .filter(Boolean);
    const localOrigin = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    // 只允许 Pages 来源和本地 localhost，降低跨站滥用风险。
    const isAllowed = allowedOrigins.indexOf(origin) >= 0 || localOrigin;

    const cors = {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin'
    };
    if (isAllowed && origin) cors['Access-Control-Allow-Origin'] = origin;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return json(
        {
          ok: true,
          configured: !!env.GITHUB_TOKEN,
          owner: env.GITHUB_OWNER || 'legogogoagent',
          repo: env.GITHUB_REPO || 'biomed-quest'
        },
        200,
        cors
      );
    }

    if (request.method !== 'POST') {
      return json({ error: 'method_not_allowed' }, 405, cors);
    }

    if (!isAllowed) {
      return json({ error: 'origin_not_allowed' }, 403, cors);
    }

    if (!env.GITHUB_TOKEN) {
      return json({ error: 'server_not_configured', message: 'GITHUB_TOKEN is not set' }, 500, cors);
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    // 可选 KV 限流：每个 IP 每小时最多 RATE_LIMIT_PER_HOUR 条。
    if (env.LOG_KV && ip !== 'unknown') {
      const limit = Number(env.RATE_LIMIT_PER_HOUR || 10);
      const hour = Math.floor(Date.now() / 3600000);
      const key = 'rl:' + hour + ':' + ip;
      const current = Number((await env.LOG_KV.get(key)) || 0);
      if (current >= limit) {
        return json({ error: 'rate_limited', message: 'Too many logs from this IP. Try later.' }, 429, cors);
      }
      await env.LOG_KV.put(key, String(current + 1), { expirationTtl: 3700 });
    }

    let raw;
    try {
      raw = await request.text();
    } catch (error) {
      return json({ error: 'body_read_failed' }, 400, cors);
    }
    if (raw.length > 24000) {
      return json({ error: 'body_too_large', message: 'Log payload is too large.' }, 413, cors);
    }

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (error) {
      return json({ error: 'invalid_json' }, 400, cors);
    }

    const title = String(payload.title || '').trim().slice(0, 200);
    const body = String(payload.body || '').trim().slice(0, 20000);
    if (!title || !body) {
      return json({ error: 'missing_fields', message: 'title and body are required' }, 400, cors);
    }

    const owner = env.GITHUB_OWNER || 'legogogoagent';
    const repo = env.GITHUB_REPO || 'biomed-quest';
    const labels = (env.ISSUE_LABELS || '')
      .split(',')
      .map(function (value) {
        return value.trim();
      })
      .filter(Boolean);

    // 给 Issue 加隐藏标记，方便以后筛选/自动清理。
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
          Authorization: 'Bearer ' + env.GITHUB_TOKEN,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'SENSORCRAFT-logger',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(issueBody)
      });
    } catch (error) {
      return json({ error: 'github_unreachable', message: 'Could not reach GitHub.' }, 502, cors);
    }

    const data = await ghResponse.json().catch(function () {
      return {};
    });
    if (!ghResponse.ok) {
      return json(
        {
          error: 'github_error',
          status: ghResponse.status,
          message: data.message || 'GitHub API rejected the request.'
        },
        502,
        cors
      );
    }

    return json(
      {
        ok: true,
        issue: {
          number: data.number,
          url: data.html_url
        }
      },
      200,
      cors
    );
  }
};

function json(payload, status, headers) {
  const merged = Object.assign({}, headers, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  return new Response(JSON.stringify(payload), { status: status, headers: merged });
}
