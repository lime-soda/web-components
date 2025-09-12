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
<ls-button size="lg" color="primary">Large Primary Button</ls-button>
<ls-button size="sm">Small Button</ls-button>
```

### JavaScript/TypeScript

```ts
import '@lime-soda/button'
import { LsButton } from '@lime-soda/button'

// Use in HTML templates
const button = document.createElement('ls-button')
button.textContent = 'Click me'
button.size = 'lg'
button.color = 'primary'

// Type-safe access to properties
const button = document.querySelector('ls-button') as LsButton
button.size = 'md'
```

### Lit Templates

```ts
import { html } from 'lit'
import '@lime-soda/button'

const template = html`
  <ls-button @click=${handleClick} size="lg" color="primary">
    Save Changes
  </ls-button>
`
```

## API

### Attributes/Properties

| Property | Attribute | Type                       | Default     | Description          |
| -------- | --------- | -------------------------- | ----------- | -------------------- |
| `size`   | `size`    | `'sm' \| 'md' \| 'lg'`     | `'sm'`      | Button size variant  |
| `color`  | `color`   | `'primary' \| 'secondary'` | `'primary'` | Button color variant |

### CSS Custom Properties

The button component uses design tokens for consistent styling:

| Property                                  | Description                                |
| ----------------------------------------- | ------------------------------------------ |
| `--button-transition`                     | Transition timing for button state changes |
| `--button-sm-font`                        | Typography scale for small button          |
| `--button-sm-padding`                     | Internal spacing for small button          |
| `--button-sm-border-radius`               | Corner radius for small button             |
| `--button-md-font`                        | Typography scale for medium button         |
| `--button-md-padding`                     | Internal spacing for medium button         |
| `--button-md-border-radius`               | Corner radius for medium button            |
| `--button-lg-font`                        | Typography scale for large button          |
| `--button-lg-padding`                     | Internal spacing for large button          |
| `--button-lg-border-radius`               | Corner radius for large button             |
| `--button-primary-background-color`       | Primary button background color            |
| `--button-primary-background-color-hover` | Primary button background color on hover   |
| `--button-primary-color`                  | Primary button text color                  |

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

You can customize the button appearance by overriding design token CSS custom
properties:

```css
ls-button {
  /* Override primary button colors */
  --button-primary-background-color: #007bff;
  --button-primary-color: white;

  /* Customize size-specific styles */
  --button-lg-border-radius: 12px;
  --button-lg-padding: 1rem 1.5rem;
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

### Size Variants

```html
<ls-button size="sm">Small Button</ls-button>
<ls-button size="md">Medium Button</ls-button>
<ls-button size="lg">Large Button</ls-button>
```

### Color Variants

```html
<ls-button color="primary">Primary Button</ls-button>
<ls-button color="secondary">Secondary Button</ls-button>
```

### Custom Styling

```html
<ls-button style="--button-primary-background-color: #28a745;">
  Custom Green Button
</ls-button>
```
