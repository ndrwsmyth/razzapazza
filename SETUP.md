# Cloudflare Setup Guide

Step-by-step guide to connect the email intake form to Cloudflare Workers + D1.

## Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is fine)
- Node.js 16.17+ installed
- Your domain (`razzapazza.com`) added to Cloudflare

Install Wrangler (Cloudflare's CLI):

```bash
npm install -g wrangler
```

Log in:

```bash
wrangler login
```

This opens a browser window for auth.

---

## 1. Create a Turnstile Widget

Turnstile is Cloudflare's free, invisible CAPTCHA alternative.

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Turnstile** (in the left sidebar)
2. Click **Add widget**
3. Fill in:
   - **Widget name:** `razzapazza-contact`
   - **Hostname:** `razzapazza.com`
   - **Widget mode:** `Managed` (Cloudflare decides whether to show a challenge — usually invisible)
4. Click **Create**
5. You'll get two keys:
   - **Site key** (public) — goes in `index.html`
   - **Secret key** (private) — goes in the Worker as a secret

**Update `index.html`:** Replace `YOUR_SITE_KEY` in the Turnstile div with your actual site key:

```html
<div class="cf-turnstile" data-sitekey="0x4AAAAAAA..." data-theme="light" data-size="invisible"></div>
```

---

## 2. Create the D1 Database

From the `worker/` directory:

```bash
cd worker
npx wrangler d1 create razzapazza-emails
```

This outputs something like:

```
✅ Successfully created DB 'razzapazza-emails'
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Copy that `database_id`** and paste it into `worker/wrangler.jsonc`, replacing `<FILL_AFTER_CREATION>`.

---

## 3. Run the Schema

Create the `subscribers` table:

```bash
npx wrangler d1 execute razzapazza-emails --remote --file=schema.sql
```

> **Note:** Without `--remote`, this only runs against a local dev database. You need `--remote` for production.

---

## 4. Set the Turnstile Secret

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Paste your **secret key** (from step 1) when prompted. This is stored securely by Cloudflare and available to your Worker as `env.TURNSTILE_SECRET_KEY`.

---

## 5. Deploy the Worker

```bash
npx wrangler deploy
```

Your Worker is now live at `https://razzapazza-api.<your-subdomain>.workers.dev`.

---

## 6. Set Up a Custom Domain (Recommended)

So the API lives at `api.razzapazza.com` instead of a `.workers.dev` URL:

1. Go to **Workers & Pages** → `razzapazza-api` → **Settings** → **Domains & Routes**
2. Click **Add** → **Custom Domain**
3. Enter: `api.razzapazza.com`
4. Cloudflare automatically creates the DNS record and provisions a TLS certificate

**Update `index.html`:** Make sure the `WORKER_URL` variable in the script matches your domain:

```js
var WORKER_URL = 'https://api.razzapazza.com';
```

---

## 7. Set Up Rate Limiting (Free Tier)

Prevent abuse with Cloudflare's built-in WAF rate limiting:

1. Go to **Security** → **WAF** → **Rate limiting rules**
2. Click **Create rule**
3. Configure:
   - **Rule name:** `Limit subscribe endpoint`
   - **If incoming requests match:** URI Path equals `/subscribe` AND Method equals `POST`
   - **Rate:** 5 requests per 10 minutes
   - **Per:** IP address
   - **Action:** Block
4. Click **Deploy**

---

## 8. Test It

Test with curl:

```bash
# Should return 400 (no Turnstile token)
curl -X POST https://api.razzapazza.com/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "cf_turnstile_response": ""}'

# Should return 404
curl https://api.razzapazza.com/other
```

---

## 9. View Submissions

Query your D1 database:

```bash
npx wrangler d1 execute razzapazza-emails --remote --command="SELECT * FROM subscribers ORDER BY created_at DESC"
```

---

## Local Development

To test the Worker locally:

```bash
cd worker
npx wrangler dev
```

This starts a local server at `http://localhost:8787`. It uses a local D1 database (separate from production).

To test the frontend locally, temporarily change `WORKER_URL` in `index.html` to `http://localhost:8787`.

---

## Summary

| What | Where |
|------|-------|
| Site key | `index.html` → `data-sitekey` attribute |
| Secret key | Worker secret → `TURNSTILE_SECRET_KEY` |
| Database ID | `worker/wrangler.jsonc` → `database_id` |
| Worker URL | `index.html` → `WORKER_URL` variable |
| Rate limiting | Cloudflare Dashboard → WAF → Rate limiting rules |
