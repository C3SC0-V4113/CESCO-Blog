type State = 'saved' | 'dirty' | 'saving' | 'failed' | 'conflict';
export class DraftAutosave<T> {
  status: State = 'saved';
  private timer?: ReturnType<typeof setTimeout>;
  private pending?: T;
  private active?: Promise<boolean>;
  // Raised by an edit the draft contract rejects. While it holds, no earlier
  // save may report the draft as saved: the editor shows content it cannot send.
  private invalid = false;
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
    this.invalid = false;
    this.pending = value;
    this.set('dirty');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.delay);
  }
  // The queued value predates the rejected edit, so it is dropped: saving it
  // would store content the editor no longer shows.
  markInvalid() {
    if (this.status === 'conflict') return;
    clearTimeout(this.timer);
    this.pending = undefined;
    this.invalid = true;
    this.set('failed');
  }
  // Every caller loops until nothing is active and nothing is pending. Whichever
  // caller resumes first after a save starts the follow-up; the rest must wait on
  // it rather than read an empty queue whose value is already in flight.
  async flush(): Promise<boolean> {
    clearTimeout(this.timer);
    for (;;) {
      if (this.status === 'conflict' || this.invalid) return false;
      if (!this.active && this.pending === undefined) return this.status === 'saved';
      const run = this.active ?? this.start();
      const saved = await run;
      if (this.active === run) this.active = undefined;
      if (!saved) return false;
    }
  }
  private start() {
    const value = this.pending as T;
    this.pending = undefined;
    this.set('saving');
    this.active = (async () => {
      try {
        await this.save(value);
        this.set(this.invalid ? 'failed' : this.pending === undefined ? 'saved' : 'dirty');
        return true;
      } catch (error) {
        const conflict = (error as { error?: { code?: string } })?.error?.code === 'CONFLICT';
        if (!conflict && !this.invalid) this.pending ??= value;
        this.set(conflict ? 'conflict' : 'failed');
        return false;
      }
    })();
    return this.active;
  }
}

type DraftTokens = { draftToken: string | null; nextToken: string };

// Each attempt carries the token it will leave behind, so a retry after a lost
// response is a replay the server recognises rather than a conflict (ADR-0035).
// An unconfirmed attempt is replayed with its own value before anything newer
// goes out: the server accepts a replay because the row may already hold its
// token, and newer content riding on that acceptance could overwrite a session
// that loaded the draft in between.
export function createDraftSave<T>(
  draftToken: string | null,
  send: (value: T, tokens: DraftTokens) => Promise<unknown>,
  generateToken: () => string = () => crypto.randomUUID()
) {
  let current = draftToken;
  let unconfirmed: { value: T; tokens: DraftTokens } | undefined;
  const attempt = async (value: T, tokens: DraftTokens) => {
    unconfirmed = { value, tokens };
    await send(value, tokens);
    current = tokens.nextToken;
    unconfirmed = undefined;
  };
  return async (value: T) => {
    if (unconfirmed) {
      const replay = unconfirmed;
      await attempt(replay.value, replay.tokens);
      if (replay.value === value) return;
    }
    await attempt(value, { draftToken: current, nextToken: generateToken() });
  };
}
