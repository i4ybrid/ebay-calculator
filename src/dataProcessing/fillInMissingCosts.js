import { processItem } from '../ui/queryEmail.js';
import fs from 'fs';
import path from 'path';

const BACKUP_FILES_CAP = 3;
const TRANSACTIONS_FILENAME = './data/2024-transactions.json';
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
    
    // Get a list of existing backup files
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

function setItemPrice(order, orderDetails, unitPrice, transactionsJson, itemCostJson, itemTitle) {
  order.costPerUnit = unitPrice;
  order.costDetermined = true;
  order.debits -= order.costPerUnit * orderDetails.quantity;

  transactionsJson[order.orderId] = order;
  itemCostJson[itemTitle] = unitPrice;

  //console.log(`itemCostJson[${itemTitle}] = ${itemCostJson[itemTitle]}`);
  fs.writeFileSync(TRANSACTIONS_FILENAME, JSON.stringify(transactionsJson, null, 2));
  fs.writeFileSync(ITEM_COST_FILENAME, JSON.stringify(itemCostJson, null, 2));
}

async function processOrders() {
  const transactionsJson = loadOrDefaultJson(TRANSACTIONS_FILENAME);
  const itemCostJson = loadOrDefaultJson(ITEM_COST_FILENAME);

  createBackupJson(TRANSACTIONS_FILENAME);
  createBackupJson(ITEM_COST_FILENAME);

  for (const orderId of Object.keys(transactionsJson)) {
    const order = transactionsJson[orderId];

    if (!order.costDetermined) {
      const orderDetails = order.details.find(detail => detail.type === "Order"); //Could be made more efficient

      console.log(`Existing price for [${orderDetails?.itemTitle}] = ${itemCostJson[orderDetails?.itemTitle]}`);

      if (!orderDetails || !orderDetails.itemTitle) {
        console.error(`Could not find an itemTitle for order #${orderId}. Skipping...`);
      } else if (itemCostJson[orderDetails.itemTitle]) {
        setItemPrice(order, orderDetails, itemCostJson[orderDetails.itemTitle], transactionsJson, itemCostJson, orderDetails.itemTitle);
      } else if (orderDetails) {
        const processedItem = await processItem(orderDetails.itemTitle);

        if (processedItem && processedItem.unitPrice) {
          setItemPrice(order, orderDetails, processedItem.unitPrice, transactionsJson, itemCostJson, orderDetails.itemTitle);
        } else {
          console.warn(`Couldn't figure out unitPrice for order #${orderId} [${orderDetails.itemTitle}]. You will need to re-run this script.`);
        }
      }
    }
  }

  return transactionsJson;
}

processOrders();
