// Hari's intake: static page + tiny API.
//   GET  /api/state  -> { state }            (what he has answered so far)
//   PUT  /api/state  -> { ok, savedAt }      (body: { state, events })
// Everything else is served from ./public by the ASSETS binding.

const STATE_KEY = 'state:hari';
const MAX_BYTES = 200_000;             // plenty for 18 long answers
const EMAIL_COOLDOWN_SECONDS = 600;    // at most one email per question every 10 minutes

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/state') {
      if (request.method === 'GET') {
        const raw = await env.INTAKE_KV.get(STATE_KEY);
        return json({ state: raw ? JSON.parse(raw) : null });
      }
      if (request.method === 'PUT') {
        let body;
        try { body = await request.json(); } catch { return json({ error: 'Body must be JSON' }, 400); }
        if (!body || typeof body.state !== 'object' || body.state === null) return json({ error: 'Missing state' }, 400);

        const raw = JSON.stringify(body.state);
        if (raw.length > MAX_BYTES) return json({ error: 'State too large' }, 413);
        await env.INTAKE_KV.put(STATE_KEY, raw);

        const events = Array.isArray(body.events) ? body.events.slice(0, 10) : [];
        if (events.length) ctx.waitUntil(notify(events, env));

        return json({ ok: true, savedAt: new Date().toISOString() });
      }
      return json({ error: 'Method not allowed' }, 405);
    }

    return env.ASSETS.fetch(request);
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

async function notify(events, env) {
  if (!env.RESEND_API_KEY) { console.log('RESEND_API_KEY not set; skipping email'); return; }
  for (const ev of events) {
    try {
      if (ev.type === 'keep') {
        const q = Number(ev.q) || 0;
        const gate = `mail:q${q}`;
        if (await env.INTAKE_KV.get(gate)) continue;               // recently emailed about this question
        await env.INTAKE_KV.put(gate, '1', { expirationTtl: EMAIL_COOLDOWN_SECONDS });
        await sendEmail(env, keepEmail(ev, env));
      } else if (ev.type === 'export') {
        await sendEmail(env, exportEmail(ev, env));
      } else if (ev.type === 'reset') {
        await sendEmail(env, {
          subject: 'Hari cleared all his answers',
          html: `<p style="font:15px Georgia,serif">Hari tapped "Clear all answers" at ${istTime(ev.at)}. The booth is empty again.</p>`
        });
      }
    } catch (err) {
      console.log('notify failed', err && err.message);
    }
  }
}

function istTime(iso) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' }) + ' IST';
}

function progressTable(progress) {
  if (!progress || !Array.isArray(progress.sections)) return '';
  const rows = progress.sections.map(s => {
    const full = s.done === s.total;
    return `<tr>
      <td style="padding:4px 12px 4px 0;color:${full ? '#1f7a5a' : '#333'}">${esc(s.title)}${full ? ' &#10003;' : ''}</td>
      <td style="padding:4px 0;color:#666">${s.done} of ${s.total}</td>
    </tr>`;
  }).join('');
  return `<table style="border-collapse:collapse;font:14px Arial,sans-serif;margin:14px 0">${rows}</table>`;
}

function keepEmail(ev, env) {
  const p = ev.progress || {};
  const remaining = (p.total || 18) - (p.answered || 0);
  const subject = `Hari saved Q${ev.q} (${ev.section}) \u2014 ${p.answered || '?'} of ${p.total || 18} done`;
  const html = `
    <div style="font:16px Georgia,serif;color:#222;max-width:520px">
      <p>Hari saved <b>question ${ev.q}</b> in <b>${esc(ev.section)}</b> at ${istTime(ev.at)}.</p>
      <p style="color:#555">${p.answered || 0} of ${p.total || 18} answered, ${remaining} to go.</p>
      ${progressTable(p)}
      <p style="font:13px Arial,sans-serif;color:#888">Only the question number is sent; his answers stay on the page until he exports them.<br>
      <a href="${env.SITE_URL || ''}" style="color:#6a4fd8">${env.SITE_URL || ''}</a></p>
    </div>`;
  return { subject, html };
}

function exportEmail(ev, env) {
  const p = ev.progress || {};
  const complete = p.answered === p.total;
  const subject = complete
    ? `Hari finished and exported all ${p.total} answers`
    : `Hari exported his answers (${p.answered || 0} of ${p.total || 18})`;
  const html = `
    <div style="font:16px Georgia,serif;color:#222;max-width:520px">
      <p>Hari exported his answers as <b>${esc(ev.kind || 'a file')}</b> at ${istTime(ev.at)}.</p>
      <p style="color:#555">${complete ? 'Every reel is kept. Ask him to send you the file.' : `${p.answered || 0} of ${p.total || 18} answered so far.`}</p>
      ${progressTable(p)}
    </div>`;
  return { subject, html };
}

async function sendEmail(env, { subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.FROM_EMAIL || 'Hari\'s intake <onboarding@resend.dev>',
      to: [env.NOTIFY_EMAIL || 'cm.niveditha99@gmail.com'],
      subject,
      html
    })
  });
  if (!res.ok) console.log('Resend error', res.status, await res.text());
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
