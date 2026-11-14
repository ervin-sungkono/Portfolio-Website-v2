import { expect, type Locator, type Page } from '@playwright/test';

export class CmsEditorPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto('/admin');
    await expect(this.page.getByRole('heading', { name: 'Content editor' })).toBeVisible();
  }

  async expectUniquePanels() {
    await expect(this.page.locator('.cms-editor')).toHaveCount(1);
    for (const id of [
      'projects',
      'posts',
      'site',
      'categories',
      'technologies',
      'designs',
      'images',
    ]) {
      await expect(this.page.locator(`#cms-editor-${id}-panel`)).toHaveCount(1);
    }
  }

  async openDialog(triggerName: string, dialogName = triggerName): Promise<Locator> {
    await this.page.getByRole('button', { name: triggerName, exact: true }).click();
    const dialog = this.page.getByRole('dialog', { name: dialogName });
    await expect(dialog).toBeVisible();
    return dialog;
  }

  async openProjectForm(slug?: string): Promise<Locator> {
    await this.page.getByRole('button', { name: 'Projects', exact: true }).click();
    if (slug) {
      const projectRow = this.page
        .getByRole('table', { name: 'Current projects' })
        .getByRole('row', { name: new RegExp(slug) });
      if (await projectRow.count()) {
        await projectRow.getByRole('button', { name: /^Edit project\b/ }).click();
        const dialog = this.page.getByRole('dialog', { name: 'Edit project' });
        await expect(dialog).toBeVisible();
        return dialog;
      }
    }

    await this.chooseProject(slug);
    return this.openDialog(slug ? 'Edit project' : 'Add project');
  }

  async chooseProject(slug?: string) {
    const projectPicker = this.page.getByLabel('Choose a project');
    if (await projectPicker.isVisible()) {
      await projectPicker.click();
      if (slug) {
        await this.page.getByRole('option', { name: new RegExp('\\(' + slug + '\\)$') }).click();
        return;
      }
      await this.page.getByRole('option', { name: 'New project', exact: true }).click();
      return;
    }

    if (slug) {
      const projectRow = this.page
        .getByRole('table', { name: 'Current projects' })
        .getByRole('row')
        .filter({ hasText: slug });
      await projectRow.getByRole('button', { name: /^Edit project\b/ }).click();
      const dialog = this.page.getByRole('dialog', { name: 'Edit project' });
      await expect(dialog).toBeVisible();
      await this.page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
    }
  }

  async chooseOption(combobox: Locator, optionLabel: string) {
    await combobox.click();
    await this.page.getByRole('option', { name: optionLabel, exact: true }).click();
  }

  async advanceProjectWizardToSave(dialog: Locator) {
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  }

  async returnProjectWizardToDetails(dialog: Locator) {
    await dialog.getByRole('button', { name: 'Back', exact: true }).click();
    await dialog.getByRole('button', { name: 'Back', exact: true }).click();
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
