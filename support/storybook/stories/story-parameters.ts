/**
 * What every test story's meta shares.
 *
 * No controls: these exist to be run, not adjusted. A controls panel on a test
 * invites someone to change the fixture it is asserting against, and the demo
 * stories next door are where a reader is meant to experiment.
 *
 * Snapshots are off by default too. A story that is worth a picture turns them
 * back on rather than every behavioural story producing one.
 */
export const testStoryParameters = {
  // Padded rather than centred. Every story here mounts a frame of a fixed
  // size, and centring one in a viewport-sized canvas puts it adrift in white
  // space with its edges nowhere near anything — which is exactly where the
  // borders these stories are judging live.
  layout: 'padded',
  controls: { disable: true },
  docs: { disable: true },
  chromatic: { disableSnapshot: true },
  a11y: { test: 'error' },
} as const;

/**
 * For the stories Chromatic judges rather than assertions.
 *
 * The same rules — no controls, out of the docs — with snapshots turned back
 * on, because the picture is the point. A story here still declares which
 * colour scheme it wants: the grid's defaults resolve through `light-dark()`,
 * so a baseline captured in one is a failure in the other.
 */
export const visualStoryParameters = {
  ...testStoryParameters,
  chromatic: {},
} as const;
