export interface PdfPageModel {
  id: string;
  width: number;
  height: number;
  rotation?: 0 | 90 | 180 | 270;
  label?: string;
}

export type PdfEditorCommand =
  | { type: 'insert'; page: PdfPageModel; index: number }
  | { type: 'remove'; pageId: string }
  | { type: 'rotate'; pageId: string; degrees: 90 | 180 | 270 }
  | { type: 'reorder'; pageIds: readonly string[] }
  | { type: 'label'; pageId: string; value: string };

export interface PdfEditorSnapshot {
  readonly revision: number;
  readonly pages: readonly Readonly<PdfPageModel>[];
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export class PdfEditorCoreError extends Error {
  constructor(
    readonly code: 'invalid' | 'conflict' | 'not-found' | 'duplicate' | 'limit',
    message: string,
  ) {
    super(message);
    this.name = 'PdfEditorCoreError';
  }
}

export interface PdfEditorCoreOptions {
  maxPages?: number;
  maxHistory?: number;
}

function copy(pages: readonly PdfPageModel[]): PdfPageModel[] {
  return pages.map((page) => ({ ...page }));
}

function validatePage(page: PdfPageModel): void {
  if (!page.id || page.id.length > 200) {
    throw new PdfEditorCoreError('invalid', 'Page ids must contain 1–200 characters.');
  }
  if (
    !Number.isFinite(page.width) ||
    page.width <= 0 ||
    !Number.isFinite(page.height) ||
    page.height <= 0
  ) {
    throw new PdfEditorCoreError('invalid', 'Page dimensions must be finite and positive.');
  }
  if (page.rotation !== undefined && ![0, 90, 180, 270].includes(page.rotation)) {
    throw new PdfEditorCoreError('invalid', 'Rotation must be a right angle.');
  }
  if (page.label !== undefined && page.label.length > 200) {
    throw new PdfEditorCoreError('limit', 'Page labels are limited to 200 characters.');
  }
}

export class PdfEditorCore {
  private pages: PdfPageModel[];
  private revision = 0;
  private readonly past: PdfPageModel[][] = [];
  private readonly future: PdfPageModel[][] = [];
  private readonly maxPages: number;
  private readonly maxHistory: number;

  constructor(pages: readonly PdfPageModel[], options: PdfEditorCoreOptions = {}) {
    this.maxPages = options.maxPages ?? 10_000;
    this.maxHistory = options.maxHistory ?? 100;
    if (
      !Number.isSafeInteger(this.maxPages) ||
      this.maxPages < 1 ||
      !Number.isSafeInteger(this.maxHistory) ||
      this.maxHistory < 0
    ) {
      throw new PdfEditorCoreError(
        'invalid',
        'History and page limits must be non-negative safe integers.',
      );
    }
    this.pages = copy(pages);
    this.assertPages(this.pages);
  }

  snapshot(): PdfEditorSnapshot {
    return {
      revision: this.revision,
      pages: this.pages.map((page) => Object.freeze({ ...page })),
      canUndo: this.past.length > 0,
      canRedo: this.future.length > 0,
    };
  }

  apply(
    commands: readonly PdfEditorCommand[],
    expectedRevision = this.revision,
  ): PdfEditorSnapshot {
    if (expectedRevision !== this.revision) {
      throw new PdfEditorCoreError(
        'conflict',
        `Expected revision ${expectedRevision}, current revision is ${this.revision}.`,
      );
    }
    if (commands.length === 0) return this.snapshot();
    const draft = copy(this.pages);
    for (const command of commands) this.applyOne(draft, command);
    this.assertPages(draft);
    if (this.maxHistory > 0) {
      this.past.push(copy(this.pages));
      if (this.past.length > this.maxHistory) this.past.shift();
    }
    this.pages = draft;
    this.future.length = 0;
    this.revision += 1;
    return this.snapshot();
  }

  undo(): PdfEditorSnapshot {
    const previous = this.past.pop();
    if (!previous) return this.snapshot();
    this.future.push(copy(this.pages));
    this.pages = previous;
    this.revision += 1;
    return this.snapshot();
  }

  redo(): PdfEditorSnapshot {
    const next = this.future.pop();
    if (!next) return this.snapshot();
    if (this.maxHistory > 0) this.past.push(copy(this.pages));
    this.pages = next;
    this.revision += 1;
    return this.snapshot();
  }

  private applyOne(pages: PdfPageModel[], command: PdfEditorCommand): void {
    if (command.type === 'insert') {
      validatePage(command.page);
      if (pages.some((page) => page.id === command.page.id))
        throw new PdfEditorCoreError('duplicate', `Page ${command.page.id} already exists.`);
      if (!Number.isInteger(command.index) || command.index < 0 || command.index > pages.length)
        throw new PdfEditorCoreError('invalid', 'Insert index is outside the page list.');
      pages.splice(command.index, 0, { ...command.page });
    } else if (command.type === 'remove') {
      const index = pages.findIndex((page) => page.id === command.pageId);
      if (index < 0)
        throw new PdfEditorCoreError('not-found', `Page ${command.pageId} was not found.`);
      pages.splice(index, 1);
    } else if (command.type === 'rotate') {
      const page = pages.find((item) => item.id === command.pageId);
      if (!page) throw new PdfEditorCoreError('not-found', `Page ${command.pageId} was not found.`);
      page.rotation = (((page.rotation ?? 0) + command.degrees) % 360) as 0 | 90 | 180 | 270;
    } else if (command.type === 'reorder') {
      const byId = new Map(pages.map((page) => [page.id, page]));
      if (
        command.pageIds.length !== pages.length ||
        new Set(command.pageIds).size !== pages.length ||
        command.pageIds.some((id) => !byId.has(id))
      ) {
        throw new PdfEditorCoreError(
          'invalid',
          'Reorder must name every existing page exactly once.',
        );
      }
      pages.splice(0, pages.length, ...command.pageIds.map((id) => ({ ...byId.get(id)! })));
    } else {
      const page = pages.find((item) => item.id === command.pageId);
      if (!page) throw new PdfEditorCoreError('not-found', `Page ${command.pageId} was not found.`);
      if (command.value.length > 200)
        throw new PdfEditorCoreError('limit', 'Page labels are limited to 200 characters.');
      page.label = command.value;
    }
  }

  private assertPages(pages: readonly PdfPageModel[]): void {
    if (pages.length > this.maxPages)
      throw new PdfEditorCoreError('limit', `At most ${this.maxPages} pages are allowed.`);
    const ids = new Set<string>();
    for (const page of pages) {
      validatePage(page);
      if (ids.has(page.id))
        throw new PdfEditorCoreError('duplicate', `Page ${page.id} appears more than once.`);
      ids.add(page.id);
    }
  }
}

export function createPdfEditorCore(
  pages: readonly PdfPageModel[],
  options?: PdfEditorCoreOptions,
): PdfEditorCore {
  return new PdfEditorCore(pages, options);
}
