import fs from 'fs';

const TRANSACTIONS_FILE = './data/2024-transactions.json';
const ITEM_COST_FILE = './data/itemCost.json';

function syncItemCosts() {
  const transactions = JSON.parse(fs.readFileSync(TRANSACTIONS_FILE, 'utf8'));
  let itemCost = {};

  if (fs.existsSync(ITEM_COST_FILE)) {
    itemCost = JSON.parse(fs.readFileSync(ITEM_COST_FILE, 'utf8'));
  }

  let added = 0;
  let skipped = 0;

  for (const order of Object.values(transactions)) {
    if (!order.costDetermined) {
      skipped++;
      continue;
    }

    const orderDetail = order.details.find(d => d.type === 'Order');
    if (!orderDetail?.itemTitle) {
      skipped++;
      continue;
    }

    const { itemTitle, quantity } = orderDetail;
    const { costPerUnit } = order;

    if (!itemTitle || costPerUnit === undefined) {
      skipped++;
      continue;
    }

    if (!itemCost[itemTitle]) {
      itemCost[itemTitle] = costPerUnit;
      added++;
      console.log(`Added: "${itemTitle}" = ${costPerUnit}`);
    }
  }

  fs.writeFileSync(ITEM_COST_FILE, JSON.stringify(itemCost, null, 2));
  console.log(`\nDone. Added ${added} items, skipped ${skipped}. Total items in itemCost.json: ${Object.keys(itemCost).length}`);
}

syncItemCosts();
