/**
 * Storage backends for carved names.
 *
 * A place can hold many names, so the store is append-only: every name written
 * becomes its own row and nothing is ever overwritten.
 *
 * Two implementations behind one interface:
 *   - Supabase — a shared remote database, used when `VITE_SUPABASE_URL` and
 *     `VITE_SUPABASE_PUBLISHABLE_KEY` (or the legacy `VITE_SUPABASE_ANON_KEY`)
 *     are set. Talks to Supabase's REST (PostgREST) endpoint with plain `fetch`,
 *     so no extra dependency is needed.
 *   - IndexedDB — a local browser database, used otherwise.
 *
 * Expected Supabase table (see README for the SQL):
 *   carvings(id bigint identity pk, place_id text, name text, created_at timestamptz)
 */
export interface NameRecord {
  placeId: string;
  name: string;
}

export interface NameBackend {
  /** Every stored name, in the order it was written. */
  loadAll(): Promise<NameRecord[]>;
  /** Append a new name for a place (never replaces existing names). */
  add(placeId: string, name: string): Promise<void>;
}

const SUPABASE_TABLE = 'carvings';

/** Shared remote store via Supabase's REST API (no SDK dependency). */
class SupabaseBackend implements NameBackend {
  private readonly endpoint: string;
  private readonly headers: Record<string, string>;

  constructor(url: string, key: string) {
    this.endpoint = `${url.replace(/\/+$/, '')}/rest/v1/${SUPABASE_TABLE}`;
    this.headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    };
  }

  async loadAll(): Promise<NameRecord[]> {
    const response = await fetch(
      `${this.endpoint}?select=place_id,name&order=created_at.asc`,
      { headers: this.headers },
    );
    if (!response.ok) {
      throw new Error(`Supabase load failed: ${response.status}`);
    }
    const rows = (await response.json()) as Array<{
      place_id: string;
      name: string;
    }>;
    return rows.map((row) => ({ placeId: row.place_id, name: row.name }));
  }

  async add(placeId: string, name: string): Promise<void> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { ...this.headers, Prefer: 'return=minimal' },
      body: JSON.stringify([{ place_id: placeId, name }]),
    });
    if (!response.ok) {
      throw new Error(`Supabase save failed: ${response.status}`);
    }
  }
}

/** Local browser database (IndexedDB), used when Supabase isn't configured. */
class IndexedDbBackend implements NameBackend {
  private readonly dbName = 'layover-marks';
  private readonly storeName = 'carvings';
  private dbPromise: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        // Recreate as an append-only store with an auto-increment id.
        if (db.objectStoreNames.contains(this.storeName)) {
          db.deleteObjectStore(this.storeName);
        }
        const store = db.createObjectStore(this.storeName, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('placeId', 'placeId');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.dbPromise;
  }

  private async run<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(this.storeName, mode);
      const request = action(tx.objectStore(this.storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async loadAll(): Promise<NameRecord[]> {
    const rows = await this.run<Array<{ placeId: string; name: string }>>(
      'readonly',
      (store) => store.getAll() as IDBRequest<Array<{ placeId: string; name: string }>>,
    );
    return rows.map((row) => ({ placeId: row.placeId, name: row.name }));
  }

  async add(placeId: string, name: string): Promise<void> {
    await this.run('readwrite', (store) => store.add({ placeId, name }));
  }
}

/** In-memory fallback for environments without IndexedDB (e.g. tests). */
class MemoryBackend implements NameBackend {
  private readonly rows: NameRecord[] = [];

  async loadAll(): Promise<NameRecord[]> {
    return [...this.rows];
  }

  async add(placeId: string, name: string): Promise<void> {
    this.rows.push({ placeId, name });
  }
}

/**
 * Tries `primary` first and silently switches to `secondary` if it ever fails
 * (e.g. Supabase is configured but the table hasn't been created yet). Keeps the
 * app working with local storage instead of losing names.
 */
class FallbackBackend implements NameBackend {
  private active: NameBackend;

  constructor(
    private readonly primary: NameBackend,
    private readonly secondary: NameBackend,
  ) {
    this.active = primary;
  }

  private async attempt<T>(op: (backend: NameBackend) => Promise<T>): Promise<T> {
    try {
      return await op(this.active);
    } catch (error) {
      if (this.active === this.primary) {
        console.warn('Primary name store failed; using local storage:', error);
        this.active = this.secondary;
        return op(this.active);
      }
      throw error;
    }
  }

  loadAll(): Promise<NameRecord[]> {
    return this.attempt((backend) => backend.loadAll());
  }

  add(placeId: string, name: string): Promise<void> {
    return this.attempt((backend) => backend.add(placeId, name));
  }
}

/** Pick the best available backend for this environment. */
export function createNameBackend(): NameBackend {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    import.meta.env.VITE_SUPABASE_ANON_KEY;
  const local =
    typeof indexedDB !== 'undefined'
      ? new IndexedDbBackend()
      : new MemoryBackend();

  if (url && key) {
    return new FallbackBackend(new SupabaseBackend(url, key), local);
  }
  return local;
}