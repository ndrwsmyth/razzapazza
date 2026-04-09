const ALLOWED_ORIGINS = new Set([
  'https://razzapazza.com',
  'https://www.razzapazza.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function corsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://razzapazza.com';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
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
  return res.json();
}

function messageForTurnstileError(errorCodes = []) {
  if (errorCodes.includes('timeout-or-duplicate')) {
    return 'Verification expired. Please try again.';
  }

  if (errorCodes.includes('invalid-input-secret') || errorCodes.includes('missing-input-secret')) {
    return 'Verification is misconfigured. Please try again later.';
  }

  return 'Verification failed. Please try again.';
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Only POST /subscribe
    const url = new URL(request.url);
    if (url.pathname !== '/subscribe' || request.method !== 'POST') {
      return json({ message: 'Not found' }, 404, origin);
    }

    try {
      const body = await request.json();
      const email = (body.email || '').trim().toLowerCase();
      const turnstileToken = body.cf_turnstile_response || '';
      const ip = request.headers.get('CF-Connecting-IP') || '';
      const userAgent = request.headers.get('User-Agent') || '';

      // Verify Turnstile
      if (!turnstileToken) {
        return json({ message: 'Verification failed. Please try again.' }, 400, origin);
      }

      const verification = await verifyTurnstile(turnstileToken, ip, env.TURNSTILE_SECRET_KEY);

      if (verification.success !== true) {
        console.error('Turnstile verification failed', {
          errorCodes: verification['error-codes'] || [],
          hostname: verification.hostname || '',
          action: verification.action || '',
        });
        return json(
          { message: messageForTurnstileError(verification['error-codes'] || []) },
          400,
          origin
        );
      }

      // Validate email
      if (!EMAIL_REGEX.test(email)) {
        return json({ message: 'Please enter a valid email address.' }, 400, origin);
      }

      // Insert into D1 (OR IGNORE handles duplicate emails)
      await env.DB.prepare(
        'INSERT OR IGNORE INTO subscribers (email, ip_address, user_agent) VALUES (?, ?, ?)'
      )
        .bind(email, ip, userAgent)
        .run();

      return json({ success: true, message: "Thanks — we'll be in touch." }, 200, origin);
    } catch (err) {
      console.error('Subscribe error:', err);
      return json({ message: 'Something went wrong. Please try again.' }, 500, origin);
    }
  },
};
