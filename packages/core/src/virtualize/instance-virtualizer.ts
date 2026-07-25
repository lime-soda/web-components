export interface InstanceVirtualizerOptions {
  /**
   * How far beyond the viewport an instance is treated as visible.
   *
   * Non-zero by default and deliberately so: the prototype observed with
   * `threshold: 0` and no margin, so an instance began rendering only once it had
   * entered the viewport and a fast horizontal scroll showed empty placeholders.
   * Mounting a screenful early costs one instance of work and removes the flash.
   */
  rootMargin?: string;
  root?: Element | null;
}

/**
 * Tracks which instances are near enough to the viewport to be worth rendering.
 *
 * Instance-level rather than row-level virtualisation is what the horizontal
 * layout makes possible: instances are fixed-size blocks in a row, so an
 * IntersectionObserver answers the question directly and no scroll maths is needed.
 */
export class InstanceVirtualizer {
  private readonly observer: IntersectionObserver;
  private readonly visible = new Set<string>();

  constructor(
    private readonly onChange: (visible: ReadonlySet<string>) => void,
    options: InstanceVirtualizerOptions = {},
  ) {
    this.observer = new IntersectionObserver(
      (entries) => this.handle(entries),
      {
        root: options.root ?? null,
        rootMargin: options.rootMargin ?? '0px 100% 0px 100%',
        threshold: 0,
      },
    );
  }

  observe(element: Element): void {
    this.observer.observe(element);
  }

  unobserve(element: Element): void {
    this.observer.unobserve(element);
    const id = element.getAttribute('data-instance-id');
    if (id !== null && this.visible.delete(id)) this.onChange(this.visible);
  }

  isVisible(id: string): boolean {
    return this.visible.has(id);
  }

  disconnect(): void {
    this.observer.disconnect();
    this.visible.clear();
  }

  private handle(entries: readonly IntersectionObserverEntry[]): void {
    let changed = false;

    for (const entry of entries) {
      const id = entry.target.getAttribute('data-instance-id');
      if (id === null) continue;

      if (entry.isIntersecting) {
        changed = !this.visible.has(id) || changed;
        this.visible.add(id);
      } else if (this.visible.delete(id)) {
        changed = true;
      }
    }

    if (changed) this.onChange(this.visible);
  }
}
