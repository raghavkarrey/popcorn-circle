# Aftercredits

A private movie log for Raghav. Search a title, rate it from half a star to five, leave a short note, and keep the list on the device. There is no account and no server.

Search, rating, and the log work in Expo Go on iOS and Android, and in the browser.

## Run it on a phone

You need Node.js 20 or newer, and the [Expo Go](https://expo.dev/go) app from the App Store or Play Store. This project uses Expo SDK 58, so update Expo Go if it asks you to.

1. Install dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm start
```

3. Put the phone and the computer on the same Wi-Fi network.
4. Scan the QR code in the terminal.
   - iPhone: open the Camera app, scan, then tap the banner to open Expo Go.
   - Android: open Expo Go and use its scanner.

The app loads on the phone and refreshes when you save a file.

If the phone cannot reach the computer, start a tunnel instead:

```bash
npx expo start --tunnel
```

## Preview in the browser

```bash
npm run web
```

Expo prints a local URL. The layout is a phone-width column, the same Search and My Ratings tabs as on a device.

## Search without an API key

With no key, search runs against a shelf of films bundled in the app, including posters, year, and a short overview. Ratings you save from that shelf stay on the device.

To search the full catalog, create a free TMDB key at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api), then:

```bash
cp .env.example .env
```

Put either a v3 API key or a v4 read-access token in `.env`:

```bash
EXPO_PUBLIC_TMDB_API_KEY=your_key_here
```

Restart Expo after changing the file. If TMDB does not respond, search falls back to the shelf.

This product uses the TMDB API but is not endorsed or certified by TMDB. Poster images are loaded from TMDB’s image CDN.

## What you can do

- Search by title and open a film for its poster, year, and overview.
- Rate it in half-star steps and add an optional note of up to 280 characters.
- Open **My Ratings**, sort by most recent or highest rated, then edit or delete.
- Ratings persist in AsyncStorage on that device (`aftercredits.ratings.v1`).

## Tests

```bash
npm test
```

The tests cover the rating rules, the on-device repository, shelf search, and the TMDB fallback. They do not need a key or a device.

## Project layout

- `app/` — Search tab, My Ratings tab, and the movie screen (Expo Router)
- `lib/ratings.ts` — validation, sorting, and the storage repository
- `lib/sample-movies.ts` — the offline shelf
- `lib/tmdb.ts` — optional live search
- `context/RatingsProvider.tsx` — the log shared by both tabs
