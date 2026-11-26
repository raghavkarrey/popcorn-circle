import { supportContact } from '../lib/support.ts';

const TMDB_NOTICE =
  'This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.';

export function landingHtml(logoSvg: string): string {
  const email = supportContact();
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Popcorn Circle</title>
  <meta name="description" content="Rate movies, and share ratings and notes with a small circle of friends.">
  <meta name="theme-color" content="#070709">
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: #070709;
      color: #f4f1ea;
      font-family: Georgia, "Iowan Old Style", Palatino, serif;
    }
    main {
      max-width: 1120px;
      margin: 0 auto;
      padding: 40px 28px 64px;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.3fr) minmax(240px, 0.7fr);
      gap: 48px;
      align-items: end;
      margin-top: 72px;
    }
    .panel {
      border: 1px solid rgba(244, 241, 234, 0.08);
      border-radius: 20px;
      padding: 22px;
      background: #101014;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
    }
    .panel p { margin: 0 0 14px; color: #a39e93; font-size: 15px; line-height: 1.45; }
    .panel strong { color: #f4f1ea; font-weight: 600; }
    @media (max-width: 899px) {
      .hero { grid-template-columns: 1fr; gap: 28px; margin-top: 36px; }
      .panel { display: none; }
    }
    @media (max-width: 699px) {
      main { max-width: 440px; padding: 64px 24px 48px; }
      h1 { font-size: 56px; }
    }
    .mark {
      margin: 0;
      color: #e4a853;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      font-size: 13px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
    h1 {
      margin: 10px 0 0;
      font-size: 84px;
      line-height: 0.92;
      font-weight: 600;
      letter-spacing: -0.04em;
    }
    .lead {
      margin: 18px 0 0;
      color: #a39e93;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      font-size: 18px;
      line-height: 1.5;
    }
    .links {
      display: flex;
      flex-wrap: wrap;
      gap: 18px;
      margin-top: 28px;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
    }
    a { color: #e4a853; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .cta { margin: 28px 0 0; }
    a.open {
      display: inline-flex;
      align-items: center;
      min-height: 48px;
      padding: 0 18px;
      border-radius: 999px;
      background: #e4a853;
      color: #1a1408;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      font-weight: 600;
      text-decoration: none;
    }
    a.open:hover { text-decoration: none; background: #efc27a; }
    .tmdb {
      margin-top: 72px;
      padding-top: 20px;
      border-top: 1px solid rgba(244, 241, 234, 0.08);
    }
    .tmdb svg { width: 72px; height: auto; display: block; opacity: 0.9; }
    .notice {
      max-width: 320px;
      margin: 12px 0 0;
      color: #6f6a62;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      font-size: 13px;
      line-height: 1.45;
    }
  </style>
</head>
<body>
  <main>
    <header>
      <p class="mark">Popcorn Circle</p>
      <div class="links">
        <a href="/privacy">Privacy</a>
        <a href="mailto:${email}">${email}</a>
      </div>
    </header>
    <section class="hero">
      <div>
        <h1>Rate what you watched.</h1>
        <p class="lead">Rate movies, and share ratings and notes with a small circle of friends. No account. A short code is enough.</p>
        <p class="cta"><a class="open" href="/app">Open the app</a></p>
      </div>
      <aside class="panel">
        <p><strong>Search.</strong> Find a film and keep the rating on this device.</p>
        <p><strong>For you.</strong> Suggestions from what you rated 4 stars or higher.</p>
        <p><strong>Group.</strong> Share stars and notes with a short code.</p>
      </aside>
    </section>
    <div class="tmdb">
      ${logoSvg}
      <p class="notice">${TMDB_NOTICE}</p>
    </div>
  </main>
</body>
</html>`;
}
