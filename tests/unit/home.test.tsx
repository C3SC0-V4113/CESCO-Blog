import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HomeHero from '@/components/common/home-hero';

describe('Home hero smoke test', () => {
  it('renders a heading', () => {
    render(<HomeHero />);

    expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
  });
});
