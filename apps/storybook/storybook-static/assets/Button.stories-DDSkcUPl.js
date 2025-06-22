import{x as n}from"./lit-element-DHi8qgCa.js";import{w as D,e as C,u as E}from"./index-C99wrFBX.js";import"./button-DzITIJ_n.js";const I={title:"Components/Button",component:"ls-button",parameters:{layout:"centered"},tags:["autodocs"],argTypes:{variant:{control:{type:"select"},options:["primary","secondary","outline"]},size:{control:{type:"select"},options:["sm","md","lg"]},disabled:{control:"boolean"}}},e={args:{variant:"primary",size:"md",disabled:!1},render:a=>n`
    <ls-button
      variant=${a.variant}
      size=${a.size}
      ?disabled=${a.disabled}
    >
      Button
    </ls-button>
  `},s={args:{variant:"secondary",size:"md",disabled:!1},render:a=>n`
    <ls-button
      variant=${a.variant}
      size=${a.size}
      ?disabled=${a.disabled}
    >
      Button
    </ls-button>
  `},t={args:{variant:"outline",size:"md",disabled:!1},render:a=>n`
    <ls-button
      variant=${a.variant}
      size=${a.size}
      ?disabled=${a.disabled}
    >
      Button
    </ls-button>
  `},r={render:()=>n`
    <div style="display: flex; gap: 1rem; align-items: center;">
      <ls-button variant="primary" size="sm">Small</ls-button>
      <ls-button variant="primary" size="md">Medium</ls-button>
      <ls-button variant="primary" size="lg">Large</ls-button>
    </div>
  `},i={args:{variant:"primary",size:"md",disabled:!0},render:a=>n`
    <ls-button
      variant=${a.variant}
      size=${a.size}
      ?disabled=${a.disabled}
    >
      Disabled Button
    </ls-button>
  `},o={args:{variant:"primary",size:"md",disabled:!1},render:a=>n`
    <ls-button
      variant=${a.variant}
      size=${a.size}
      ?disabled=${a.disabled}
      @click=${()=>window.console.log("Button clicked!")}
    >
      Click Me
    </ls-button>
  `,play:async({canvasElement:a})=>{const l=D(a).getByRole("button");await C(l).toBeInTheDocument(),await E.click(l)}};var d,c,u;e.parameters={...e.parameters,docs:{...(d=e.parameters)==null?void 0:d.docs,source:{originalSource:`{
  args: {
    variant: 'primary',
    size: 'md',
    disabled: false
  },
  render: args => html\`
    <ls-button
      variant=\${args.variant}
      size=\${args.size}
      ?disabled=\${args.disabled}
    >
      Button
    </ls-button>
  \`
}`,...(u=(c=e.parameters)==null?void 0:c.docs)==null?void 0:u.source}}};var m,b,p;s.parameters={...s.parameters,docs:{...(m=s.parameters)==null?void 0:m.docs,source:{originalSource:`{
  args: {
    variant: 'secondary',
    size: 'md',
    disabled: false
  },
  render: args => html\`
    <ls-button
      variant=\${args.variant}
      size=\${args.size}
      ?disabled=\${args.disabled}
    >
      Button
    </ls-button>
  \`
}`,...(p=(b=s.parameters)==null?void 0:b.docs)==null?void 0:p.source}}};var v,g,z;t.parameters={...t.parameters,docs:{...(v=t.parameters)==null?void 0:v.docs,source:{originalSource:`{
  args: {
    variant: 'outline',
    size: 'md',
    disabled: false
  },
  render: args => html\`
    <ls-button
      variant=\${args.variant}
      size=\${args.size}
      ?disabled=\${args.disabled}
    >
      Button
    </ls-button>
  \`
}`,...(z=(g=t.parameters)==null?void 0:g.docs)==null?void 0:z.source}}};var y,$,B;r.parameters={...r.parameters,docs:{...(y=r.parameters)==null?void 0:y.docs,source:{originalSource:`{
  render: () => html\`
    <div style="display: flex; gap: 1rem; align-items: center;">
      <ls-button variant="primary" size="sm">Small</ls-button>
      <ls-button variant="primary" size="md">Medium</ls-button>
      <ls-button variant="primary" size="lg">Large</ls-button>
    </div>
  \`
}`,...(B=($=r.parameters)==null?void 0:$.docs)==null?void 0:B.source}}};var f,h,S;i.parameters={...i.parameters,docs:{...(f=i.parameters)==null?void 0:f.docs,source:{originalSource:`{
  args: {
    variant: 'primary',
    size: 'md',
    disabled: true
  },
  render: args => html\`
    <ls-button
      variant=\${args.variant}
      size=\${args.size}
      ?disabled=\${args.disabled}
    >
      Disabled Button
    </ls-button>
  \`
}`,...(S=(h=i.parameters)==null?void 0:h.docs)==null?void 0:S.source}}};var w,k,x;o.parameters={...o.parameters,docs:{...(w=o.parameters)==null?void 0:w.docs,source:{originalSource:`{
  args: {
    variant: 'primary',
    size: 'md',
    disabled: false
  },
  render: args => html\`
    <ls-button
      variant=\${args.variant}
      size=\${args.size}
      ?disabled=\${args.disabled}
      @click=\${() => window.console.log('Button clicked!')}
    >
      Click Me
    </ls-button>
  \`,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await expect(button).toBeInTheDocument();
    await userEvent.click(button);
  }
}`,...(x=(k=o.parameters)==null?void 0:k.docs)==null?void 0:x.source}}};const L=["Primary","Secondary","Outline","AllSizes","Disabled","WithClickTest"];export{r as AllSizes,i as Disabled,t as Outline,e as Primary,s as Secondary,o as WithClickTest,L as __namedExportsOrder,I as default};
