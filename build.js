
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const SOURCE_HTML_PATH = path.join(__dirname, 'index.html');
const OUTPUT_HTML_PATH = path.join(__dirname, 'catalog-for-upload.html');
const PLACEHOLDER = '/* PRELOADED_DATA_PLACEHOLDER */'; // Use the correct JS comment placeholder

/**
 * Finds the most recent backup file in the current directory.
 * @returns {string|null} The full path to the latest backup file, or null if not found.
 */
function findLatestBackupFile() {
  const directory = __dirname;
  try {
    const files = fs.readdirSync(directory);

    const backupFiles = files
      .filter(file => file.startsWith('catalog_backup_lazy') && file.endsWith('.json'))
      .map(file => ({
        name: file,
        time: fs.statSync(path.join(directory, file)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time); // Sort descending, newest first

    if (backupFiles.length > 0) {
      return path.join(directory, backupFiles[0].name);
    }
    return null;
  } catch (error) {
    console.error('Error scanning for backup files:', error);
    return null;
  }
}

async function build() {
  console.log('Starting build process to create a shareable catalog file...');
  
  const sourceJsonPath = findLatestBackupFile();

  // 1. Check if source files exist
  if (!fs.existsSync(SOURCE_HTML_PATH)) {
    console.error(`\n❌ Error: Source HTML file not found at ${SOURCE_HTML_PATH}`);
    return;
  }
  if (!sourceJsonPath) {
    console.error(`\n❌ Error: No backup file found matching the pattern 'catalog_backup_lazy*.json'.`);
    console.error('--> Please export your data from the application first (Export -> Export Data (Backup)).');
    return;
  }
  
  console.log(`Found latest backup file: ${path.basename(sourceJsonPath)}`);

  try {
    // 2. Read HTML template and find the placeholder
    console.log('Reading HTML template...');
    const htmlTemplate = fs.readFileSync(SOURCE_HTML_PATH, 'utf8');
    const placeholderIndex = htmlTemplate.indexOf(PLACEHOLDER);

    if (placeholderIndex === -1) {
        console.error(`\n❌ Error: Placeholder "${PLACEHOLDER}" not found in ${SOURCE_HTML_PATH}.`);
        console.error('--> The template file might be corrupted or outdated.');
        return;
    }

    // Split the HTML template into two parts around the placeholder
    const htmlPart1 = htmlTemplate.substring(0, placeholderIndex);
    const htmlPart2 = htmlTemplate.substring(placeholderIndex + PLACEHOLDER.length);

    // 3. Create a writable stream for the output file
    const outputStream = fs.createWriteStream(OUTPUT_HTML_PATH, { encoding: 'utf8' });

    // Use a promise to know when the stream is finished
    const finished = new Promise((resolve, reject) => {
        outputStream.on('finish', resolve);
        outputStream.on('error', reject);
    });

    // 4. Write the first part of the HTML
    outputStream.write(htmlPart1);

    // 5. Write the injection script prefix
    outputStream.write('window.PRELOADED_DATA = ');

    // 6. Create a readable stream for the large JSON file and pipe it to the output
    console.log('Streaming catalog data into HTML template...');
    const jsonStream = fs.createReadStream(sourceJsonPath, { encoding: 'utf8' });
    
    // Pipe the JSON data. When it's done, end will be false so we can write more.
    await new Promise((resolve, reject) => {
        jsonStream.on('end', resolve);
        jsonStream.on('error', reject);
        jsonStream.pipe(outputStream, { end: false });
    });

    // 7. Write the injection script suffix and the second part of the HTML
    outputStream.write(';');
    outputStream.write(htmlPart2);

    // 8. End the stream
    outputStream.end();

    await finished;

    console.log('\n✅ Build successful!');
    console.log(`Your file is ready to be uploaded to your server: ${OUTPUT_HTML_PATH}`);

  } catch (error) {
    console.error('\n❌ An unexpected error occurred during the build process:');
    console.error(error);
  }
}

// Run the build function
build();
