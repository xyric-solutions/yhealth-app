/**
 * HTML sanitization utility using DOMPurify.
 * Use this for ALL dangerouslySetInnerHTML rendering of user/API content.
 */
import DOMPurify from 'dompurify';

/**
 * Sanitize HTML string to prevent XSS.
 * Allows safe HTML tags (formatting, links, images) but strips scripts, event handlers, etc.
 */
export function sanitizeHtml(dirty: string): string {
  if (typeof window === 'undefined') {
    // Server-side: strip all HTML tags as a safe fallback
    return dirty.replace(/<[^>]*>/g, '');
  }
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
      'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
      'a', 'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins', 'mark', 'sub', 'sup',
      'img', 'figure', 'figcaption', 'video', 'source',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
      'div', 'span', 'section', 'article', 'header', 'footer',
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'src', 'alt', 'title', 'width', 'height',
      'class', 'id', 'style', 'type', 'controls', 'autoplay', 'loop', 'muted',
      'colspan', 'rowspan', 'scope',
    ],
    ADD_ATTR: ['target'], // Allow target on links
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
  });
}

/**
 * Create a safe props object for dangerouslySetInnerHTML.
 * Usage: <div {...safeInnerHTML(content)} />
 */
export function safeInnerHTML(dirty: string): { dangerouslySetInnerHTML: { __html: string } } {
  return { dangerouslySetInnerHTML: { __html: sanitizeHtml(dirty) } };
}
