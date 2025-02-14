import Database from 'better-sqlite3';
import { input, select, confirm } from '@inquirer/prompts';
import { convertSQLDate, sanitizeDescription } from '../util/stringHelper.js';

// Load Thunderbird's SQLite database
const db = new Database('./data/global-messages-db.sqlite', { readonly: true });

/**
 * Searches for emails matching the item description (excluding eBay emails) using regular expressions.
 */
function searchEmails(description) {
  description = `%${sanitizeDescription(description)}%`;
  const results = db.prepare(`
SELECT m.id, m.date, mt.c1subject as subject, mt.c0body as body, mt.c3author as author, mt.c4recipients as recipients
FROM messages m
JOIN messagesText_content mt ON m.id = mt.docid
WHERE (mt.c0body LIKE ? OR mt.c1subject LIKE ?)
  AND mt.c3author NOT LIKE '%ebay%'
  AND mt.c4recipients NOT LIKE '%ebay%'
ORDER BY m.date DESC
LIMIT 50;
  `).all(description, description);

  return results;
}

/**
 * Extracts price & quantity from email content using regex.
 */
function extractPriceAndQuantity(emailBody) {
  let priceMatches = emailBody.match(/\$([0-9]+(\.[0-9]{2})?)/g);
  let quantityMatch = emailBody.match(/(?:Qty|Quantity):?\s?(\d+)|(\d+)\s?[×x]|[×x]\s?(\d+)/i);

  let price = priceMatches ? parseFloat(priceMatches[priceMatches.length - 1].slice(1)) : null;
  let quantity = quantityMatch ? parseInt(quantityMatch[1] || quantityMatch[2] || quantityMatch[3]) : 1;

  return { price, quantity };
}

/**
 * Displays a list of email matches and lets the user pick one.
 */
async function selectEmail(matches) {
  console.log('\nTop email matches:');
  const choices = matches.map((email, index) => ({
    value: index + 1,
    name: `From: ${email.author}, Date: ${convertSQLDate(email.date)}, Subject: ${email.subject}`
  }));
  choices.push({ value: -2, name: 'Enter new search term' });
  choices.push({ value: 0, name: 'Enter manually' });

  const choice = await select({
    message: 'Select an email (enter the number or choose from the list): ',
    choices,
  });
  // Convert choice to a number
  let selectedChoice = parseInt(choice);
  if (selectedChoice === -2) {
    return "new_search";
  } else if (selectedChoice === 0) {
    return null;
  } else {
    return matches[selectedChoice - 1];
  }
}

/**
 * CLI function to enter price manually if no match is found.
 */
async function enterPriceManually() {
  const price = await input({
    message: 'Enter total cost (including tax/shipping): $ ',
    validate: value => {
      if (!value) return 'Please enter a number.';
      return true;
    },
    filter: value => parseFloat(value),
  });

  let quantity = await input({
    message: 'Enter the quantity of items purchased (default is 1): ',
    filter: value => parseInt(value),
  });
  if (!quantity || quantity === "" || quantity === 0) {
    quantity = 1;
  }

  console.log(`enterPriceManually: returning {price: ${price}, quantity: ${quantity}`);

  return { price: parseFloat(price), quantity };
}

/**
 * Main function to iterate through item descriptions & process emails.
 */
export async function processItems(itemDescriptions) {
  const results = [];
  for (let description of itemDescriptions) {
    let processedResult = await (processItem(description));
    results.push(processedResult);
  }
  return results;
}

export function closeDb() {
  db.close();
}

export async function processItem(description) {
  console.log(`\nSearching for: ${description}`);
  let matches = searchEmails(description);
  let selectedEmail = await selectEmail(matches);
  while (selectedEmail === 'new_search') {
    let newDescription = await input({ message: `Enter new search term [${description}]: ` });
    let newMatches = searchEmails(newDescription);
    selectedEmail = await selectEmail(newMatches);
  }

  let price, quantity;

  if (selectedEmail) {
    console.log(`\nSelected email:\n${selectedEmail.subject}\n${selectedEmail.body}`);
    const extracted = extractPriceAndQuantity(selectedEmail.body);

    if (extracted.price && extracted.quantity) {
      console.log(`Extracted Price: $${extracted.price}, Quantity: ${extracted.quantity}`);
      const accept = await confirm({
        message: 'Accept this price? ',
      });
      console.log(`accept = ${accept}`);
      if (accept === false) {
        ({ price, quantity } = await enterPriceManually());
      } else {
        ({ price, quantity } = extracted);
      }
    } else {
      console.log('Could not extract price/quantity. Enter manually.');
      ({ price, quantity } = await enterPriceManually());
    }
  } else {
    ({ price, quantity } = await enterPriceManually());
  }
  let unitPrice = price / quantity;
  console.log(`Final: ${description} -> Unit Price: $${unitPrice.toFixed(2)} (${quantity} items)`);
  return { description, unitPrice, quantity };
}
