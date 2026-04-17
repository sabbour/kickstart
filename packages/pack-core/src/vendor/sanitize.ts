import DOMPurify from 'dompurify';

/**
 * Sanitize HTML to prevent XSS. Only allows safe formatting tags.
 * Use this for ALL `dangerouslySetInnerHTML` usage.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li',
      'code', 'pre', 'span', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote', 'hr',
      'sup', 'sub', 'mark', 'del', 'ins', 'abbr',
    ],
    ALLOWED_ATTR: ['class', 'href', 'target', 'rel', 'title'],
    ALLOW_DATA_ATTR: false,
  });
}
