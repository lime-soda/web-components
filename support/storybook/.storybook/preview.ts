import './preview.css'
import type { Preview } from '@storybook/web-components-vite'

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Global theme for components',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'system', title: 'System', icon: 'circlehollow' },
          { value: 'light', title: 'Light', icon: 'circle' },
          { value: 'dark', title: 'Dark', icon: 'contrast' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'system',
  },
  decorators: [
    (story, { globals }) => {
      const theme = (globals?.theme as string) ?? 'system'

      // Set theme class on document body for global theming
      document.body.className =
        document.body.className
          .replace(/theme-\w+/g, '') // Remove existing theme classes
          .trim() + ` theme-${theme}`

      return story()
    },
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: 'error',
    },
  },
}

export default preview
