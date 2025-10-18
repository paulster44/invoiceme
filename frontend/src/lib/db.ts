import { openDB } from 'idb';

const DB_NAME = 'barebones-invoice';
const DB_VERSION = 1;

export const getDb = () =>
  openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache');
      }
    }
  });

export const saveDraft = async (draft: any) => {
  const db = await getDb();
  await db.put('drafts', draft);
};

export const loadDrafts = async () => {
  const db = await getDb();
  return db.getAll('drafts');
};

export const removeDraft = async (id: string) => {
  const db = await getDb();
  await db.delete('drafts', id);
};

export const cacheSet = async (key: string, value: any) => {
  const db = await getDb();
  await db.put('cache', value, key);
};

export const cacheGet = async <T>(key: string): Promise<T | null> => {
  const db = await getDb();
  const value = await db.get('cache', key);
  return (value as T) ?? null;
};

