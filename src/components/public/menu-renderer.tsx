import DOMPurify from 'isomorphic-dompurify';
import { markdownToHtmlSync } from '@/lib/markdown';

interface Props {
  content: string;
}

export function MenuRenderer({ content }: Props) {
  const html = markdownToHtmlSync(content);
  const safe = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'h1','h2','h3','h4','h5','h6',
      'p','br','strong','em','del','code','pre',
      'ul','ol','li',
      'table','thead','tbody','tr','th','td',
      'img','a','blockquote','hr',
    ],
    ALLOWED_ATTR: ['src','alt','href','title','class'],
    ALLOW_DATA_ATTR: false,
  });

  return (
    <div
      className="prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
