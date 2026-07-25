import type { Preview } from '@storybook/web-components-vite';
import '@flowgrid/core/themes/flowgrid.css';
import './preview.css';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
  },
};

export default preview;
