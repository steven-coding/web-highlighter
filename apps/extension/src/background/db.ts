import Dexie, { type Table } from 'dexie';
import type { Annotation } from '@highlighter/core';

class HighlighterDB extends Dexie {
  annotations!: Table<Annotation, string>;

  constructor() {
    super('web-highlighter');
    this.version(1).stores({
      annotations: 'id, url, createdAt',
    });
  }
}

const db = new HighlighterDB();

export async function createAnnotation(
  data: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Annotation> {
  const now = new Date().toISOString();
  const annotation: Annotation = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  await db.annotations.add(annotation);
  return annotation;
}

export async function updateAnnotation(id: string, note: string): Promise<Annotation> {
  await db.annotations.update(id, { note, updatedAt: new Date().toISOString() });
  const annotation = await db.annotations.get(id);
  if (!annotation) throw new Error(`Annotation ${id} not found`);
  return annotation;
}

export async function deleteAnnotation(id: string): Promise<void> {
  await db.annotations.delete(id);
}

export async function listAnnotationsByUrl(url: string): Promise<Annotation[]> {
  return db.annotations.where('url').equals(url).sortBy('createdAt');
}
