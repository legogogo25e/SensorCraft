# SENSORCRAFT 日志代理

把页面上的「提交到 GitHub」从「预填 Issue 页面」升级为「直接创建 Issue」。GitHub token 只放在服务端环境变量/Secret 里，绝不进入网页。

两个版本二选一：

- **Cloudflare Worker（推荐）**：免费额度足够，支持可选的按 IP 限流。
- **Vercel Function**：部署简单，但没有内置限流。

前端通过 LOG 面板里的「直传端点（可选）」填写代理地址；该地址只保存在当前设备的 `localStorage`，不会写进公开 HTML。

---

## 1. 创建 GitHub Token

1. GitHub → `Settings` → `Developer settings` → `Personal access tokens` → `Fine-grained tokens` → `Generate new token`。
2. Resource owner：`legogogoagent`
3. Repository access：`Only select repositories` → 只选 `biomed-quest`
4. Permissions：
   - `Issues`：`Read and write`
   - `Metadata`：`Read-only`（自动勾选）
   - 不要给 Contents、Actions、Secrets 等写权限。
5. 设置过期时间（例如 90 天），生成后复制 token（`github_pat_...`）。
6. 不要把 token 写进代码、wrangler.toml、聊天记录或截图。

---

## 2. Cloudflare Worker（推荐）

```bash
cd webapp/sensor-craft/server/cloudflare-worker
npx wrangler login
npx wrangler secret put GITHUB_TOKEN   # 粘贴 token，输入不会回显
npx wrangler deploy
```

部署后会得到类似：

```text
https://sensorcraft-log.<your-subdomain>.workers.dev
```

测试：

```bash
curl https://sensorcraft-log.<your-subdomain>.workers.dev/health
# {"ok":true,"configured":true,...}
```

可选但强烈建议：按 IP 限流。

```bash
npx wrangler kv namespace create LOG_KV
```

把返回的 `id` 填进 `wrangler.toml`，取消 `[[kv_namespaces]]` 注释，然后重新 `npx wrangler deploy`。默认每个 IP 每小时最多 10 条，可用 `RATE_LIMIT_PER_HOUR` 调整。

如果页面部署在自定义域名，把域名加到 `wrangler.toml` 的 `ALLOWED_ORIGINS`（逗号分隔）。

### 在网页里配置

1. 打开部署页 → 右下角 `LOG`。
2. 在「直传端点（可选）」填入：

   ```text
   https://sensorcraft-log.<your-subdomain>.workers.dev/logs
   ```

3. 点「保存」。
4. 点「提交到 GitHub」——成功后应显示 `Issue #N` 和链接。

地址只保存在这台设备的 localStorage；换设备需要重新填。不要把它写进 `SC.config.logEndpoint` 后公开部署，否则任何人都能拿这个地址刷 Issue（token 仍安全，但会制造垃圾 Issue）。

---

## 3. Vercel 替代方案

```bash
cd webapp/sensor-craft/server/vercel
npx vercel
```

在 Vercel 项目里设置环境变量：

| 变量 | 值 |
|---|---|
| `GITHUB_TOKEN` | 你的 fine-grained PAT（Secret） |
| `GITHUB_OWNER` | `legogogoagent` |
| `GITHUB_REPO` | `biomed-quest` |
| `ALLOWED_ORIGINS` | `https://legogogoagent.github.io` |
| `ISSUE_LABELS` | 可选，例如 `sensorcraft-log` |

部署后端点：

```text
https://<project>.vercel.app/api/logs
```

填到网页的「直传端点」即可。

注意：Vercel 版没有内置限流。公开 URL 泄露后可能被刷；需要限流请用 Cloudflare Worker 版，或在 Vercel 前面加 Upstash Redis / 其他限流。

---

## 4. 安全边界

- token 只在 Worker/Vercel 环境变量里；网页只拿到代理 URL。
- 代理只允许 `ALLOWED_ORIGINS` 里的来源 + 本地 localhost，减少跨站滥用。
- 请求体上限约 24KB；超过会返回 413。
- GitHub token 只给 `Issues: Read and write`，即使泄露也不能改代码。
- Issue 是公开的；调试日志包含 UA、视口、权限状态、模块和最近事件，不要在里面放密钥、Cookie、客户数据。
- 建议设置 token 过期时间，并定期轮换。
- 如果代理 URL 泄露，开启 KV 限流或删除/重建 Worker。

---

## 5. 接口

`POST /logs`

```json
{
  "title": "SENSORCRAFT 调试日志 2026/11/6 21:00:00",
  "body": "SENSORCRAFT 调试日志\n...",
  "source": "sensorcraft",
  "page": "https://legogogoagent.github.io/biomed-quest/"
}
```

成功：

```json
{
  "ok": true,
  "issue": {
    "number": 12,
    "url": "https://github.com/legogogoagent/biomed-quest/issues/12"
  }
}
```

失败会返回 `{ "error": "...", "message": "..." }`，前端会自动回退到「预填 Issue 页面」流程。
