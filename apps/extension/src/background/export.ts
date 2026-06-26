import { listAnnotationsByUrl } from './db.js';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .slice(0, 60);
}

export async function exportMarkdown(
  url: string,
): Promise<{ filename: string; markdown: string }> {
  const annotations = await listAnnotationsByUrl(url);

  const date = new Date().toISOString().slice(0, 10);
  const title = annotations[0]?.pageTitle ?? url;
  const filename = `${slugify(title)}-${date}.md`;

  const frontmatter = `---\nurl: ${url}\ntitle: ${title}\ndate: ${date}\ntags: []\n---`;

  if (annotations.length === 0) {
    return { filename, markdown: frontmatter };
  }

  const blocks = annotations.map((a) => {
    const quote = `> ${a.quote.replace(/\n/g, '\n> ')}`;
    return a.note.trim() ? `${quote}\n\n${a.note.trim()}` : quote;
  });

  return { filename, markdown: `${frontmatter}\n\n${blocks.join('\n\n---\n\n')}` };
}
