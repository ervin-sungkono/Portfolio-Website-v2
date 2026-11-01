import { expect, type Page } from '@playwright/test';

export class CmsEditorPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto('/admin');
    await expect(this.page.getByRole('heading', { name: 'Content editor' })).toBeVisible();
  }

  async expectUniquePanels() {
    await expect(this.page.locator('.cms-editor')).toHaveCount(1);
    for (const id of ['projects', 'site', 'categories', 'technologies', 'images']) {
      await expect(this.page.locator(`#cms-editor-${id}-panel`)).toHaveCount(1);
    }
  }

  async selectTheme(theme: 'light' | 'dark') {
    const root = this.page.locator('html');
    const current = await root.getAttribute('data-theme');
    if (current === theme) {
      return;
    }
    await this.page
      .getByRole('button', {
        name: current === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
      })
      .click();
    await expect(root).toHaveAttribute('data-theme', theme);
  }
}
