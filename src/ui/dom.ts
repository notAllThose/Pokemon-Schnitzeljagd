/** Sammelt wiederverwendbare, streng typisierte Zugriffe auf App-Elemente. */
export function getElement<T extends HTMLElement = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Element fehlt in index.html: ${selector}`);
  return element;
}

