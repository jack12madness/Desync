# Desync Admin & Storefront Improvements — Round 2

Seven upgrades to the Desync store admin and product pages: simpler account products, drag-ordered categories, per-product System Requirements and Troubleshooting sections, a scroll fix, product-specific discount codes, and a self-updating promo banner.

## Who it's for
- Store staff adding and managing products
- Buyers viewing a product before purchase

## Core features and experience

1. **Simpler Add Account form** — the "Account type" selector disappears from the product form. All pasted stock is auto-detected as it already is, so staff just paste lines and go.

2. **Drag-to-order categories** — in the admin Categories tab, categories can be dragged into the desired order, and the storefront shows collections in exactly that order.

3. **System Requirements per product** — a new multi-line field on the product form. Buyers see it as a collapsible "System Requirements" section inside the product pop-up, styled as a clean requirements list. Hidden entirely when left blank.

4. **Troubleshooting per product** — a new field where staff add question/answer pairs (one issue + its fix per entry). Buyers see a collapsible "Troubleshooting" accordion in the product pop-up: each issue title expands to reveal the fix. Hidden entirely when left blank.

5. **Scroll fix** — the mouse scroll wheel works everywhere in the product edit window (currently the wheel does nothing, forcing tedious dragging).

6. **Product-specific discount codes** — when creating a coupon, staff can optionally tie it to one product. The discount then applies only to that product's line in the cart; everything else stays full price. Leaving it untied keeps today's store-wide behaviour.

7. **Self-updating promo banner** — the "10% off with DESYNC10" banner no longer shows a stale code. It automatically displays the currently active store-wide code and its discount, and disappears completely when no store-wide code is active.

## User flow
- Staff: open a category → edit a product → optionally fill System Requirements and Troubleshooting, set prices, save. Reorder categories by dragging. Create a coupon, optionally picking one product it applies to.
- Buyer: opens a product pop-up → reads the description → expands System Requirements and/or Troubleshooting if present → buys. At checkout, a product-specific code discounts only that product's line.

## UI/UX feel
- Matches the existing dark blue admin and storefront: collapsible sections with the same borders, spacing and typography as the current product pop-up; troubleshooting rows expand/collapse with a smooth animation; drag handles consistent with the existing product drag ordering.

## Implementation phases
- **Phase 1 (built now)**: all seven items above, including hiding blank sections and the banner auto-update.
- **Phase 2 (later, optional)**: richer troubleshooting (screenshots/links inside answers), bulk coupon management.
- **Phase 3 (later, optional)**: scheduled/flash-sale codes with start and end dates shown on the banner.

## Assumptions
- The account-type selector is removed for everyone; pasted stock keeps working exactly as before through auto-detection.
- Category drag ordering is available to any staff member who can access the Categories tab.
- System Requirements is a plain list (one requirement per line); Troubleshooting entries are a title plus a fix, entered as pairs.
- The promo banner shows the single active store-wide code (if several exist, the one with the highest discount); product-specific codes never appear on the banner.
- Existing DESYNC10 coupon stays in the admin list but only shows on the banner while it is active.
- Also fixed during this round: the occasionally flaky stock-email test caused by the shared email service rate limit (test-only issue, no store impact).
