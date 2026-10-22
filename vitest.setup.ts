import { afterEach } from 'vitest';

// Solo en pruebas con DOM (jsdom); las del motor corren en node y no lo necesitan.
if (typeof window !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  await import('@testing-library/jest-dom/vitest');

  afterEach(() => cleanup());

  // jsdom no implementa <dialog>.showModal()/close()
  const proto = window.HTMLDialogElement.prototype;
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };

  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
        onchange: null,
      }) as MediaQueryList;
  }
}
