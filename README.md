# eBay Profit/Loss Calculator

A Node.js CLI tool that calculates profit/loss from eBay sales by matching transaction data with supplier costs derived from email records.

## Features

- Import eBay transaction CSVs
- Automatically look up item costs from cached prices or search Thunderbird emails
- Calculate net profit/loss per transaction and overall
- Title cleaning with auto-search fallbacks
- Handles fee-only transactions (orderId "--")

## Prerequisites

- Node.js (v18+)
- npm or yarn
- Thunderbird email database (`global-messages-db.sqlite`) in the `data/` folder

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

Or if using yarn:

```bash
yarn install
```

## Setup

1. Place your eBay transaction CSV in the `data/` folder (e.g., `data/2025-transactions.csv`)
2. Place your Thunderbird `global-messages-db.sqlite` in the `data/` folder

### Finding Thunderbird Database

The Thunderbird database is typically located at:
- **Linux**: `~/.thunderbird/*.default-release/`
- **macOS**: `~/Library/Application Support/Thunderbird/Profiles/*.default-release/`
- **Windows**: `%APPDATA%\Thunderbird\Profiles\*.default-release\`

Copy `global-messages-db.sqlite` from your Thunderbird profile to the project's `data/` folder.

## Usage

### Full Pipeline

Run the complete workflow (convert CSV → fill costs → calculate P/L):

```bash
node src/index.js ./data/2025-transactions.csv
```

### Individual Steps

Convert CSV to JSON only:
```bash
node -e "
import('./src/index.js').then(m => {
  const fs = require('fs');
  const csv = require('csv-parser');
  const transactions = {};
  fs.createReadStream('./data/2025-transactions.csv')
    .pipe(csv())
    .on('data', (row) => {
      const orderId = row['Order number'] || row['Legacy order ID'];
      if (!orderId) return;
      if (!transactions[orderId]) {
        transactions[orderId] = { orderId, currency: row['Transaction currency'], credits: 0, debits: 0, details: [] };
      }
      const amount = row['Net amount'] !== '--' ? parseFloat(row['Net amount']) : null;
      if (row['Type'] === 'Order') transactions[orderId].credits += amount || 0;
      else if (['Shipping label', 'Refund', 'Other fee', 'Charge'].includes(row['Type'])) transactions[orderId].debits += amount || 0;
      transactions[orderId].details.push({ type: row['Type'], netAmount: amount, itemTitle: row['Item title'], quantity: row['Quantity'] });
    })
    .on('end', () => {
      fs.writeFileSync('./data/2025-transactions.json', JSON.stringify(transactions, null, 2));
      console.log('Done');
    });
});
"
```

Fill in missing costs (interactive):
```bash
node src/dataProcessing/fillInMissingCosts.js
```

Calculate profit/loss:
```bash
node src/dataProcessing/calculateTotalProfitLoss.js
```

## How It Works

1. **CSV Import**: Parses eBay transaction CSV and groups by order ID
2. **Cost Lookup**: 
   - Checks `itemCost.json` for cached prices
   - If not found, searches Thunderbird emails or prompts for manual entry
   - Title cleaning removes keywords like "NEW", "SEALED", "IN HAND"
3. **Profit Calculation**: 
   - `profitLoss = totalNetAmount - itemCost`
   - Rounded down to nearest penny

## Data Files

| File | Description |
|------|-------------|
| `data/[year]-transactions.csv` | Raw eBay export |
| `data/[year]-transactions.json` | Processed transactions |
| `data/itemCost.json` | Cached item costs |
| `data/global-messages-db.sqlite` | Thunderbird email database |

## License

ISC
