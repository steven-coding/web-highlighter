export interface Annotation {
  id: string;
  url: string;
  pageTitle: string;
  quote: string;
  prefix: string;
  suffix: string;
  textPosition?: { start: number; end: number };
  note: string;
  tags: string[];
  color: string;
  createdAt: string;
  updatedAt: string;
}

export type MsgPayloads = {
  'annotation/create': [Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>, Annotation];
  'annotation/update': [{ id: string; note: string }, Annotation];
  'annotation/delete': [{ id: string }, { ok: true }];
  'annotation/listByUrl': [{ url: string }, Annotation[]];
  'export/markdown': [{ url: string }, { filename: string; markdown: string }];
};

export type MsgType = keyof MsgPayloads;

export interface ExtMsg<T extends MsgType = MsgType> {
  type: T;
  payload: MsgPayloads[T][0];
}
