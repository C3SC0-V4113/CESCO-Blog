import { Cat } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function HomeHero() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center text-foreground">
      <Cat className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-semibold tracking-tight">Cesco Blog</h1>
      <p className="text-sm text-muted-foreground">Localized editorial home coming soon.</p>
      <Button type="button">Start building</Button>
    </main>
  );
}
