import type { Preview } from '@storybook/web-components-vite';
import '@tradeflow/core/themes/tradeflow.css';
import './preview.css';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
  },
};

export default preview;
