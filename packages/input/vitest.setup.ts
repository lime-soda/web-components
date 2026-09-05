/*
 * The semantic token tier, which an application is expected to load.
 *
 * Without it every `--theme-*` and `--size-*` reference is undefined, so any
 * declaration using one is invalid at computed-value time and simply does not
 * apply — the component renders unstyled and a test measuring it measures
 * nothing. That is not hypothetical: the outline variant's border was missing
 * here, which hid a real difference in its box.
 */
import '@lime-soda/tokens/variables.css';
