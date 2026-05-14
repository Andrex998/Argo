/**
 * splitText — utility per dividere un elemento di testo in parole wrappate in span.
 * Sostituisce SplitText premium di GSAP con un'implementazione gratuita.
 */

export function splitTextIntoWords(element: HTMLElement | null): HTMLSpanElement[] {
  if (!element) return [];

  const wordSpans: HTMLSpanElement[] = [];

  const processNode = (node: Node, parent: HTMLElement): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (!text.trim()) return;

      const parts = text.split(/(\s+)/);
      const fragment = document.createDocumentFragment();

      parts.forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          fragment.appendChild(document.createTextNode(part));
        } else {
          const span = document.createElement('span');
          span.setAttribute('data-word', '');
          span.style.display = 'inline-block';
          span.style.willChange = 'transform, opacity, filter';
          span.textContent = part;
          fragment.appendChild(span);
          wordSpans.push(span);
        }
      });

      parent.replaceChild(fragment, node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName === 'BR') return;
      const childNodes = Array.from(el.childNodes);
      childNodes.forEach((child) => processNode(child, el));
    }
  };

  const initialChildren = Array.from(element.childNodes);
  initialChildren.forEach((child) => processNode(child, element));

  return wordSpans;
}
