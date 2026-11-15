import { resolveState } from '../utils/migration-state'

// Serve /setup as a self-contained HTML document so it works on the very
// first request — before any Nuxt client bundle has loaded, before there's
// any user. Pure HTML + CSS + minimal vanilla JS. No Vue runtime, no
// hydration, no assets to resolve.
//
// If the database is already migrated, skip the page entirely and 302 back
// to wherever the user came from. This prevents users from landing on the
// setup UI after the installation has already completed (e.g., via a stale
// bookmark or a shared link).

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Setting up</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
<style>
  :root {
    --bg: #FBF9F6;
    --surface: #FFFFFF;
    --border: #EADFDB;
    --text: #2C2625;
    --text-muted: #978A87;
    --primary: #C45A46;
    --primary-hover: #B04E3B;
    --secondary: #FCEEEA;
    --success: #5C7C60;
    --danger: #C1392B;
    --danger-bg: #FDECEA;
    --danger-border: #F4C7C1;
    --radius-sm: 4px;
    --radius-md: 8px;
    --radius-lg: 16px;
    --shadow-warm: 0 4px 20px rgba(196, 90, 70, 0.08);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
    color: var(--text);
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 15px;
    line-height: 1.55;
    padding: 24px;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  .card {
    width: 100%;
    max-width: 460px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-warm);
    padding: 44px 40px;
    text-align: center;
  }
  h1 {
    margin: 0 0 10px;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--text);
  }
  p { margin: 0; color: var(--text-muted); font-size: 15px; }
  .status { margin-top: 32px; min-height: 64px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; }
  .spinner {
    width: 30px; height: 30px; border-radius: 50%;
    border: 2.5px solid var(--secondary);
    border-top-color: var(--primary);
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .check {
    width: 48px; height: 48px; border-radius: 50%;
    background: var(--success); color: white;
    display: flex; align-items: center; justify-content: center;
    font-size: 24px; font-weight: 700;
    animation: pop 0.3s ease-out;
  }
  @keyframes pop {
    0% { transform: scale(0.6); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
  .status-text { font-size: 14px; color: var(--text-muted); }
  .success-text { font-weight: 600; font-size: 16px; color: var(--text); }
  .error-box {
    margin-top: 24px;
    padding: 14px 16px;
    background: var(--danger-bg);
    border: 1px solid var(--danger-border);
    border-radius: var(--radius-md);
    text-align: left;
    color: var(--danger);
    font-size: 13.5px;
    line-height: 1.5;
  }
  .error-box strong { display: block; margin-bottom: 4px; font-weight: 600; }
  button {
    margin-top: 24px;
    padding: 10px 22px;
    background: var(--primary);
    color: white;
    border: 0;
    border-radius: var(--radius-md);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.15s ease;
  }
  button:hover { background: var(--primary-hover); }
  button:disabled { opacity: 0.5; cursor: default; }
  .key-form { margin-top: 20px; text-align: left; }
  .key-form label { display: block; font-size: 13.5px; font-weight: 600; margin-bottom: 6px; }
  .key-form input {
    width: 100%; padding: 10px 12px; font: inherit; font-size: 14px;
    border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg); color: var(--text);
  }
  .key-form input:focus { outline: 2px solid var(--primary); outline-offset: 1px; }
  .key-form .hint { margin-top: 8px; font-size: 12.5px; color: var(--text-muted); }
  .key-form .hint code { font-size: 12px; background: var(--secondary); padding: 1px 5px; border-radius: var(--radius-sm); }
  .key-form button { width: 100%; margin-top: 14px; }
</style>
</head>
<body>
  <main class="card">
    <h1>Installation complete</h1>
    <p>Finalizing your system, one moment&hellip;</p>

    <div class="status" id="status">
      <div class="spinner" aria-hidden="true"></div>
      <div class="status-text" id="status-text">Preparing&hellip;</div>
    </div>

    <div id="error-box" class="error-box" hidden>
      <strong id="error-title">Something went wrong</strong>
      <div id="error-message"></div>
    </div>

    <form id="key-form" class="key-form" hidden>
      <label for="setup-key">Setup key</label>
      <input id="setup-key" type="password" autocomplete="off" required />
      <div class="hint">
        Enter the Worker secret <code>SETUP_TOKEN</code>, or <code>BETTER_AUTH_SECRET</code> if you did not set one.
        A signed-in administrator can also just press Try again.
      </div>
      <button type="submit" id="key-btn">Run update</button>
    </form>

    <button id="retry-btn" hidden>Try again</button>
  </main>

<script>
(function () {
  var params = new URLSearchParams(location.search);
  var rawRedirect = params.get('redirect') || '/';
  var redirectTo = (rawRedirect.charAt(0) === '/' && rawRedirect.charAt(1) !== '/') ? rawRedirect : '/';

  var statusEl = document.getElementById('status');
  var statusText = document.getElementById('status-text');
  var errorBox = document.getElementById('error-box');
  var errorMessage = document.getElementById('error-message');
  var retryBtn = document.getElementById('retry-btn');
  var keyForm = document.getElementById('key-form');
  var keyInput = document.getElementById('setup-key');

  function showError(title, detail) {
    statusEl.innerHTML = '';
    errorBox.hidden = false;
    document.getElementById('error-title').textContent = title;
    errorMessage.textContent = detail || '';
    retryBtn.hidden = false;
  }

  function showSuccess() {
    statusEl.innerHTML = '<div class="check" aria-hidden="true">&#10003;</div><div class="success-text">All set. Taking you in&hellip;</div>';
    setTimeout(function () { location.href = redirectTo; }, 600);
  }

  function poll() {
    keyForm.hidden = true;
    retryBtn.hidden = true;
    errorBox.hidden = true;
    statusEl.innerHTML = '<div class="spinner" aria-hidden="true"></div><div class="status-text" id="status-text">Preparing&hellip;</div>';

    fetch('/api/_migrate/status', { headers: { accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (s) {
        if (s.state === 'migrated') { showSuccess(); return; }
        if (s.state === 'unreachable') {
          showError('Cannot reach the database', (s.error || '') + ' — please verify the connection settings and redeploy.');
          return;
        }
        if (s.state === 'bootstrap') {
          runMigration(false);
          return;
        }
        if (s.state === 'pending') {
          runMigration(true);
          return;
        }
        showError('Unexpected state', String(s.state));
      })
      .catch(function (err) {
        showError('Could not check system status', err && err.message ? err.message : String(err));
      });
  }

  function runMigration(requiresAdmin, setupKey) {
    var headers = { accept: 'application/json' };
    if (setupKey) headers['x-setup-key'] = setupKey;
    statusEl.innerHTML = '<div class="spinner" aria-hidden="true"></div><div class="status-text">Updating the database&hellip;</div>';
    fetch('/api/_migrate/run', { method: 'POST', headers: headers })
      .then(function (r) {
        if (r.ok) return r.json();
        return r.json().then(function (body) { throw { status: r.status, body: body }; });
      })
      .then(function () { showSuccess(); })
      .catch(function (err) {
        var code = err && err.body && err.body.data && err.body.data.code;
        if (code === 'REQUIRES_ADMIN' || code === 'INVALID_SETUP_KEY') {
          showError('Administrator confirmation required', code === 'INVALID_SETUP_KEY'
            ? 'That setup key is not correct.'
            : 'This update changes the database, so it must be confirmed with the setup key.');
          keyForm.hidden = false;
          keyInput.value = '';
          keyInput.focus();
        } else {
          var msg = (err && err.body && err.body.message) || (err && err.message) || String(err);
          showError('Setup did not finish', msg);
        }
      });
  }

  keyForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var key = keyInput.value;
    keyForm.hidden = true;
    errorBox.hidden = true;
    retryBtn.hidden = true;
    runMigration(true, key);
  });
  retryBtn.addEventListener('click', poll);
  poll();
})();
</script>
</body>
</html>`

function safeRedirectTarget(event: Parameters<typeof getQuery>[0]): string {
  const raw = getQuery(event).redirect
  const candidate = typeof raw === 'string' ? raw : '/'
  return candidate.startsWith('/') && !candidate.startsWith('//') ? candidate : '/'
}

function isCloudflare(): boolean {
  const p = import.meta.preset
  return p === 'cloudflare-module' || p === 'cloudflare-pages'
}

export default defineEventHandler(async (event) => {
  if (!isCloudflare()) throw createError({ statusCode: 404 })
  const snapshot = await resolveState()
  if (snapshot.state === 'migrated') {
    return sendRedirect(event, safeRedirectTarget(event), 302)
  }

  setHeader(event, 'content-type', 'text/html; charset=utf-8')
  setHeader(event, 'cache-control', 'no-store')
  return HTML
})
