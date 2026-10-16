const projects = ['chromium', 'firefox', 'webkit'] as const;

export function publishE2eFixture(project: string, retry: number) {
  const projectIndex = projects.indexOf(project as (typeof projects)[number]);
  if (projectIndex < 0 || !Number.isInteger(retry) || retry < 0 || retry > 2)
    throw Error('Unsupported publish E2E fixture');
  const discriminator = `${projectIndex + 1}${retry}`;
  return {
    project,
    retry,
    postId: `e1${discriminator}0000-0000-4000-8000-000000000001`,
    localizationId: `e2${discriminator}0000-0000-4000-8000-000000000001`,
    slug: `publish-e2e-${project}-retry-${retry}`,
  };
}

export const publishE2eFixtures = (maxRetry = 2) =>
  projects.flatMap((project) =>
    Array.from({ length: maxRetry + 1 }, (_, retry) => publishE2eFixture(project, retry))
  );
