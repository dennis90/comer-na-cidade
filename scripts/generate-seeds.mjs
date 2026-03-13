import { createId } from '@paralleldrive/cuid2';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// --- Categories ---
const cats = [
  ['pizzaria', 'Pizzaria'],
  ['lanchonete', 'Lanchonete'],
  ['restaurante', 'Restaurante'],
  ['churrascaria', 'Churrascaria'],
  ['padaria', 'Padaria'],
  ['sorveteria', 'Sorveteria'],
  ['bar', 'Bar'],
  ['japones', 'Japonês'],
  ['hamburguer', 'Hambúrguer'],
  ['cafe', 'Café'],
  ['doces-e-bolos', 'Doces e Bolos'],
  ['marmitaria', 'Marmitaria'],
];

const catSQL = cats
  .map(([slug, name]) => {
    const safe = name.replace(/'/g, "''");
    return `INSERT OR IGNORE INTO category (id, name, slug) VALUES ('${createId()}', '${safe}', '${slug}');`;
  })
  .join('\n');

writeFileSync(join(root, 'seed-categories.sql'), catSQL + '\n');
console.log('✅ seed-categories.sql gerado');

// --- Cities ---
const UF_MAP = {
  '11':'RO','12':'AC','13':'AM','14':'RR','15':'PA',
  '16':'AP','17':'TO','21':'MA','22':'PI','23':'CE',
  '24':'RN','25':'PB','26':'PE','27':'AL','28':'SE',
  '29':'BA','31':'MG','32':'ES','33':'RJ','35':'SP',
  '41':'PR','42':'SC','43':'RS','50':'MS','51':'MT',
  '52':'GO','53':'DF',
};

function slugify(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const csv = readFileSync(join(root, 'src/db/seed/municipios.csv'), 'utf-8');
const lines = csv.trim().split('\n');
const header = lines[0].split(',');
const ibgeIdx = header.indexOf('codigo_ibge');
const nameIdx = header.indexOf('nome');
const ufCodeIdx = header.indexOf('codigo_uf');

const rows = lines.slice(1).map((line) => {
  const cols = line.split(',');
  const ibgeCode = cols[ibgeIdx]?.trim();
  const name = cols[nameIdx]?.trim().replace(/^"(.*)"$/, '$1');
  const ufCode = cols[ufCodeIdx]?.trim();
  const state = UF_MAP[ufCode] ?? ufCode;
  return { ibgeCode, name, state };
}).filter((r) => r.ibgeCode && r.name && r.state);

const cityLines = rows.map(({ ibgeCode, name, state }) => {
  const safeName = name.replace(/'/g, "''");
  const slug = slugify(name);
  return `INSERT OR IGNORE INTO city (id, name, slug, state, ibge_code) VALUES ('${createId()}', '${safeName}', '${slug}', '${state}', '${ibgeCode}');`;
});

writeFileSync(join(root, 'seed-cities.sql'), cityLines.join('\n') + '\n');
console.log(`✅ seed-cities.sql gerado com ${rows.length} cidades`);
