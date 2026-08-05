import fs from 'fs/promises';
import path from 'path';
import https from 'https';

const OUTPUT_PATH = path.resolve('src/data/striver-a2z.json');
const STRIVER_URL = 'https://takeuforward.org/dsa/strivers-a2z-sheet-learn-dsa-a-to-z';

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            fetchHtml(res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).toString())
              .then(resolve)
              .catch(reject);
            return;
          }

          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Request failed with status ${res.statusCode}`));
            return;
          }

          res.setEncoding('utf8');
          let body = '';
          res.on('data', (chunk) => {
            body += chunk;
          });
          res.on('end', () => resolve(body));
        }
      )
      .on('error', reject);
  });
}

function decodeFlightChunk(chunk) {
  return chunk
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function cleanValue(value) {
  return value && value !== '$undefined' ? value : null;
}

function extractSectionsFromHtml(html) {
  const flightChunks = [...html.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g)].map((match) => decodeFlightChunk(match[1]));
  const source = flightChunks.length > 0 ? flightChunks.join('') : html;

  const sectionsKeyIndex = source.indexOf('sections');
  if (sectionsKeyIndex === -1) {
    throw new Error('Could not find serialized sections data in page HTML.');
  }

  const startIndex = source.indexOf('[', sectionsKeyIndex);
  if (startIndex === -1) {
    throw new Error('Could not find sections array start in page HTML.');
  }

  let depth = 0;
  let inString = false;
  let endIndex = -1;

  for (let index = startIndex; index < source.length; index += 1) {
    let character = source[index];

    if (character === '\\' && source[index + 1] === '"') {
      character = '"';
      index += 1;
    }

    if (character === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (character === '[') {
      depth += 1;
      continue;
    }

    if (character === ']') {
      depth -= 1;
      if (depth === 0) {
        endIndex = index + 1;
        break;
      }
    }
  }

  if (endIndex === -1) {
    throw new Error('Could not locate the end of the sections array in page HTML.');
  }

  const rawSections = source.slice(startIndex, endIndex).replace(/\\"/g, '"');
  const normalizedSections = rawSections.replace(/\\\s*\r?\n\s*/g, ' ');
  return JSON.parse(normalizedSections);
}

async function scrapeStriverSheet() {
  try {
    console.log(`Loading ${STRIVER_URL}...`);
    const html = await fetchHtml(STRIVER_URL);

    console.log('Extracting serialized course data...');
    const sections = extractSectionsFromHtml(html);

    const data = sections.map((section, sectionIndex) => ({
      stepId: sectionIndex + 1,
      stepName: section.category_name,
      subSteps: (section.subcategories || []).map((subcategory, subIndex) => ({
        subStepName: subcategory.subcategory_name,
        problems: (subcategory.problems || []).map((problem, problemIndex) => ({
          id: `${sectionIndex + 1}.${subIndex + 1}.${problemIndex + 1}`,
          name: problem.problem_name,
          difficulty: String(problem.difficulty || 'easy').toLowerCase(),
          resourceLink: cleanValue(problem.youtube) || cleanValue(problem.article),
          practiceLink: cleanValue(problem.leetcode),
          articleLink: cleanValue(problem.article),
          youtubeLink: cleanValue(problem.youtube),
          status: 'todo',
        })),
      })),
    }));

    if (data.length === 0) {
      throw new Error('No steps scraped. Check page structure or selectors.');
    }

    const output = {
      sheetName: "Striver's A2Z DSA Course Sheet",
      sourceUrl: STRIVER_URL,
      note: `Auto-scraped on ${new Date().toISOString().split('T')[0]}. Update status manually as you progress.`,
      steps: data,
    };

    await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2));

    const totalProblems = data.reduce(
      (sum, s) => sum + s.subSteps.reduce((sub, ss) => sub + ss.problems.length, 0),
      0
    );

    console.log(`\n✓ Successfully scraped ${data.length} steps with ${totalProblems} total problems`);
    console.log(`✓ Saved to ${OUTPUT_PATH}`);
  } catch (error) {
    console.error('Scraping failed:', error.message);
    process.exit(1);
  }
}

scrapeStriverSheet();