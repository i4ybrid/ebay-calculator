# eBay Profit/Loss Calculator - Design Document

## 1. Project Overview

**Project Name:** eBay Profit/Loss Calculator  
**Type:** Node.js CLI Tool  
**Core Functionality:** Calculate profit/loss from eBay sales by importing transaction CSVs, matching item costs from email records, and generating profit reports.

This tool helps eBay sellers track their actual profitability by:
1. Importing eBay transaction CSVs
2. Cleaning item titles and looking up costs from cached prices or email records
3. Calculating net profit/loss per transaction and overall

---

## 2. Architecture

### 2.1 Data Flow

```
eBay CSV Export → index.js → [year]-transactions.json
                                    ↓
                           fillInMissingCosts.js
                                    ↓
                    Thunderbird ← queryEmail.js ← itemCost.json
                      SQLite
                                    ↓
                           calculateTotalProfitLoss.js
                                    ↓
                              Console Report
```

### 2.2 Directory Structure

```
ebay-calculator/
├── data/                              # Data storage
│   ├── global-messages-db.sqlite     # Thunderbird email database (read-only)
│   ├── itemCost.json                 # Cached item costs (itemTitle → unitPrice)
│   ├── [year]-transactions.json      # Processed transaction data
│   └── [year]-transactions.csv       # Raw eBay exports
├── src/
│   ├── index.js                      # Main entry point (orchestrator)
│   ├── dataProcessing/
│   │   ├── fillInMissingCosts.js     # Cost lookup/filling pipeline
│   │   ├── calculateTotalProfitLoss.js  # P/L calculation
│   │   └── syncItemCosts.js         # Sync costs from transactions to cache
│   ├── ui/
│   │   └── queryEmail.js            # Email search & cost extraction
│   └── util/
│       └── stringHelper.js           # String utilities
└── test/
    └── util/
        └── testStringHelper.js       # Unit tests
```

---

## 3. Core Components

### 3.1 index.js (Main Entry Point)

**Purpose:** Orchestrates the entire workflow in sequence.

**Command:**
```bash
node src/index.js ./data/2025-transactions.csv
```

**Workflow:**
1. Convert CSV to JSON
2. Fill in missing costs (interactive)
3. Calculate and display profit/loss

### 3.2 fillInMissingCosts.js

**Purpose:** Populate missing cost data for transactions.

**Input:** transactions.json, itemCost.json  
**Output:** Updated transactions.json, itemCost.json

**Key Logic:**
- Iterates through transactions where `costDetermined !== true`
- **Special case - orderId "--"**: Fee-only line items (no item). Calculates profitLoss from sum of netAmounts, sets costPerUnit=0, costDetermined=true
- **Special case - no Order detail**: Skips the transaction
- Looks up `itemTitle` in `itemCost.json` for cached unit price
- If not cached, invokes `queryEmail.js` to prompt user for cost
- Calculates profitLoss:
  - With cost: `profitLoss = totalNetAmount - (costPerUnit * quantity)` (rounded down to penny)
  - Without cost: `profitLoss = totalNetAmount` (rounded down to penny)
- Creates timestamped backups before modifying files
- Maintains max 3 backup files per data file

### 3.3 queryEmail.js

**Purpose:** Search Thunderbird emails to find item purchase costs.

**Input:** Item description string  
**Output:** Extracted or manually entered cost + quantity

**Key Features:**
- Searches Thunderbird SQLite database (`global-messages-db.sqlite`)
- Filters out eBay-authored emails (both sender and recipient)
- **Title Cleaning:**
  - Removes condition keywords: "in hand", "new", "sealed", "brand new", "free ship", "bnwt", "nwt", "vintage", "exclusive", "rare", etc.
  - Removes non-alphanumeric characters
- **Auto-Search Fallbacks:**
  - First tries cleaned title
  - If no results, tries last 50% of words
  - If still no results, prompts user for new search term
