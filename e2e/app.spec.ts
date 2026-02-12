import { test, expect } from '@playwright/test';

test.describe('Woman AIQA App', () => {
    test.beforeEach(async ({ page }) => {
        // Go to the starting url before each test.
        await page.goto('/');
    });

    test('has title and main header', async ({ page }) => {
        // Expect a title "to contain" a substring.
        await expect(page).toHaveTitle(/女人我最大/);

        // Check for the main H1 or key text
        await expect(page.locator('h1')).toContainText('女人我最大');
        await expect(page.getByText('延伸問答產生器')).toBeVisible();
    });

    test('displays database upload section', async ({ page }) => {
        // Check if step 1 exists
        await expect(page.getByText('資料庫設定')).toBeVisible();
        // Check if dropzone or upload button exists (assuming DatabaseUploader renders something)
        // We might need to inspect DatabaseUploader code to be precise, but text search is good 1st step
        await expect(page.getByText(/請手動上傳文章資料庫/)).toBeVisible();
    });

    test('displays article input section', async ({ page }) => {
        // Check if step 2 exists - matches "文章內容" inside the H3 uniquely
        await expect(page.getByRole('heading', { name: '文章內容' })).toBeVisible();

        // Matches the specific placeholder in ArticleInput.tsx
        await expect(page.getByPlaceholder('請在此貼上文章內容...')).toBeVisible();
    });

    test('generate button is initially disabled', async ({ page }) => {
        const btn = page.getByRole('button', { name: '產生延伸問答' });
        await expect(btn).toBeVisible();
        // It should be disabled if no input
        await expect(btn).toBeDisabled();
    });
});
