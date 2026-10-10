# Layover Marks

A browsable virtual playground of ten famous Indian places (plus TinkerSpace
Calicut), built for a hackathon. How it works:

- **A virtual world on a phone** — no backend, no accounts, nothing to install.
- **Real-world scale** — 1 unit = 1 metre; monuments are built at roughly their
  true dimensions and every place sits at its true latitude/longitude, so the
  distances between places are their real-world distances.
- **Carving-ready zoom** — you can fly right up to a surface and zoom in close
  enough to read (and later carve) letters only a few centimetres tall.

## Quick start

```bash
npm install
npm run dev
```

Open the printed URL (e.g. http://localhost:5173). The app runs from memory —
no accounts or database are needed.

## What you should see

1. The app opens into an **all-land open world**: procedurally generated green
   landscape (light meadow low down, darker green and rocky ground on the
   peaks) under a sky with distance fog. **There is no water anywhere.** The
   terrain is **endless** — it streams in chunks around the camera as you move.
2. The camera starts at the **Taj Mahal** and you move through the world in
   first person, fast enough to cover kilometres of ground:
   - drag (mouse or one finger) to look around,
   - **W A S D / arrow keys** (or the on-screen joystick on touch) to move,
   - **Shift** to sprint, **scroll / pinch** to zoom in and out briskly — far
     enough to dive down to centimetre-sized detail (FOV to 1.2°, or ~15 cm at
     arm's reach),
   - the camera is kept above the ground so you travel along the surface.
3. **Scroll the map** — the **🗺 Map** button opens a pannable, zoomable
   top-down map of the whole world. Drag to scroll across it, scroll/pinch to
   zoom, and tap a marker to fly straight to that monument. A "Fit all" button
   frames every place, and a green dot shows where you are. This is how you
   explore and discover the places instead of only using the dropdown.
4. **Fast travel** — a "Travel to" dropdown at the top also teleports you
   between any of the places (they are up to ~1,500 km apart, so flying between
   them by hand is not practical).
5. Ten places have their own hand-built model at real metre scale:
   - **Taj Mahal** (≈ 73 m: plinth, iwans, onion dome, chhatris, ~40 m minarets),
   - **Qutub Minar** (≈ 72.5 m: five tapering fluted storeys and balconies),
   - **Charminar** (~56 m with four ~48.7 m corner minarets),
   - **Konark Sun Temple** (~39 m tower with twelve stone wheels per side and horses),
   - **Gateway of India** (~26 m basalt arch memorial),
   - **Amber Fort** (~100 × 60 m walled plateau with ramparts, bastions, palace),
   - **Hampi** (~50 m gopuram + the ~5 m Stone Chariot),
   - **Rohtang Pass** (snow ridges flanking the pass, with the mountain road),
   - **Kanchenjunga** (a great snow massif ridge line),
   - **TinkerSpace Calicut** (~7 m makerspace block at IPM, Kozhikode).
   Every place carries a floating name label; there are no more generic
   stones.
5. **Tap a landmark** to open it in the single-place viewer (orbit/zoom around
   the monument). A drag is ignored, so travelling never accidentally opens one.
6. **Write your name on the monument** — a "✍ Write name" pad at the bottom of
   the single-place view. On save the camera **glides in to the name** so it is
   immediately in front of you. The name is engraved (dark serif lettering with
   a light catch-edge) onto a band on **all four walls** of the monument, partway
   up (not on the foundation) — 1.2 to 6 m wide depending on the place — so the
   letters stay small but read clearly as you zoom. It stays crisp because the
   name texture is high-resolution and heavily anisotropic. Written names are
   **saved to the database** (Supabase, or a local IndexedDB store by default)
   and **shown on the monument in the open world**, so your mark survives a
   reload and you can fly past to see it. Writing is **only unlocked when you are
   physically at the place** (see "Location & the carving rule").
7. A **‹ World** button returns to the world and fully disposes the scene.
8. A **"Simulate location"** demo toggle that treats you as standing at the
   place you are viewing, so carving can be demonstrated without real GPS.

## Scale model

- **1 world unit = 1 metre.**
- `latLngToWorld` (in `src/lib/geo.ts`) projects each place's real coordinates
  to metre positions relative to `WORLD_ORIGIN` (≈ central India) using an
  equirectangular projection. Distances between places are therefore their true
  great-circle-ish distances.
- Because places span up to ~1,500 km, all world geometry lives under one
  `contentRoot` group whose position is set to the negative of the viewer every
  frame (**floating origin**). This keeps GPU float precision at a few
  centimetres no matter how far from the origin the viewer is — essential for
  carving real-size names.
- The renderer uses a **logarithmic depth buffer** with a 5 cm near plane and a
  20 km far plane, and the free-fly camera can pinch-zoom to a 1.2° FOV — enough
  to frame a few-centimetre-tall signature on a wall. In the single-place
  viewer the orbit can zoom to 15 cm from a surface.
- Monuments carry **true metre heights**; the three mountain/nature spots are
  modelled as **stylised relief** (e.g. the Kanchenjunga snow massif rises
  ~1,150 m) standing on broad highland anchors, rather than at their absolute
  elevations (Kanchenjunga is 8,586 m above sea level).

## Project structure

```
src/
  main.ts                    app entry, screen switching (world <-> single place)
  lib/geo.ts                 haversine + latLngToWorld (metre-accurate projection)
  data/places.ts             Place interface, WORLD_ORIGIN, 10 Indian places
  world/SceneView.ts         shared renderer/scene/camera/lights/fog/dispose base
  world/FreeFlyControls.ts   first-person look + move + zoom + logical position
  world/terrain.ts           InfiniteTerrain: chunked all-land terrain streaming
  world/stone.ts             procedural stone from a seed (simplex-noise)
  world/models/parts.ts      shared model parts (onion dome, arch, chhatri)
  world/models/TajMahal.ts   the ~73 m architectural Taj Mahal model
  world/models/QutubMinar.ts the ~72.5 m minaret
  world/models/Charminar.ts  Hyderabad's ~56 m four-minaret mosque
  world/models/KonarkSunTemple.ts  Konark chariot temple (~39 m + 24 wheels)
  world/models/GatewayOfIndia.ts   the ~26 m basalt arch
  world/models/AmberFort.ts  Amber Fort (ramparts, palace, bastions, chhatris)
  world/models/Hampi.ts      Hampi (gopuram, stone chariot, boulders)
  world/models/RohtangPass.ts      snow pass with the mountain road
  world/models/Kanchenjunga.ts     the great snow massif
  world/models/index.ts      landmark model registry (id -> builder)
  world/NamePlaque.ts        write-your-name on all four walls (high-res engraving)
  db/nameBackend.ts          storage backends: Supabase (REST) + IndexedDB
  db/names.ts                in-memory name cache + load/persist helpers
  world/WorldScene.ts        createWorld: contentRoot + real-positioned landmarks
  world/WorldViewer.ts       open-world view: free-fly + floating origin + travel
  world/SceneFactory.ts      SceneFactory.create(place) -> { scene, stoneMesh }
  world/PlaceViewer.ts       single-place view (OrbitControls; model or stone)
  ui/Joystick.ts             on-screen analogue stick for touch movement
  ui/styles.css              mobile-first dark theme
```

## Interfaces meant to be extended

- `createWorld(scene, places): World` — assembles terrain + landmarks under
  `contentRoot` and returns `heightAt(x,z)`, `update(viewerPosition)` (chunk
  streaming) and `dispose()`. Tune `WORLD_SEED` and `ANCHOR_SHAPES` to reshape
  the landscape and the hills under each monument.
- `FreeFlyControls` — `setMoveInput(x, y)` drives movement; `.position` holds
  the true-world viewer position (metres); `setPosition`/`lookAt` power
  fast-travel; `getGroundHeight` keeps the camera on the surface.
- `WorldViewer.travelTo(placeId)` — fast-travel hook the top bar uses.
- `latLngToWorld(latitude, longitude, origin)` — the real-coordinate projection.
- `getLandmarkModel(placeId)` (in `models/index.ts`) — the model registry. All
  current places have a hand-built model; new places get one entry here.
- `PlaceViewer.writeName(name)` + `db/names` (`signedNames`, `persistName`,
  `loadNames`) — writing and storing names. Names are saved to Supabase when
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` are set, otherwise to a
  local IndexedDB database.
- `Place` (in `data/places.ts`) — the shape the database will later fill; all
  coordinates carry a `// TODO verify` note.

## Location & the carving rule

You can only carve on a monument you are actually standing at. The app watches
the device's GPS position (`src/lib/location.ts`, wrapping the browser
Geolocation API) and compares it to each place's real coordinates: writing is
unlocked only when you are within the place's `radiusM` (haversine distance, see
`isWithinRadius` in `src/lib/geo.ts`). So only people at the Taj Mahal can write
on the Taj Mahal, and likewise for every other place.

