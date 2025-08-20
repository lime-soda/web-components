# @lime-soda/button

A customizable button web component for the Lime Soda design system.

## Installation

```bash
npm install @lime-soda/button
```

## Usage

### HTML

```html
<script type="module">
  import '@lime-soda/button'
</script>

<ls-button>Click me</ls-button>
<ls-button variant="primary">Primary Button</ls-button>
<ls-button disabled>Disabled</ls-button>
```

### JavaScript/TypeScript

```ts
import '@lime-soda/button'
import { LsButton } from '@lime-soda/button'

// Use in HTML templates
const button = document.createElement('ls-button')
button.textContent = 'Click me'
button.variant = 'primary'

// Type-safe access to properties
const button = document.querySelector('ls-button') as LsButton
button.disabled = true
```

### Lit Templates

```ts
import { html } from 'lit'
import '@lime-soda/button'

const template = html`
  <ls-button @click=${handleClick} variant="primary"> Save Changes </ls-button>
`
```

## API

### Attributes/Properties

| Property   | Attribute  | Type      | Default     | Description                    |
| ---------- | ---------- | --------- | ----------- | ------------------------------ |
| `variant`  | `variant`  | `string`  | `"default"` | Button style variant           |
| `disabled` | `disabled` | `boolean` | `false`     | Whether the button is disabled |

### CSS Custom Properties

| Property                 | Description             | Default                          |
| ------------------------ | ----------------------- | -------------------------------- |
| `--button-background`    | Button background color | `var(--color-surface)`           |
| `--button-color`         | Button text color       | `var(--color-on-surface)`        |
| `--button-border`        | Button border           | `1px solid var(--color-outline)` |
| `--button-border-radius` | Button border radius    | `var(--border-radius-md)`        |
| `--button-padding`       | Button padding          | `var(--size-2) var(--size-4)`    |

### CSS Parts

| Part     | Description                 |
| -------- | --------------------------- |
| `button` | The internal button element |

### Events

| Event   | Description                      |
| ------- | -------------------------------- |
| `click` | Fired when the button is clicked |

## Styling

### Using CSS Custom Properties

```css
ls-button {
  --button-background: #007bff;
  --button-color: white;
  --button-border-radius: 8px;
}
```

### Using CSS Parts

```css
ls-button::part(button) {
  font-weight: bold;
  text-transform: uppercase;
}
```

## Accessibility

The button component includes:

- Proper ARIA attributes
- Keyboard navigation support
- Focus management
- Screen reader support
- High contrast mode support

## Examples

### Basic Usage

```html
<ls-button>Default Button</ls-button>
```

### Primary Button

```html
<ls-button variant="primary">Primary Action</ls-button>
```

### Disabled State

```html
<ls-button disabled>Cannot Click</ls-button>
```

### Custom Styling

```html
<ls-button style="--button-background: #28a745;">
  Custom Green Button
</ls-button>
```
