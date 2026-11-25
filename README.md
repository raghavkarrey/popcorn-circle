# Popcorn Circle

Popcorn Circle is a movie log for Raghav, planned for popcorncircle.com. Search a title, rate it from half a star to five, leave a short note, and keep that list on the device. Friends can also start a group with a short join code and see each other’s ratings. There is no account.

Search, rating, and the personal log work in Expo Go on iOS and Android, and in the browser. Solo use does not need the group server.

## Try a shared group

The group server is a small program in this repo. It does not need Supabase, Firebase, or any paid account. Ratings shared with a group live in `server/data/circles.json` on the computer running the server. Personal ratings still stay in AsyncStorage on each device.

In one terminal:

```bash
npm run circle
```

That listens on port **43124**. In another terminal, start the app (`npm start` or `npm run web`).

### Two browser tabs

1. Open the web app in two tabs.
2. In the first tab, open **Group**, type a name, and tap **Start a group**.
3. Copy the 6-character code.
4. In the second tab, open **Group**, type a different name, enter that code, and tap **Join group**.
5. In the first tab, rate a film from **Search** and save it.
6. Within a few seconds the second tab shows that rating and note on **Group**, and on the film itself under **In the group**.

Each tab keeps its own name. On one computer, **My Ratings** is still the browser’s personal log, so those two tabs share it. The **Group** list is where each person’s stars and notes show up separately. Two phones each keep their own personal log.

A film is shared only when you save it while you are in the group. Ratings you saved before joining stay on that phone. Leaving a group removes your shared ratings from the group and leaves **My Ratings** alone.

The join code is the only lock. Anyone with the code can join and read the notes. It is meant for friends, not for private accounts.

### On two phones

1. Run `npm run circle` on the computer.
2. Find the computer’s LAN address (for example `192.168.1.20`).
3. In `.env`:

```bash
EXPO_PUBLIC_GROUP_API_URL=http://192.168.1.20:43124
```

4. Restart Expo so the app picks up the address. Phones cannot use `127.0.0.1`; that points at the phone itself.
5. Both phones join the same code.

The browser on the same computer can leave this unset. It defaults to `http://127.0.0.1:43124`.

### App Review notes

The group server creates a demo group the first time it starts. Apple reviewers can join it without making their own:

- Join code: `APLREV`
- Sample members already in the group: Alex, Sam, and Jordan, with notes on Inception, Spirited Away, and Parasite
- Join with any display name. Rate another film to add a shared note, or use Report and Block on the samples.

Personal ratings from before this rename are still stored under `aftercredits.ratings.v1`.

### Reports

Set `ADMIN_TOKEN` in the environment before starting the server. Then, from another terminal:

```bash
ADMIN_TOKEN=your-token npm run reports -- list
ADMIN_TOKEN=your-token npm run reports -- remove APLREV m_review_alex shelf-inception
```

`list` prints open and closed reports. `remove` deletes that member’s shared rating for that movie and marks matching reports removed. Requests without the token are rejected.

### Put the server online

This environment cannot create a Render or Fly account. The app is one command from either host. After it is live, set `EXPO_PUBLIC_GROUP_API_URL` to the `https` URL and ship a new build. Do not leave the default pointed at localhost for the App Store build.

Render:

1. Create a Render account and a new Blueprint from this repo. `render.yaml` is included.
2. Confirm the disk named `circles` is mounted at `/data`.
3. Set `ADMIN_TOKEN` if Render did not generate one. `CORS_ORIGIN` can stay `*`.
4. Open `https://<your-service>.onrender.com/health` and expect `{"ok":true}`.
5. Privacy policy: `https://<your-service>.onrender.com/privacy`.
6. Put that origin in `EXPO_PUBLIC_GROUP_API_URL`.

Fly.io:

```bash
fly auth login
fly apps create popcorn-circle
fly volumes create circles --region iad --size 1
fly secrets set ADMIN_TOKEN=your-token
fly deploy
```

`fly.toml` mounts that volume at `/data` and checks `/health`.

Docker locally:

```bash
docker build -t popcorn-circle .
docker run --rm -p 43124:43124 -e ADMIN_TOKEN=dev-token -v popcorn-data:/data popcorn-circle
```

### Support

The support address is popcorncircleapp@gmail.com. About, the public landing page, and the privacy policy link to that inbox. `EXPO_PUBLIC_SUPPORT_EMAIL` defaults to it. Set the variable only if support should go somewhere else.

### Still to set before release

- `EXPO_PUBLIC_TMDB_API_KEY`: optional. Without it, search uses the films bundled in the app. With it, search uses TMDB for titles, posters, and overviews. See the TMDB section below.
- `EXPO_PUBLIC_GROUP_API_URL`: the deployed group server, after the steps above.

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
- Ratings persist in AsyncStorage on that device. The storage key is still `aftercredits.ratings.v1`, so a log saved under the old name is still there.
- Open **Group** to start or join with a code, then see friends’ stars and notes. The personal log still works with no group.

## Tests

```bash
npm test
```

The tests cover the rating rules, the on-device repository, shelf search, the TMDB fallback, and group membership. They do not need a key or a device. The group tests start a temporary server on a random port.

## Project layout

- `app/` — Search, My Ratings, Group, and the movie screen (Expo Router)
- `lib/ratings.ts` — validation, sorting, and the on-device repository
- `lib/groups.ts` — join codes, membership, and shared ratings
- `server/` — the local group server (`npm run circle`)
- `lib/sample-movies.ts` — the offline shelf
- `lib/tmdb.ts` — optional live search