- Uses regex to extract prices (`$X.XX`) and quantities from email body
- Interactive CLI with email selection, price confirmation, manual entry fallback

### 3.4 calculateTotalProfitLoss.js

**Purpose:** Compute total profit/loss from processed transactions.

**Input:** transactions.json  
**Output:** Console report

**Logic:**
- Iterates through all transactions
- Sums the `profitLoss` field from each order
- Displays per-order profit and summary with total

---

## 4. Data Models

### 4.1 Transaction Record

```json
{
  "orderId": "02-12533-40278",
  "currency": "USD",
  "credits": 38.69,
  "debits": -12.3,
  "costPerUnit": 12.3,
  "costDetermined": true,
  "itemCost": 12.3,
  "profitLoss": 26.39,
  "details": [
    {
      "type": "Order",
      "netAmount": 38.69,
      "transactionDate": "2024-12-31T00:00:00.000Z",
      "itemTitle": "One Piece TCG English...",
      "quantity": 1,
      "buyerName": "Alan Hutchinson",
      "buyerUsername": "ace_ghintu"
    },
    {
      "type": "Shipping label",
      "netAmount": -5.37,
      "transactionDate": "2024-12-28T00:00:00.000Z",
      "itemTitle": null,
      "quantity": null
    }
  ]
}
```

### 4.2 Fee-Only Record (orderId: "--")

```json
{
  "orderId": "--",
  "currency": "USD",
  "credits": 0,
  "debits": -316.21,
  "costPerUnit": 0,
  "costDetermined": true,
  "itemCost": 0,
  "profitLoss": -316.21,
  "details": [
    {
      "type": "Shipping label",
      "netAmount": -23.82,
      ...
    }
  ]
}
```

### 4.3 Item Cost Cache

```json
{
  "One Piece TCG English The Three Brothers Ultra Starter Deck ST-13 New Sealed": 12.3,
  "Mattel Monster High Skullector Chucky and Tiffany Doll 2-Pack": 99.67
}
```

---

## 5. Dependencies

- **better-sqlite3**: Read Thunderbird email database
- **csv-parser**: Parse eBay CSV exports
- **@inquirer/prompts**: Interactive CLI prompts

---

## 6. Workflows

### 6.1 Main Processing Pipeline

```bash
node src/index.js ./data/2025-transactions.csv
```

This executes:
1. **CSV → JSON conversion** - Parses eBay CSV, groups by order ID
2. **Cost filling** - Interactive process to determine item costs
3. **Profit calculation** - Reports total P/L

### 6.2 Standalone Commands

```bash
# Calculate profit/loss only (if costs already filled)
node src/dataProcessing/calculateTotalProfitLoss.js

# Sync item costs from existing transactions to cache
node src/dataProcessing/syncItemCosts.js
```

---

## 7. Profit Calculation Formula

For each order:

```
totalNetAmount = sum of all detail netAmounts
itemCost = costPerUnit × quantity
profitLoss = totalNetAmount - itemCost
```

All calculations are rounded **down** to the nearest penny using `Math.floor(value * 100) / 100`.

---

## 8. Special Cases

| Case | Handling |
|------|----------|
| orderId = "--" | Fee-only items. profitLoss = sum of netAmounts, costPerUnit = 0 |
| No "Order" detail | Skip the transaction |
| Cost not in cache | Prompt user via email search or manual entry |
| Cost in cache | Use cached unitPrice automatically |

---

## 9. Future Improvements

1. **Automated Tests**: Add Jest or similar test framework
2. **Date Range Filtering**: Process transactions by specific date ranges
3. **Reporting**: Export detailed P/L reports (CSV/PDF)
4. **Cost History**: Track cost changes over time per item
5. **Multiple Platforms**: Support Amazon, Mercari, etc.
6. **Inventory Tracking**: Link transactions to inventory management
7. **Tax Handling**: Include sales tax in cost calculations
8. **Fuzzy Matching**: Match similar item titles automatically
