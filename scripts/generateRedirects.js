import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { fileURLToPath } from 'url';

// Paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvFilePath = path.resolve(__dirname, './redirects.csv');
const redirectsFilePath = path.resolve(__dirname, '../dist/_redirects');

// Read and parse the CSV file
const urlMappings = [];

fs.createReadStream(csvFilePath)
  .pipe(csv())
  .on('data', (row) => {
    // Use the correct column names: "url" and "slug"
    const url = row.url;
    const slug = row.slug;
    urlMappings.push({ slug, url });
  })
  .on('end', () => {
    // Generate the _redirects content
    const redirects = urlMappings.map(({ slug, url }) => `/${slug} ${url} 301`).join('\n');

    // Write the redirects to the file
    fs.writeFileSync(redirectsFilePath, redirects);

    console.log('_redirects file has been generated from CSV!');
  });
