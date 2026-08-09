/*
 * The semantic token tier, which an application is expected to load.
 *
 * Without it `--grid-row-height` resolves to nothing, rows collapse, and every
 * instance fits the viewport — so the virtualisation benchmark measured a grid
 * with no height rather than a broken observer.
 */
import '@lime-soda/tokens/variables.css';
