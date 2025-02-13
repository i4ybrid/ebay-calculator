import fs from 'fs';
import csv from 'csv-parser';

const args = process.argv.slice(2);
const inputFile = args[0];
const outputFile = args[1] || null;

if (!inputFile) {
  console.error('Please provide an input CSV file.');
  process.exit(1);
}

const transactions = {};
const creditTypes = ['Order'];
const debitTypes = ['Shipping label', 'Refund', 'Other fee', 'Charge'];

fs.createReadStream(inputFile)
  .pipe(csv())
  .on('data', (row) => {
    // Use Order number or Legacy order ID for grouping
    const orderId = row['Order number'] || row['Legacy order ID'];
    if (!orderId) return; 

    // Initialize order grouping if not exists
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
    // Ignore payout types
    if (type === 'Payout') return;

    const amount = row['Net amount'] !== '--' ? parseFloat(row['Net amount']) : null;
    const transactionDate = row['Transaction creation date'] !== '--'
      ? new Date(row['Transaction creation date'])
      : null;
    const itemTitle = row['Item title'] !== '--' ? row['Item title'] : null;
    const quantity = row['Quantity'] !== '--' ? parseInt(row['Quantity']) : null;
    
    // Additional fields from the CSV
    const buyerName = row['Buyer name'] !== '--' ? row['Buyer name'] : null;
    const buyerUsername = row['Buyer username'] !== '--' ? row['Buyer username'] : null;
    const description = row['Description'] !== '--' ? row['Description'] : null;

    const fees = {
      finalValueFeeFixed: row['Final Value Fee - fixed'] !== '--' ? parseFloat(row['Final Value Fee - fixed']) : null,
      finalValueFeeVariable: row['Final Value Fee - variable'] !== '--' ? parseFloat(row['Final Value Fee - variable']) : null,
      regulatoryOperatingFee: row['Regulatory operating fee'] !== '--' ? parseFloat(row['Regulatory operating fee']) : null,
      veryHighItemNotAsDescribedFee: row['Very high "item not as described" fee'] !== '--'
        ? parseFloat(row['Very high "item not as described" fee'])
        : null,
      belowStandardPerformanceFee: row['Below standard performance fee'] !== '--'
        ? parseFloat(row['Below standard performance fee'])
        : null,
      internationalFee: row['International fee'] !== '--' ? parseFloat(row['International fee']) : null,
      charityDonation: row['Charity donation'] !== '--' ? parseFloat(row['Charity donation']) : null,
      depositProcessingFee: row['Deposit processing fee'] !== '--' ? parseFloat(row['Deposit processing fee']) : null
    };

    const transactionDetail = {
      type,
      netAmount: amount,
      transactionDate,
      itemTitle,
      quantity,
      fees,
      buyerName,
      buyerUsername,
      description
    };

    if (creditTypes.includes(type)) {
      transactions[orderId].credits += amount || 0;
    } else if (debitTypes.includes(type)) {
      transactions[orderId].debits += amount || 0;
    }

    transactions[orderId].details.push(transactionDetail);
  })
  .on('end', () => {
    if (outputFile) {
      fs.writeFileSync(outputFile, JSON.stringify(transactions, null, 2));
      console.log(`Processed transactions saved to ${outputFile}`);
    } else {
      console.log(JSON.stringify(transactions, null, 2));
    }
  });
