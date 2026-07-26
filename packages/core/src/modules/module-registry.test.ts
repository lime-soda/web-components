import { describe, expect, it, vi } from 'vitest';
import { GridPipeline } from '../pipeline/grid-pipeline.js';
import { ModuleRegistry } from './module-registry.js';
import type { GridModule } from './types.js';

interface Quote {
  id: string;
  price: number;
}

const pipeline = () => new GridPipeline<Quote>({ getRowId: (d) => d.id });

const setup = (modules: GridModule<Quote>[] = []) => {
  const p = pipeline();
  const registry = new ModuleRegistry<Quote>({
    pipeline: p,
    getColumns: () => [],
    dispatch: vi.fn(),
  });
  for (const module of modules) registry.register(module);
  return { registry, pipeline: p };
};

const mod = (id: string, overrides: Partial<GridModule<Quote>> = {}): GridModule<Quote> => ({
  id,
  ...overrides,
});

describe('ModuleRegistry', () => {
  describe('registration', () => {
    it('makes a module retrievable by id', () => {
      const module = mod('sort');
      const { registry } = setup([module]);

      expect(registry.get('sort')).toBe(module);
    });

    it('returns undefined for a module that was never registered', () => {
      expect(setup().registry.get('sort')).toBeUndefined();
    });

    it('rejects two modules sharing an id', () => {
      const { registry } = setup([mod('sort')]);

      expect(() => registry.register(mod('sort'))).toThrow(/already registered/i);
    });

    it('calls init with a context when the registry starts', () => {
      const init = vi.fn();
      const { registry, pipeline: p } = setup([mod('sort', { init })]);

      registry.start();

      expect(init).toHaveBeenCalledOnce();
      expect(init.mock.calls[0]![0].pipeline).toBe(p);
    });

    it('inits a module registered after start, so modules can be added at runtime', () => {
      const init = vi.fn();
      const { registry } = setup();
      registry.start();

      registry.register(mod('late', { init }));

      expect(init).toHaveBeenCalledOnce();
    });
  });

  describe('dependencies', () => {
    it('inits a dependency before its dependant regardless of registration order', () => {
      const order: string[] = [];
      const { registry } = setup([
        mod('filter', { dependsOn: ['tree'], init: () => void order.push('filter') }),
        mod('tree', { init: () => void order.push('tree') }),
      ]);

      registry.start();

      expect(order).toEqual(['tree', 'filter']);
    });

    it('reports a missing dependency by name rather than failing obscurely later', () => {
      const { registry } = setup([mod('filter', { dependsOn: ['tree'] })]);

      expect(() => registry.start()).toThrow(/filter.*requires.*tree/i);
    });

    it('reports a dependency cycle', () => {
      const { registry } = setup([mod('a', { dependsOn: ['b'] }), mod('b', { dependsOn: ['a'] })]);

      expect(() => registry.start()).toThrow(/cycle/i);
    });

    it('lets a module reach another through the context', () => {
      let found: GridModule<Quote> | undefined;
      const tree = mod('tree');
      const { registry } = setup([
        tree,
        mod('filter', {
          dependsOn: ['tree'],
          init: (ctx) => void (found = ctx.getModule('tree')),
        }),
      ]);

      registry.start();

      expect(found).toBe(tree);
    });
  });

  describe('teardown', () => {
    it('destroys modules in reverse dependency order', () => {
      const order: string[] = [];
      const { registry } = setup([
        mod('tree', { destroy: () => void order.push('tree') }),
        mod('filter', { dependsOn: ['tree'], destroy: () => void order.push('filter') }),
      ]);
      registry.start();

      registry.destroy();

      expect(order).toEqual(['filter', 'tree']);
    });

    it('removes a stage a module registered', () => {
      const run = vi.fn((rows) => rows);
      const { registry, pipeline: p } = setup([
        mod('filter', { init: (ctx) => ctx.addStage({ id: 'f', phase: 'filter', run }) }),
      ]);
      registry.start();
      p.projector.rows.get();
      expect(run).toHaveBeenCalled();

      registry.destroy();
      run.mockClear();
      p.projector.rows.get();

      expect(run).not.toHaveBeenCalled();
    });

    it('runs teardowns a module registered through the context', () => {
      const teardown = vi.fn();
      const { registry } = setup([mod('m', { init: (ctx) => ctx.addTeardown(teardown) })]);
      registry.start();

      registry.destroy();

      expect(teardown).toHaveBeenCalledOnce();
    });
  });

  describe('contributions', () => {
    it('collects columns from every module that provides them', () => {
      const { registry } = setup([
        mod('selection', { provideColumns: () => [{ colId: 'check' }] }),
        mod('sort'),
      ]);

      expect(registry.provideColumns()).toEqual([{ colId: 'check', providedBy: 'selection' }]);
    });

    it('stamps each contributed column with the module that provided it', () => {
      // How another module tells a data column from a module's own furniture.
      const { registry } = setup([
        mod('selection', { provideColumns: () => [{ colId: 'check' }] }),
        mod('detail', { provideColumns: () => [{ colId: 'expand' }] }),
      ]);

      expect(registry.provideColumns().map((c) => c.providedBy)).toEqual(['selection', 'detail']);
    });

    it('collects cell decorations from every module', () => {
      const { registry } = setup([
        mod('tree', { cellDecorator: () => ({ classes: ['tree'] }) }),
        mod('flash', { cellDecorator: () => ({ classes: ['flash'] }) }),
        mod('quiet', { cellDecorator: () => null }),
      ]);

      const decorations = registry.cellDecorations({} as never);

      expect(decorations.flatMap((d) => d.classes ?? [])).toEqual(['tree', 'flash']);
    });

    it('collects row decorations', () => {
      const { registry } = setup([mod('sel', { rowDecorator: () => ({ classes: ['selected'] }) })]);

      expect(registry.rowDecorations({} as never)).toHaveLength(1);
    });

    it('merges api extensions from every module', () => {
      const expandAll = vi.fn();
      const { registry } = setup([
        mod('tree', { apiExtension: () => ({ expandAll }) }),
        mod('sel', { apiExtension: () => ({ getSelectedRows: () => [] }) }),
      ]);

      const api = registry.apiExtensions();

      expect(api['expandAll']).toBe(expandAll);
      expect(typeof api['getSelectedRows']).toBe('function');
    });

    it('returns nothing for hooks no module implements', () => {
      const { registry } = setup([mod('bare')]);

      expect(registry.cellDecorations({} as never)).toEqual([]);
      expect(registry.provideColumns()).toEqual([]);
      expect(registry.apiExtensions()).toEqual({});
    });
  });

  describe('state', () => {
    it('collects state per module id', () => {
      const { registry } = setup([
        mod('sort', { getState: () => ({ field: 'price' }) }),
        mod('stateless'),
      ]);

      expect(registry.getState()).toEqual({ sort: { field: 'price' } });
    });

    it('restores state to the matching module only', () => {
      const setSort = vi.fn();
      const setFilter = vi.fn();
      const { registry } = setup([
        mod('sort', { setState: setSort }),
        mod('filter', { setState: setFilter }),
      ]);

      registry.setState({ sort: { field: 'price' } });

      expect(setSort).toHaveBeenCalledWith({ field: 'price' });
      expect(setFilter).not.toHaveBeenCalled();
    });
  });
});
