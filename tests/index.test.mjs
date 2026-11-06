import test from 'node:test';
import assert from 'node:assert/strict';
import { createPdfEditorCore, PdfEditorCoreError } from '../dist/esm/index.js';

const pages = [
  { id: 'a', width: 612, height: 792 },
  { id: 'b', width: 612, height: 792 },
];

test('applies atomic page commands and increments one revision per transaction', () => {
  const editor = createPdfEditorCore(pages);
  const result = editor.apply([
    { type: 'rotate', pageId: 'a', degrees: 90 },
    { type: 'label', pageId: 'b', value: 'iv' },
  ]);
  assert.equal(result.revision, 1);
  assert.deepEqual(
    result.pages.map((page) => page.rotation ?? 0),
    [90, 0],
  );
  assert.equal(result.pages[1].label, 'iv');
});

test('rolls back the full command list when any command is invalid', () => {
  const editor = createPdfEditorCore(pages);
  assert.throws(
    () =>
      editor.apply([
        { type: 'remove', pageId: 'a' },
        { type: 'remove', pageId: 'missing' },
      ]),
    PdfEditorCoreError,
  );
  assert.deepEqual(
    editor.snapshot().pages.map((page) => page.id),
    ['a', 'b'],
  );
  assert.equal(editor.snapshot().revision, 0);
});

test('checks optimistic revision and supports undo/redo snapshots', () => {
  const editor = createPdfEditorCore(pages);
  editor.apply([{ type: 'reorder', pageIds: ['b', 'a'] }], 0);
  assert.throws(() => editor.apply([{ type: 'remove', pageId: 'a' }], 0), {
    code: 'conflict',
  });
  assert.deepEqual(
    editor.undo().pages.map((page) => page.id),
    ['a', 'b'],
  );
  assert.deepEqual(
    editor.redo().pages.map((page) => page.id),
    ['b', 'a'],
  );
});

test('snapshots are detached and enforce unique pages and limits', () => {
  const editor = createPdfEditorCore(pages, { maxPages: 2 });
  assert.throws(() => {
    editor.snapshot().pages[0].id = 'mutated';
  }, TypeError);
  assert.equal(editor.snapshot().pages[0].id, 'a');
  assert.throws(() => editor.apply([{ type: 'insert', page: pages[0], index: 0 }]), {
    code: 'duplicate',
  });
});
