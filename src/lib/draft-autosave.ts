type State = 'saved' | 'dirty' | 'saving' | 'failed' | 'conflict';
export class DraftAutosave<T> {
  status: State = 'saved';
  private timer?: ReturnType<typeof setTimeout>;
  private pending?: T;
  private active?: Promise<boolean>;
  constructor(
    private save: (value: T) => Promise<unknown>,
    private delay = 1_000,
    private onState?: (state: State) => void
  ) {}
  private set(state: State) {
    this.status = state;
    this.onState?.(state);
  }
  change(value: T) {
    if (this.status === 'conflict') return;
    this.pending = value;
    this.set('dirty');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.delay);
  }
  async flush(): Promise<boolean> {
    clearTimeout(this.timer);
    if (this.status === 'conflict') return false;
    if (this.active) {
      const saved = await this.active;
      if (!saved) return false;
      return this.pending ? this.flush() : true;
    }
    if (!this.pending) return this.status === 'saved';
    const value = this.pending;
    this.pending = undefined;
    this.set('saving');
    this.active = (async () => {
      try {
        await this.save(value);
        this.set(this.pending ? 'dirty' : 'saved');
        return true;
      } catch (error) {
        const conflict = (error as { error?: { code?: string } })?.error?.code === 'CONFLICT';
        if (!conflict) this.pending ??= value;
        this.set(conflict ? 'conflict' : 'failed');
        return false;
      }
    })();
    const saved = await this.active;
    this.active = undefined;
    return saved && this.pending ? this.flush() : saved;
  }
}
