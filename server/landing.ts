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
      max-width: 440px;
      margin: 0 auto;
      padding: 64px 24px 48px;
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
      font-size: 56px;
      line-height: 0.95;
      font-weight: 600;
      letter-spacing: -0.03em;
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
    <p class="mark">Popcorn Circle</p>
    <h1>Rate what you watched.</h1>
    <p class="lead">Rate movies, and share ratings and notes with a small circle of friends. No account. A short code is enough.</p>
    <p class="cta"><a class="open" href="/app">Open the app</a></p>
    <div class="links">
      <a href="/privacy">Privacy policy</a>
      <a href="mailto:${email}">${email}</a>
    </div>
    <div class="tmdb">
      ${logoSvg}
      <p class="notice">${TMDB_NOTICE}</p>
    </div>
  </main>
</body>
</html>`;
}
