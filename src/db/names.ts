import { createNameBackend, type NameBackend } from './nameBackend';

/**
 * The in-memory name cache, keyed by place id. Each place keeps a list of names
 * in the order they were written.
 *
 * The 3D world renders synchronously from this Map, while the database backend
 * (Supabase or IndexedDB) is the source of truth across reloads and devices.
 * Call `loadNames()` once at boot before the world is built.
 */
export const signedNames = new Map<string, string[]>();

let backend: NameBackend | null = null;

function getBackend(): NameBackend {
  if (!backend) {
    backend = createNameBackend();
  }
  return backend;
}

/** Load every stored name into `signedNames`, replacing what was there. */
export async function loadNames(): Promise<void> {
  try {
    const rows = await getBackend().loadAll();
    signedNames.clear();
    for (const row of rows) {
      if (!row.name) continue;
      const list = signedNames.get(row.placeId);
      if (list) {
        list.push(row.name);
      } else {
        signedNames.set(row.placeId, [row.name]);
      }
    }
  } catch (error) {
    console.warn('Could not load saved names:', error);
  }
}

/**
 * Append a name for a place. Updates the in-memory cache immediately so the UI
 * reflects the change at once; the write is fire-and-forget and never blocks
 * rendering. Existing names are never replaced.
 */
export function persistName(placeId: string, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;

  const list = signedNames.get(placeId);
  if (list) {
    list.push(trimmed);
  } else {
    signedNames.set(placeId, [trimmed]);
  }

  void getBackend()
    .add(placeId, trimmed)
    .catch((error) => {
      console.warn('Could not save name:', error);
    });
}
