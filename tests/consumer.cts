import { createPdfEditorCore, type PdfPageModel } from '@lp-labs/pdf-editor-core';

const pages: readonly PdfPageModel[] = [{ id: 'p', width: 100, height: 200 }];
const pageCount: number = createPdfEditorCore(pages).snapshot().pages.length;
void pageCount;
