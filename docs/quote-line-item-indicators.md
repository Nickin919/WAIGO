# Quote Line Item Indicators (Number 2 – Quotes)

## Design: How to show SPA vs Pricing Contract–affected items

- **Items affected by SPA (cost)**  
  - **Bold** part number + **asterisk (*)**.  
  - Not italic (keeps numbers easy to scan).  
  - Stored in DB as `QuoteItem.isCostAffected`.

- **Items where sell price is modified by the Pricing contract**  
  - **Bold** part number and sell price + **dagger (†)** in a **distinct color** (emerald/green) so they’re clearly different from SPA.  
  - Stored in DB as `QuoteItem.isSellAffected`.

## Legend (shown below the line items table when any marker is present)

- **\*** Cost affected by SPA/discount  
- **†** Sell price from pricing contract  

## Where it’s used

- **Quote Form (create/edit):** When adding products with a price contract selected and contract suggested sell price is applied, the line is marked † (and * if discount is applied). Table rows use bold + * / † and emerald styling for contract-priced lines; legend appears below the table.
- **Quote Detail (view):** Same styling and legend from persisted `isCostAffected` and `isSellAffected` on each item.

## Backend

- Create/update quote accepts optional `isCostAffected` and `isSellAffected` per item and persists them on `QuoteItem`.
