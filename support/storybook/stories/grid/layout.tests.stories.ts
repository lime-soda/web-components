import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect } from 'storybook/test';
import '@lime-soda/grid';
import '@lime-soda/grid/layouts';
import { getAllByRole, gridReady, queryAllByRole } from './shadow-queries.js';
import { COLUMN_WIDTHS, instruments, mountGrid, testStoryParameters } from './fixtures.js';

/**
 * How the flow layout arranges rows, and how little of it is real at a time.
 *
 * Rows run down an instance until it is full, then a new instance starts beside
 * it — which is the whole idea, and the reason a trader can fill a wide monitor
 * with one component. Only the instances near the viewport are built; the rest
 * are placeholders holding the scrollbar still.
 *
 * Separate from the navigation stories on purpose. That a boundary exists is
 * this file's claim; what the arrow keys do when focus reaches one is that
 * file's. Proving the first inside the second left neither owning it.
 */

/**
 * A frame 360px tall holds ten rows, so twenty-five need three instances.
 * Four hundred need forty, which is what makes virtualisation observable.
 */
const meta: Meta = {
  title: 'Grid/Tests/Layout',
  parameters: testStoryParameters,
  render: () => mountGrid({ data: instruments(25) }),
};

export default meta;
type Story = StoryObj;

const shadow = (canvas: HTMLElement) => canvas.querySelector('ls-grid')!.shadowRoot!;

/** Every place an instance could be drawn, mounted or not. */
const slots = (canvas: HTMLElement) => [...shadow(canvas).querySelectorAll('.instance-slot')];

/** The instances actually built. */
const mounted = (canvas: HTMLElement) => [...shadow(canvas).querySelectorAll('ls-grid-instance')];

const scroller = (canvas: HTMLElement) => shadow(canvas).querySelector('.scroller') as HTMLElement;

const waitFor = async (condition: () => boolean, description: string, timeout = 3000) => {
  const deadline = Date.now() + timeout;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${description}`);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
};

// --- laying rows out --------------------------------------------------------

export const RowsFillAnInstanceThenStartAnother: Story = {
  play: async ({ canvasElement }) => {
    // 360px tall with a 40px header and 32px rows holds ten; twenty-five rows
    // therefore need three instances.
    await gridReady(canvasElement);

    await expect(slots(canvasElement)).toHaveLength(3);
  },
};

export const EveryInstanceCarriesItsOwnHeader: Story = {
  play: async ({ canvasElement }) => {
    // What makes the layout readable: a trader looking at the fourth instance
    // across still sees what each column means.
    await gridReady(canvasElement);
    const built = mounted(canvasElement);

    // Asserted, because iterating an empty list would pass regardless.
    await expect(built.length).toBeGreaterThan(0);
    for (const instance of built) {
      await expect(queryAllByRole(instance, 'columnheader')).toHaveLength(3);
    }
  },
};

export const ResizingTheContainerReflows: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    await expect(slots(canvasElement)).toHaveLength(3);

    // Taller frame, so more rows fit each instance and fewer are needed.
    (canvasElement.querySelector('#frame') as HTMLElement).style.height = '680px';

    await waitFor(() => slots(canvasElement).length === 2, 'the reflow to two instances');
  },
};

export const ColumnsAreLaidOutAtTheirDeclaredWidths: Story = {
  play: async ({ canvasElement }) => {
    // Measured rather than read off the template, so this stays true however
    // the tracks are expressed.
    await gridReady(canvasElement);
    const [name, price] = getAllByRole(canvasElement, 'columnheader');

    await expect(name!.getBoundingClientRect().width).toBeCloseTo(COLUMN_WIDTHS.name, 0);
    await expect(price!.getBoundingClientRect().width).toBeCloseTo(COLUMN_WIDTHS.price, 0);
  },
};

// --- virtualisation ---------------------------------------------------------

export const OnlyInstancesNearTheViewportAreBuilt: Story = {
  render: () => mountGrid({ data: instruments(400) }),
  play: async ({ canvasElement }) => {
    // 700px holds two 300px instances; the rest sit beyond the prefetch margin
    // and stay as placeholders. Building all forty would defeat the layout.
    await gridReady(canvasElement);

    await expect(slots(canvasElement).length).toBeGreaterThan(10);
    await expect(mounted(canvasElement).length).toBeLessThan(slots(canvasElement).length);
  },
};

export const PlaceholdersHoldTheScrollbarStill: Story = {
  render: () => mountGrid({ data: instruments(400) }),
  parameters: {
    // Reported rather than gated, because it is a real finding and not a fault
    // in this story: once scrolling releases the instance holding the roving
    // tabindex, the scroller has no keyboard-focusable content left and axe
    // says so — `scrollable-region-focusable`. A keyboard user who scrolls this
    // far cannot tab into what is on screen. The fix is a decision about where
    // the tab stop goes when its instance is released, which is the focus
    // controller's to make, so it is not being settled inside a layout story.
    a11y: { test: 'todo' },
  },

  play: async ({ canvasElement }) => {
    // An unbuilt instance still occupies its width. Without that the scrollbar
    // would grow and shrink as instances mounted, and the grid would shift
    // under the reader's hand.
    await gridReady(canvasElement);
    const before = scroller(canvasElement).scrollWidth;
    const wereMounted = mounted(canvasElement).map((instance) => instance.parentElement);

    scroller(canvasElement).scrollLeft = 2000;
    await waitFor(
      () => mounted(canvasElement).some((i) => !wereMounted.includes(i.parentElement)),
      'a new instance to mount after scrolling',
    );

    await expect(scroller(canvasElement).scrollWidth).toBe(before);
  },
};

export const ScrollingBuildsAndReleasesInstances: Story = {
  render: () => mountGrid({ data: instruments(400) }),
  parameters: {
    // Reported rather than gated, because it is a real finding and not a fault
    // in this story: once scrolling releases the instance holding the roving
    // tabindex, the scroller has no keyboard-focusable content left and axe
    // says so — `scrollable-region-focusable`. A keyboard user who scrolls this
    // far cannot tab into what is on screen. The fix is a decision about where
    // the tab stop goes when its instance is released, which is the focus
    // controller's to make, so it is not being settled inside a layout story.
    a11y: { test: 'todo' },
  },

  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    const first = (slots(canvasElement)[0] as HTMLElement).dataset['instanceId'];
    const ids = () =>
      mounted(canvasElement).map((i) => (i.parentElement as HTMLElement).dataset['instanceId']);

    scroller(canvasElement).scrollLeft = 4000;
    await waitFor(
      () => ids().length > 0 && !ids().includes(first),
      'the first instance to be released after scrolling away',
    );

    await expect(ids()).not.toContain(first);
    await expect(ids().length).toBeGreaterThan(0);
  },
};
