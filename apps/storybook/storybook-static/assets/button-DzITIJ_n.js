import{f as y,u as f,r,i as h,a as g,x as $}from"./lit-element-DHi8qgCa.js";/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const v=t=>(o,e)=>{e!==void 0?e.addInitializer(()=>{customElements.define(t,o)}):customElements.define(t,o)};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const w={attribute:!0,type:String,converter:f,reflect:!1,hasChanged:y},P=(t=w,o,e)=>{const{kind:a,metadata:n}=e;let s=globalThis.litPropertyMetadata.get(n);if(s===void 0&&globalThis.litPropertyMetadata.set(n,s=new Map),a==="setter"&&((t=Object.create(t)).wrapped=!0),s.set(e.name,t),a==="accessor"){const{name:i}=e;return{set(l){const b=o.get.call(this);o.set.call(this,l),this.requestUpdate(i,b,t)},init(l){return l!==void 0&&this.C(i,void 0,t,l),l}}}if(a==="setter"){const{name:i}=e;return function(l){const b=this[i];o.call(this,l),this.requestUpdate(i,b,t)}}throw Error("Unsupported decorator location: "+a)};function m(t){return(o,e)=>typeof e=="object"?P(t,o,e):((a,n,s)=>{const i=n.hasOwnProperty(s);return n.constructor.createProperty(s,a),i?Object.getOwnPropertyDescriptor(n,s):void 0})(t,o,e)}const d={primary:{500:"#22c55e",600:"#16a34a"},secondary:{500:"#eab308",600:"#ca8a04"},neutral:{50:"#fafafa",300:"#d4d4d4",400:"#a3a3a3",700:"#404040"}},c={2:"0.5rem","2.5":"0.625rem",3:"0.75rem",4:"1rem",6:"1.5rem"};var O=Object.defineProperty,z=Object.getOwnPropertyDescriptor,u=(t,o,e,a)=>{for(var n=a>1?void 0:a?z(o,e):o,s=t.length-1,i;s>=0;s--)(i=t[s])&&(n=(a?i(o,e,n):i(n))||n);return a&&n&&O(o,e,n),n};let p=class extends g{constructor(){super(...arguments),this.variant="primary",this.size="md",this.disabled=!1}render(){return $`
      <button
        class="${this.variant} ${this.size}"
        ?disabled=${this.disabled}
      >
        <slot></slot>
      </button>
    `}};p.styles=h`
    :host {
      display: inline-block;
    }

    button {
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
      font-weight: 500;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: ${r(c[2])};
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .primary {
      background: ${r(d.primary[500])};
      color: white;
    }

    .primary:hover:not(:disabled) {
      background: ${r(d.primary[600])};
    }

    .secondary {
      background: ${r(d.secondary[500])};
      color: white;
    }

    .secondary:hover:not(:disabled) {
      background: ${r(d.secondary[600])};
    }

    .outline {
      background: transparent;
      border: 1px solid ${r(d.neutral[300])};
      color: ${r(d.neutral[700])};
    }

    .outline:hover:not(:disabled) {
      background: ${r(d.neutral[50])};
      border-color: ${r(d.neutral[400])};
    }

    .sm {
      padding: ${r(c[2])} ${r(c[3])};
      font-size: 0.875rem;
    }

    .md {
      padding: ${r(c["2.5"])} ${r(c[4])};
      font-size: 1rem;
    }

    .lg {
      padding: ${r(c[3])} ${r(c[6])};
      font-size: 1.125rem;
    }
  `;u([m({type:String})],p.prototype,"variant",2);u([m({type:String})],p.prototype,"size",2);u([m({type:Boolean})],p.prototype,"disabled",2);p=u([v("ls-button")],p);
