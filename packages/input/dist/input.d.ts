import { LitElement } from 'lit';
export declare class LsInput extends LitElement {
    type: 'text' | 'email' | 'password' | 'number';
    placeholder: string;
    value: string;
    disabled: boolean;
    required: boolean;
    static styles: import('lit').CSSResult;
    render(): import('lit').TemplateResult<1>;
    private _handleInput;
}