- The name pad shows why writing is locked ("You're 420 m from Taj Mahal…").
- Browsers only expose geolocation on a secure origin (**HTTPS or `localhost`**).
  On a plain-HTTP address it is unavailable — use the **Simulate location**
  toggle to demo carving anyway (it treats you as standing at the open place).

## Storing names (database)

Written names are saved so they survive a reload and show up on the monument in
the world.

- **Default (no setup): a local IndexedDB database.** Names persist on the
  device across reloads with no configuration.
- **Shared database (Supabase).** Copy `.env.example` to `.env.local` and set
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Then run this in the
  Supabase **SQL Editor** to create the table:

  ```sql
  create table carvings (
    id bigint generated by default as identity primary key,
    place_id text not null,
    name text not null,
    created_at timestamptz not null default now()
  );
  create index carvings_place_id_idx on carvings (place_id);
  -- Demo-friendly access (tighten this for production):
  alter table carvings enable row level security;
  create policy "public read"   on carvings for select using (true);
  create policy "public insert" on carvings for insert with check (true);
  ```

  Every name written becomes its own row, so a place keeps all of its names and
  they stack up the wall in the order they were added.

  The client talks to Supabase's REST (PostgREST) endpoint with plain `fetch`,
  so no SDK dependency is added.

## Known limitations (on purpose, for now)

- The world is "endless" by streaming a repeating noise field; it is not a real
  map with real geography — only the landmark positions are real.
- Landmarks sit on stylised procedural hills, not their true elevations.
- Monument dimensions are faithful but approximate (the real Amber Fort is
  far larger than the modelled central palace complex).
- Place coordinates are approximate placeholders.
- Names are stored per place and all of them are kept, stacked up the wall; carving
  a separate mark exactly beside someone else's is not implemented.
- The "Simulate location" toggle does nothing yet.
- GPS verification is not implemented.
- GPS can be spoofed in general; real-world checks are a later concern.