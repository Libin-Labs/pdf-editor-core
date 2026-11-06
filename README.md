# @lp-labs/pdf-editor-core

A transactional, headless page-model command engine. Commands update editor metadata and ordering;
the model deliberately does not parse or rewrite PDF bytes.

## Install and quick start

```sh
npm install @lp-labs/pdf-editor-core
```

```js
import { createPdfEditorCore } from '@lp-labs/pdf-editor-core';

const editor = createPdfEditorCore([{ id: 'p1', width: 612, height: 792 }]);
editor.apply([{ type: 'rotate', pageId: 'p1', degrees: 90 }], 0);
console.log(editor.snapshot().revision, editor.snapshot().pages[0].rotation);
```

## API, types, and customization

- `createPdfEditorCore(pages, options?)` creates the page model. `PdfEditorCore` exposes `snapshot`,
  `apply`, `undo`, and `redo`; `PdfEditorCoreError` reports coded failures.
- `PdfPageModel` needs a unique `id` and finite positive `width`/`height`; optional rotation is a
  right angle. `PdfEditorCommand` supports `insert`, `remove`, `rotate`, exact-list `reorder`, and
  page `label` changes. `PdfEditorSnapshot` is frozen and detached.
- `PdfEditorCoreOptions` customizes `maxPages` (10,000 default) and `maxHistory` (100; zero disables
  history). Each nonempty `apply` is one revision. Supply `expectedRevision` for optimistic conflict
  checks; failed batches leave state unchanged.
- `PdfEditorCoreError` codes are `invalid`, `conflict`, `not-found`, `duplicate`, and `limit`.

## Interoperability and scope

Map the snapshot to an application-owned PDF adapter and persist only after that adapter succeeds.
This package is in-memory, synchronous, and page-model-only: no PDF parsing, byte editing, persistence,
collaboration, or rendering. Work scales with page count per transaction and retained history.

ESM, CommonJS, and TypeScript declarations are included. There are no runtime or peer dependencies;
TypeScript and Prettier are development-only.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
