import { marked } from 'marked';

marked.setOptions({
  breaks: true,
  gfm: true,
});

export async function markdownToHtml(content: string): Promise<string> {
  return await marked(content);
}

export function markdownToHtmlSync(content: string): string {
  return marked.parse(content) as string;
}
