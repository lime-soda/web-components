import type { TestRunnerConfig } from '@storybook/test-runner';

const config: TestRunnerConfig = {
  async postVisit(page) {
    // Wait for any async operations to complete
    await page.waitForTimeout(500);
  },
};

export default config;