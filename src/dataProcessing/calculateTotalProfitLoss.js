import fs from 'fs/promises';

export async function calculateTotalProfitLoss(fileName) {
    try {
        const data = await fs.readFile(fileName, 'utf8');
        const transactions = JSON.parse(data);

        let totalProfitLoss = 0;
        let orderCount = 0;

        for (const transaction of Object.values(transactions)) {
            if (transaction.profitLoss !== undefined) {
                totalProfitLoss += transaction.profitLoss;
                orderCount++;
                console.log(`Order ${transaction.orderId}: $${transaction.profitLoss.toFixed(2)}`);
            }
        }

        console.log(`\n=== Summary ===`);
        console.log(`Total Orders: ${orderCount}`);
        console.log(`Total Profit/Loss: $${totalProfitLoss.toFixed(2)}`);
    } catch (error) {
        console.error('Error reading or parsing file:', error);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    calculateTotalProfitLoss('./data/2025-transactions.json');
}