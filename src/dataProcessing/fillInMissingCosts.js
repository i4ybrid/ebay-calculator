import { processItem } from '../ui/queryEmail.js';
import fs from 'fs';
import path from 'path';

const BACKUP_FILES_CAP = 3;
let TRANSACTIONS_FILENAME = './data/2025-transactions.json';
const ITEM_COST_FILENAME = './data/itemCost.json';

function loadOrDefaultJson(filename) {
  if (fs.existsSync(filename)) {
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
  }
  return {};
}

function createBackupJson(filename) {
  if (fs.existsSync(filename)) {
    const backupDir = path.dirname(filename);
    const baseName = path.basename(filename, '.json');
    
    const backups = fs.readdirSync(backupDir)
      .filter(file => file.startsWith(baseName) && file.endsWith('.json'))
      .sort((a, b) => fs.statSync(path.join(backupDir, a)).mtime - fs.statSync(path.join(backupDir, b)));

    if (backups.length >= BACKUP_FILES_CAP) {
      console.log(`Deleting ${backups[0]} to keep backups below ${BACKUP_FILES_CAP}`);
      fs.unlinkSync(path.join(backupDir, backups[0]));
    }

    const backupFilename = filename.replace('.json', `-backup-${Date.now()}.json`);
    fs.copyFileSync(filename, backupFilename);
  } else {
    console.warn(`File ${filename} does not exist. No backup created.`);
  }
}

export async function processOrders(filename) {
  if (filename) {
    TRANSACTIONS_FILENAME = filename;
  }
  
  const transactionsJson = loadOrDefaultJson(TRANSACTIONS_FILENAME);
  const itemCostJson = loadOrDefaultJson(ITEM_COST_FILENAME);

  createBackupJson(TRANSACTIONS_FILENAME);
  createBackupJson(ITEM_COST_FILENAME);

  for (const orderId of Object.keys(transactionsJson)) {
    const order = transactionsJson[orderId];

    if (order.costDetermined) {
      continue;
    }

    if (orderId === "--") {
      const totalNetAmount = order.details.reduce((sum, detail) => sum + (detail.netAmount || 0), 0);
      const profitLoss = Math.floor(totalNetAmount * 100) / 100;
      order.profitLoss = profitLoss;
      order.costPerUnit = 0;
      order.costDetermined = true;
      order.itemCost = 0;
      console.log(`Order #${orderId}: fee-only, profitLoss: $${profitLoss}`);
      transactionsJson[order.orderId] = order;
      fs.writeFileSync(TRANSACTIONS_FILENAME, JSON.stringify(transactionsJson, null, 2));
      continue;
    }

    const orderDetails = order.details.find(detail => detail.type === "Order");

    if (!orderDetails || !orderDetails.itemTitle) {
      console.error(`Could not find an itemTitle for order #${orderId}. Skipping...`);
      continue;
    }

    const { itemTitle, quantity } = orderDetails;
    console.log(`Processing: ${itemTitle} (qty: ${quantity})`);

    let unitPrice = itemCostJson[itemTitle];
    let itemCost = 0;

    if (!unitPrice) {
      const processedItem = await processItem(itemTitle);
      if (processedItem && processedItem.unitPrice) {
        unitPrice = processedItem.unitPrice;
      }
    } else {
      console.log(`Found cached price: $${unitPrice}`);
    }

    const totalNetAmount = order.details.reduce((sum, detail) => sum + (detail.netAmount || 0), 0);
    let profitLoss;

    if (unitPrice) {
      itemCost = unitPrice * quantity;
      profitLoss = Math.floor((totalNetAmount - itemCost) * 100) / 100;
      order.costPerUnit = unitPrice;
      order.itemCost = itemCost;
      order.costDetermined = true;
      console.log(`  costPerUnit: $${unitPrice}, qty: ${quantity}, itemCost: $${itemCost.toFixed(2)}, profitLoss: $${profitLoss}`);
    } else {
      profitLoss = Math.floor(totalNetAmount * 100) / 100;
      order.costDetermined = false;
      console.log(`  No cost found. profitLoss: $${profitLoss}`);
    }

    order.profitLoss = profitLoss;
    transactionsJson[order.orderId] = order;
    itemCostJson[itemTitle] = unitPrice || null;

    fs.writeFileSync(TRANSACTIONS_FILENAME, JSON.stringify(transactionsJson, null, 2));
    fs.writeFileSync(ITEM_COST_FILENAME, JSON.stringify(itemCostJson, null, 2));
  }

  console.log('Done processing orders.');
  return transactionsJson;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  processOrders();
}
