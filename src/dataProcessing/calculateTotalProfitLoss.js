import fs from 'fs/promises'; // Import the fs module for reading files

async function calculateTotalProfitLoss(fileName) {
    try {
        const data = await fs.readFile(fileName, 'utf8'); // Read the file asynchronously
        const transactions = JSON.parse(data); // Parse the JSON data

        let totalProfitLoss = 0;

        for (const transaction of Object.values(transactions)) {
            for (const detail of transaction.details) {
                switch (detail.type) {
                    case 'Shipping label':
                        console.log(`Shipping Label: -${detail.netAmount}`);
                        totalProfitLoss -= detail.netAmount;
                        break;
                    case 'Order':
                        console.log(`Order: +${detail.netAmount} (${transaction.credits})`);
                        totalProfitLoss += transaction.credits - detail.netAmount;
                        break;
                    case 'Refund':
                        console.log(`Refund: -${detail.netAmount}`);
                        totalProfitLoss -= detail.netAmount;
                        break;
                    case 'Other fee':
                        console.log(`Other Fee: -${detail.netAmount}`);
                        totalProfitLoss -= detail.netAmount;
                        break;
                }
            }
        }

        console.log(`Total Profit/Loss: ${totalProfitLoss}`);
    } catch (error) {
        console.error('Error reading or parsing file:', error);
    }
}

// Replace '2024-transactions.json' with your actual filename
calculateTotalProfitLoss('./data/2024-transactions.json');