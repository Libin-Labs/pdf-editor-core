import {
  createPdfEditorCore,
  type PdfEditorCommand,
  type PdfEditorSnapshot,
} from '@lp-labs/pdf-editor-core';

const editor = createPdfEditorCore([{ id: 'cover', width: 612, height: 792 }], {
  maxHistory: 5,
});
const commands: readonly PdfEditorCommand[] = [{ type: 'label', pageId: 'cover', value: 'i' }];
const result: PdfEditorSnapshot = editor.apply(commands, 0);
const revision: number = result.revision;
void revision;
