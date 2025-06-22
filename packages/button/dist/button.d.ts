import { LitElement } from 'lit';
export declare class LsButton extends LitElement {
    variant: 'primary' | 'secondary' | 'outline';
    size: 'sm' | 'md' | 'lg';
    disabled: boolean;
    static styles: import('lit').CSSResult;
    render(): import('lit').TemplateResult<1>;
}
