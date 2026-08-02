import type { Preview } from '@storybook/web-components-vite';
import 'flow-grid/themes/flow-grid.css';
import './preview.css';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
  },
};

export default preview;
