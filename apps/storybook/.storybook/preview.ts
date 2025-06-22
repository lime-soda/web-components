import type { Preview } from '@storybook/web-components'
import '../../../packages/button/src/button.js'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
}

export default preview
