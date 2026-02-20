import fs from 'fs';
import csv from 'csv-parser';

const args = process.argv.slice(2);
const csvFile = args[0];

if (!csvFile) {
  console.error('Usage: node src/index.js <csv-file>');
  console.error('Example: node src/index.js ./data/2025-transactions.csv');
  process.exit(1);
}

const csvPath = csvFile.startsWith('./') ? csvFile : `./data/${csvFile}`;
const baseName = csvPath.replace('.csv', '');
const jsonFile = `${baseName}.json`;

console.log(`=== eBay Profit Calculator ===\n`);
console.log(`CSV: ${csvPath}`);
console.log(`Output JSON: ${jsonFile}\n`);

function convertCsvToJson(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const transactions = {};
    const creditTypes = ['Order'];
    const debitTypes = ['Shipping label', 'Refund', 'Other fee', 'Charge'];

    fs.createReadStream(inputPath)
      .pipe(csv())
      .on('data', (row) => {
        const orderId = row['Order number'] || row['Legacy order ID'];
        if (!orderId) return;

        if (!transactions[orderId]) {
          transactions[orderId] = {
            orderId,
            currency: row['Transaction currency'] !== '--' ? row['Transaction currency'] : null,
            credits: 0,
            debits: 0,
            details: []
          };
        }

        const type = row['Type'];
        if (type === 'Payout') return;

        const amount = row['Net amount'] !== '--' ? parseFloat(row['Net amount']) : null;
        
        if (creditTypes.includes(type)) {
          transactions[orderId].credits += amount || 0;
        } else if (debitTypes.includes(type)) {
          transactions[orderId].debits += amount || 0;
        }

        transactions[orderId].details.push({
          type,
          netAmount: amount,
          transactionDate: row['Transaction creation date'] !== '--' ? new Date(row['Transaction creation date']) : null,
          itemTitle: row['Item title'] !== '--' ? row['Item title'] : null,
          quantity: row['Quantity'] !== '--' ? parseInt(row['Quantity']) : null,
          buyerName: row['Buyer name'] !== '--' ? row['Buyer name'] : null,
          buyerUsername: row['Buyer username'] !== '--' ? row['Buyer username'] : null,
          description: row['Description'] !== '--' ? row['Description'] : null
        });
      })
      .on('end', () => {
        fs.writeFileSync(outputPath, JSON.stringify(transactions, null, 2));
        console.log(`Created ${outputPath}\n`);
        resolve();
      })
      .on('error', reject);
  });
}

async function run() {
  console.log('Step 1: Converting CSV to JSON...');
  await convertCsvToJson(csvPath, jsonFile);

  console.log('Step 2: Filling in missing costs...');
  const { processOrders } = await import('./dataProcessing/fillInMissingCosts.js');
  await processOrders(jsonFile);
  console.log('Done.\n');

  console.log('Step 3: Calculating profit/loss...');
  const { calculateTotalProfitLoss } = await import('./dataProcessing/calculateTotalProfitLoss.js');
  await calculateTotalProfitLoss(jsonFile);
  console.log('\n=== Complete ===');
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
