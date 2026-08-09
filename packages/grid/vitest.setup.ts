/*
 * The semantic token tier, which an application is expected to load.
 *
 * Every `--grid-*` property resolves to a `--theme-*` one, and those are
 * declared here. Without it the values are undefined, so declarations that use
 * them are invalid at computed-value time and the grid renders unstyled — which
 * is what a consumer would see too, and the reason this is a real import rather
 * than a stub.
 */
import '@lime-soda/tokens/variables.css';
