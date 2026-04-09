const ALLOWED_ORIGIN = 'https://razzapazza.com';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

async function verifyTurnstile(token, ip, secretKey) {
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: secretKey,
      response: token,
      remoteip: ip,
    }),
  });
  const result = await res.json();
  return result.success === true;
}

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Only POST /subscribe
    const url = new URL(request.url);
    if (url.pathname !== '/subscribe' || request.method !== 'POST') {
      return json({ message: 'Not found' }, 404);
    }

    try {
      const body = await request.json();
      const email = (body.email || '').trim().toLowerCase();
      const turnstileToken = body.cf_turnstile_response || '';
      const ip = request.headers.get('CF-Connecting-IP') || '';
      const userAgent = request.headers.get('User-Agent') || '';

      // Verify Turnstile
      if (!turnstileToken || !(await verifyTurnstile(turnstileToken, ip, env.TURNSTILE_SECRET_KEY))) {
        return json({ message: 'Verification failed. Please try again.' }, 400);
      }

      // Validate email
      if (!EMAIL_REGEX.test(email)) {
        return json({ message: 'Please enter a valid email address.' }, 400);
      }

      // Insert into D1 (OR IGNORE handles duplicate emails)
      await env.DB.prepare(
        'INSERT OR IGNORE INTO subscribers (email, ip_address, user_agent) VALUES (?, ?, ?)'
      )
        .bind(email, ip, userAgent)
        .run();

      return json({ success: true, message: "Thanks — we'll be in touch." });
    } catch (err) {
      console.error('Subscribe error:', err);
      return json({ message: 'Something went wrong. Please try again.' }, 500);
    }
  },
};
