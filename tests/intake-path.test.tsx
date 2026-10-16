/**
 * @vitest-environment jsdom
 *
 * These tests drive the file input and the drop handlers. A parser unit test
 * cannot see the old path that decoded the file to text and built a new File.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '@/components/App';
import { I18nProvider } from '@/i18n/provider';

const BASE = 'Handle,Title\ntee,Shirt\n';

function fileFrom(name: string, bytes: Uint8Array, type: string): File {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const file = new File([copy], name, { type });
  file.arrayBuffer = () => Promise.resolve(copy.buffer);
  return file;
}

function csv(name: string, body: string): File {
  return fileFrom(name, new TextEncoder().encode(body), 'text/csv');
}

function utf16(name: string, body: string, endian: 'le' | 'be'): File {
  const bytes: number[] = endian === 'le' ? [0xff, 0xfe] : [0xfe, 0xff];
  for (let i = 0; i < body.length; i++) {
    const c = body.charCodeAt(i);
    if (endian === 'le') bytes.push(c & 0xff, c >> 8);
    else bytes.push(c >> 8, c & 0xff);
  }
  return fileFrom(name, new Uint8Array(bytes), 'text/csv');
}

function fileList(files: File[]): FileList {
  const list = {
    length: files.length,
    item: (i: number) => files[i] ?? null,
    [Symbol.iterator]: function* () {
      yield* files;
    },
  } as FileList;
  files.forEach((file, i) => {
    (list as unknown as Record<number, File>)[i] = file;
  });
  return list;
}

function withSize(file: File, size: number): File {
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  window.localStorage.clear();
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  host.remove();
});

async function renderApp() {
  await act(async () => {
    root.render(
      <I18nProvider>
        <App />
      </I18nProvider>,
    );
  });
}

function slotInput(slot: 'baseline.csv' | 'proposed.csv'): HTMLInputElement {
  const el = [...host.querySelectorAll('input[type="file"]')].find((node) =>
    node.getAttribute('aria-label')?.includes(slot),
  );
  if (!(el instanceof HTMLInputElement)) throw new Error(`missing input for ${slot}`);
  return el;
}

function dropTarget(slot: 'baseline.csv' | 'proposed.csv'): HTMLButtonElement {
  const input = slotInput(slot);
  const button = input.previousElementSibling;
  if (!(button instanceof HTMLButtonElement)) throw new Error(`missing drop target for ${slot}`);
  return button;
}

async function choose(slot: 'baseline.csv' | 'proposed.csv', file: File) {
  const el = slotInput(slot);
  Object.defineProperty(el, 'files', { configurable: true, value: fileList([file]) });
  await act(async () => {
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function drop(target: Element, files: File[]) {
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { files: fileList(files) } });
  await act(async () => {
    target.dispatchEvent(event);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function text(): string {
  return host.textContent ?? '';
}

describe('file input keeps the original bytes', () => {
  it('decodes a UTF-16LE file chosen from the file input', async () => {
    await renderApp();
    await choose('baseline.csv', csv('baseline.csv', BASE));
    await choose('proposed.csv', utf16('proposed.csv', 'Handle,Title\ntee,衬衫\n', 'le'));
    expect(text()).toContain('file is UTF-16, not UTF-8');
    expect(text()).not.toContain('file looks mis-encoded');
  });

  it('decodes a UTF-16BE file and still reports a UTF-8 BOM', async () => {
    await renderApp();
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(BASE)]);
    await choose('baseline.csv', fileFrom('baseline.csv', bom, 'text/csv'));
    await choose('proposed.csv', utf16('proposed.csv', BASE, 'be'));
    expect(text()).toContain('UTF-8 BOM stripped');
    expect(text()).toContain('file is UTF-16, not UTF-8');
  });
});

describe('drop targets do not leak into the other slot or past the size cap', () => {
  it('does not replace the baseline when a file is dropped on proposed', async () => {
    await renderApp();
    await choose('baseline.csv', csv('baseline.csv', BASE));
    await drop(dropTarget('proposed.csv'), [csv('proposed.csv', 'Handle,Title\ntee,Edited\n')]);
    expect(text()).toContain('baseline.csv');
    expect(text()).toContain('proposed.csv');
    expect(text()).toContain('1 → 1 products');
  });

  it('assigns two files dropped on the page, first to baseline and second to proposed', async () => {
    await renderApp();
    const page = host.firstElementChild;
    if (!page) throw new Error('missing page');
    await drop(page, [csv('left.csv', BASE), csv('right.csv', 'Handle,Title\ntee,Edited\n')]);
    expect(text()).toContain('left.csv');
    expect(text()).toContain('right.csv');
  });

  it('replaces a slot with the later file', async () => {
    await renderApp();
    await choose('baseline.csv', csv('first.csv', BASE));
    await choose('proposed.csv', csv('proposed.csv', BASE));
    await choose('baseline.csv', csv('second.csv', 'Handle,Title\ntee,Edited\n'));
    expect(text()).toContain('second.csv');
    expect(text()).not.toContain('first.csv');
  });

  it('refuses a non-csv drop on a slot and a file past 60 MB on the page', async () => {
    await renderApp();
    await drop(dropTarget('proposed.csv'), [fileFrom('notes.txt', new TextEncoder().encode('hello'), 'text/plain')]);
    expect(text()).toContain('Only .csv files can be checked');
    expect(text()).not.toContain('notes.txt');

    const page = host.firstElementChild;
    if (!page) throw new Error('missing page');
    await drop(page, [withSize(csv('huge.csv', 'Handle,Title\n'), 61 * 1024 * 1024)]);
    expect(text()).toContain('larger than 60 MB');
    expect(text()).not.toContain('huge.csv');
  });
});

describe('a slower read cannot come back after a newer action', () => {
  it('keeps the later file when the earlier read resolves last', async () => {
    await renderApp();
    const slow = csv('slow.csv', 'Handle,Title\nslow,Slow\n');
    const read = slow.arrayBuffer.bind(slow);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    slow.arrayBuffer = () => gate.then(() => read());

    await choose('baseline.csv', slow);
    await choose('baseline.csv', csv('fast.csv', BASE));
    await choose('proposed.csv', csv('proposed.csv', BASE));
    expect(text()).toContain('fast.csv');

    await act(async () => {
      release();
      await gate;
      await Promise.resolve();
    });
    expect(text()).toContain('fast.csv');
    expect(text()).not.toContain('slow.csv');
    expect(text()).not.toContain('Slow');
  });

  it('does not restore a file that finished reading after Clear', async () => {
    await renderApp();
    await choose('baseline.csv', csv('baseline.csv', BASE));
    await choose('proposed.csv', csv('proposed.csv', BASE));

    const slow = csv('slow.csv', 'Handle,Title\nslow,Slow\n');
    const read = slow.arrayBuffer.bind(slow);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    slow.arrayBuffer = () => gate.then(() => read());

    await choose('baseline.csv', slow);
    const clear = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Clear');
    if (!clear) throw new Error('missing clear');
    await act(async () => {
      clear.click();
    });
    await act(async () => {
      release();
      await gate;
      await Promise.resolve();
    });
    expect(text()).not.toContain('slow.csv');
    expect(text()).toContain('Load both files');
  });

  it('shows an error when the file cannot be read and does not keep a stale success', async () => {
    await renderApp();
    await choose('baseline.csv', csv('baseline.csv', BASE));
    const broken = csv('broken.csv', BASE);
    broken.arrayBuffer = () => Promise.reject(new Error('read failed'));
    await choose('proposed.csv', broken);
    expect(text()).toContain('Could not read this file');
    expect(text()).not.toContain('broken.csv');
  });
});
