import './ui/styles.css';
import { PLACES, type Place } from './data/places';
import { loadNames } from './db/names';
import { haversine } from './lib/geo';
import { LocationService } from './lib/location';
import { Joystick } from './ui/Joystick';
import { WorldMap } from './ui/WorldMap';
import type { SceneView } from './world/SceneView';
import { PlaceViewer } from './world/PlaceViewer';
import { WorldViewer } from './world/WorldViewer';

/**
 * App entry point.
 *
 * Two screens live here:
 *   1. WorldViewer — the endless world containing all ten places.
 *   2. PlaceViewer — a single monument, opened by tapping its landmark.
 *
 * Switching screens always goes through `clearApp()`, which disposes the
 * active view so no Three.js resources leak between visits.
 */

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Missing #app root element in index.html');
}
const root: HTMLDivElement = app;

/** The currently mounted view, or null while switching. */
let activeView: SceneView | null = null;

/** Cleanup callbacks (event subscriptions) for the mounted screen. */
let activeUnsubscribers: Array<() => void> = [];

/** Tear down the active screen and empty the root. */
function clearApp(): void {
  for (const unsubscribe of activeUnsubscribers) unsubscribe();
  activeUnsubscribers = [];
  activeView?.dispose();
  activeView = null;
  root.replaceChildren();
}

/**
 * Live device location. Carving is unlocked only when the visitor is physically
 * within a place's radius (see `carveAccess`).
 */
const location = new LocationService();

/** Demo override: when on, the visitor is treated as standing at the open place. */
let simulateLocation = false;

/** Listeners notified when the simulate toggle flips. */
const gateListeners = new Set<() => void>();

/** Subscribe to simulate-toggle changes. Returns an unsubscribe function. */
function onGateChange(listener: () => void): () => void {
  gateListeners.add(listener);
  return () => {
    gateListeners.delete(listener);
  };
}

/** Turn the demo location simulation on or off, notifying the UI. */
function setSimulateLocation(value: boolean): void {
  simulateLocation = value;
  for (const listener of gateListeners) listener();
}

/** Whether the visitor may carve here, plus a human-readable explanation. */
interface CarveAccess {
  allowed: boolean;
  message: string;
}

/** Format a distance in metres as metres or kilometres. */
function formatDistance(metres: number): string {
  return metres < 1000
    ? `${Math.round(metres)} m`
    : `${(metres / 1000).toFixed(1)} km`;
}

/**
 * The carving rule: a visitor can only write on a monument they are standing
 * at — their live GPS position must fall within the place's radius. The demo
 * "Simulate location" toggle bypasses this so the app can be shown on a laptop.
 */
function carveAccess(place: Place): CarveAccess {
  if (simulateLocation) {
    return { allowed: true, message: 'Simulated location — you can write here.' };
  }

  const fix = location.fix;
  if (!fix) {
    switch (location.status) {
      case 'locating':
        return { allowed: false, message: 'Finding your location…' };
      case 'denied':
        return {
          allowed: false,
          message: 'Location permission denied — allow it to write here.',
        };
      case 'unavailable':
        return {
          allowed: false,
          message: 'Location unavailable on this device.',
        };
      default:
        return { allowed: false, message: 'Waiting for a GPS fix…' };
    }
  }

  const distance = haversine(
    fix.latitude,
    fix.longitude,
    place.latitude,
    place.longitude,
  );

  if (distance <= place.radiusM) {
    return { allowed: true, message: `You're at ${place.name} — write away.` };
  }
  return {
    allowed: false,
    message: `You're ${formatDistance(distance)} from ${place.name}. Only people there can write here.`,
  };
}

/** Show the endless world with all places. */
function showWorld(): void {
  clearApp();

  const screen = document.createElement('div');
  screen.className = 'world-screen';

  const stage = document.createElement('div');
  stage.className = 'stage';
  screen.append(stage);

  const overlay = document.createElement('div');
  overlay.className = 'world-overlay';

  const hint = document.createElement('p');
  hint.className = 'world-hint';
  hint.textContent =
    'Drag to look · WASD / joystick to move · scroll / pinch to zoom in close · 🗺 Map to explore · tap a landmark';

  overlay.append(hint, createSimulateToggle());
  screen.append(overlay);

  // Wired up once the viewer exists (declared first so the closures can see it).
  let viewer: WorldViewer | null = null;

  // Fast travel between the places, which are up to ~1,500 km apart.
  const topbar = document.createElement('div');
  topbar.className = 'world-topbar';

  const mapButton = document.createElement('button');
  mapButton.type = 'button';
  mapButton.className = 'btn world-map-open';
  mapButton.textContent = '🗺 Map';

  topbar.append(mapButton, createTravelMenu((id) => viewer?.travelTo(id)));
  screen.append(topbar);

  // On-screen stick for touch movement.
  const joystick = new Joystick((x, y) => viewer?.setMoveInput(x, y));
  screen.append(joystick.element);

  root.append(screen);

  viewer = new WorldViewer(stage, PLACES, openPlace);
  activeView = viewer;
  viewer.mount();

  // Scrollable map overlay: pan/zoom the whole world and tap a marker to fly.
  const map = new WorldMap({
    places: PLACES,
    getPosition: () => viewer?.getPosition() ?? null,
    onPick: (id) => viewer?.travelTo(id),
  });
  mapButton.addEventListener('click', () => map.show());
  activeUnsubscribers.push(() => map.dispose());
  screen.append(map.element);
}

