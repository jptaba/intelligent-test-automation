import { type Page, expect } from '@playwright/test';

export interface CheckoutInfo {
  firstName: string;
  lastName: string;
  postalCode: string;
}

/**
 * Page Object for the SauceDemo checkout flow.
 * Step one (/checkout-step-one.html) → Step two (/checkout-step-two.html) → Complete.
 */
export class CheckoutPage {
  constructor(private readonly page: Page) {}

  async expectOnStepOne(): Promise<void> {
    await expect(this.page).toHaveURL(/checkout-step-one\.html/);
  }

  async fillInfo(info: CheckoutInfo): Promise<void> {
    await this.page.getByPlaceholder('First Name').fill(info.firstName);
    await this.page.getByPlaceholder('Last Name').fill(info.lastName);
    await this.page.getByPlaceholder('Zip/Postal Code').fill(info.postalCode);
  }

  async continue(): Promise<void> {
    await this.page.getByRole('button', { name: 'Continue' }).click();
  }

  async expectOnStepTwo(): Promise<void> {
    await expect(this.page).toHaveURL(/checkout-step-two\.html/);
  }

  async finish(): Promise<void> {
    await this.page.getByRole('button', { name: 'Finish' }).click();
  }

  async expectOrderComplete(): Promise<void> {
    await expect(this.page.locator('.complete-header')).toContainText(
      'Thank you for your order',
    );
  }

  /** Returns the order total string from the summary, e.g. "Total: $32.39" */
  async getOrderTotal(): Promise<string> {
    return (
      (await this.page.locator('.summary_total_label').textContent()) ?? ''
    );
  }
}
