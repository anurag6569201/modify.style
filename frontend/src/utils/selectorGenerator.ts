/**
 * Generates a unique CSS selector for an element
 */
export function generateSelector(element: Element): string {
  if (!element || !element.ownerDocument) {
    return '';
  }

  // If element has an ID, use it
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  // Build path from element to root
  const path: string[] = [];
  let current: Element | null = element;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let selector = current.tagName.toLowerCase();

    // Add class names if they exist
    if (current.classList.length > 0) {
      const classes = Array.from(current.classList)
        .filter(cls => !cls.startsWith('__inspector'))
        .map(cls => `.${CSS.escape(cls)}`)
        .join('');
      selector += classes;
    }

    // Add nth-child if needed for uniqueness
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        child => child.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);

    // If we have an ID in the path, we can stop
    if (current.id) {
      break;
    }

    current = current.parentElement;
  }

  return path.join(' > ');
}

/**
 * Generates a simple selector (tag, id, or class)
 */
export function generateSimpleSelector(element: Element): string {
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  if (element.classList.length > 0) {
    const firstClass = Array.from(element.classList).find(
      cls => !cls.startsWith('__inspector')
    );
    if (firstClass) {
      return `.${CSS.escape(firstClass)}`;
    }
  }

  return element.tagName.toLowerCase();
}