/** A dropdown listing every place, used to fast-travel across the world. */
function createTravelMenu(onPick: (placeId: string) => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'travel';

  const label = document.createElement('label');
  label.className = 'travel__label';
  label.textContent = 'Travel to';

  const select = document.createElement('select');
  select.className = 'travel__select';
  for (const place of PLACES) {
    const option = document.createElement('option');
    option.value = place.id;
    option.textContent = place.name;
    select.append(option);
  }
  select.value = PLACES[0].id;
  select.addEventListener('change', () => onPick(select.value));

  label.append(select);
  wrap.append(label);
  return wrap;
}

/** Open a single place (tap handler for the world). */
function openPlace(place: Place): void {
  clearApp();

  const screen = document.createElement('div');
  screen.className = 'viewer-screen';

  screen.append(createDetailToolbar(place), createSimulateToggle());

  const stage = document.createElement('div');
  stage.className = 'stage';
  screen.append(stage);
  root.append(screen);

  activeView = new PlaceViewer(stage, place);
  screen.append(
    createNamePad(place, (name) => (activeView as PlaceViewer).writeName(name)),
  );
  activeView.mount();
}

/** Top bar for the single-place view: a Back button plus the place name. */
function createDetailToolbar(place: Place): HTMLElement {
  const toolbar = document.createElement('header');
  toolbar.className = 'viewer-toolbar';

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'btn btn-back';
  back.textContent = '‹ World';
  back.addEventListener('click', showWorld);

  const title = document.createElement('span');
  title.className = 'viewer-title';
  title.textContent = place.name;

  toolbar.append(back, title);
  return toolbar;
}

/**
 * The "Write your name" pad for the single-place view. Expands to a text input;
 * submitting adds the name small on the monument's surface (read it clearly by
 * zooming in). Writing is only unlocked when the visitor is physically at the
 * place (their GPS fix is within its radius), or when the demo toggle is on.
 */
function createNamePad(
  place: Place,
  onSubmit: (name: string) => void,
): HTMLElement {
  const pad = document.createElement('div');
  pad.className = 'name-pad';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'name-pad__btn';
  button.textContent = '✍ Write name';
  button.addEventListener('click', () => {
    if (!carveAccess(place).allowed) return;
    pad.classList.toggle('name-pad--open');
  });

  const input = document.createElement('input');
  input.className = 'name-pad__input';
  input.type = 'text';
  input.maxLength = 40;
  input.placeholder = `Your name on ${place.name}`;
  input.autocomplete = 'off';

  const submit = document.createElement('button');
  submit.type = 'button';
  submit.className = 'btn btn-primary';
  submit.textContent = 'Write';
  submit.addEventListener('click', confirm);

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => {
    input.value = '';
    pad.classList.remove('name-pad--open');
  });

  const hint = document.createElement('p');
  hint.className = 'name-pad__hint';
  hint.textContent = 'Written small on the monument — zoom in to read it.';

  const status = document.createElement('p');
  status.className = 'name-pad__status';

  function confirm(): void {
    const submitted = input.value.trim();
    if (!submitted) return;
    if (!carveAccess(place).allowed) return;
    onSubmit(submitted);
    input.value = '';
    pad.classList.remove('name-pad--open');
    button.textContent = '✍ Add your name';
  }

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') confirm();
  });

  const row = document.createElement('div');
  row.className = 'name-pad__row';
  row.append(input, submit, cancel);

  // Reflect (and keep reflecting) whether writing is unlocked for this place.
  function refresh(): void {
    const access = carveAccess(place);
    status.textContent = access.message;
    button.classList.toggle('name-pad__btn--locked', !access.allowed);
    submit.disabled = !access.allowed;
    if (!access.allowed) pad.classList.remove('name-pad--open');
  }

  activeUnsubscribers.push(location.onChange(refresh));
  activeUnsubscribers.push(onGateChange(refresh));
  refresh();

  pad.append(button, row, status, hint);
  return pad;
}

/**
 * "Simulate location" toggle — a demo tool. When on, the visitor is treated as
 * standing at the place being viewed, so carving is unlocked even when real GPS
 * is unavailable (e.g. running on a laptop, or over plain HTTP).
 */
function createSimulateToggle(): HTMLElement {
  const wrap = document.createElement('label');
  wrap.className = 'toggle';
  wrap.title = 'Demo tool — pretends you are standing at this place';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.className = 'toggle__input';
  input.name = 'simulate-location';
  input.checked = simulateLocation;
  input.addEventListener('change', () => setSimulateLocation(input.checked));

  const text = document.createElement('span');
  text.className = 'toggle__label';
  text.textContent = 'Simulate location (demo)';

  wrap.append(input, text);

  // Keep every on-screen toggle in sync with the shared state.
  activeUnsubscribers.push(
    onGateChange(() => {
      input.checked = simulateLocation;
    }),
  );
  return wrap;
}

// Load saved names from the database, then boot into the world so they appear
// on the monuments immediately. Location watching starts now so a fix is ready
// by the time the visitor opens a place.
async function boot(): Promise<void> {
  location.start();
  await loadNames();
  showWorld();
}

void boot();
