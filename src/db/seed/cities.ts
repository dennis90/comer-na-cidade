import { db } from '../index';
import { cities } from '../schema';
import { createId } from '@paralleldrive/cuid2';
import { slugify } from '../../lib/slugify';
import { readFileSync } from 'fs';
import { join } from 'path';

// Mapa: codigo_uf -> sigla
const UF_MAP: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA',
  '16': 'AP', '17': 'TO', '21': 'MA', '22': 'PI', '23': 'CE',
  '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE',
  '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
  '41': 'PR', '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT',
  '52': 'GO', '53': 'DF',
};

async function seed() {
  // Baixe o CSV e salve em src/db/seed/municipios.csv antes de rodar
  const csvPath = join(process.cwd(), 'src/db/seed/municipios.csv');
  const raw = readFileSync(csvPath, 'utf-8');
  const lines = raw.trim().split('\n');
  const header = lines[0].split(',');

  const ibgeIdx    = header.indexOf('codigo_ibge');
  const nameIdx    = header.indexOf('nome');
  const ufCodeIdx  = header.indexOf('codigo_uf');

  const rows = lines.slice(1).map((line) => {
    const cols = line.split(',');
    const ibgeCode = cols[ibgeIdx]?.trim();
    const name     = cols[nameIdx]?.trim().replace(/^"(.*)"$/, '$1');
    const ufCode   = cols[ufCodeIdx]?.trim();
    const state    = UF_MAP[ufCode] ?? ufCode;
    return { ibgeCode, name, state };
  }).filter((r) => r.ibgeCode && r.name && r.state);

  console.log(`Seeding ${rows.length} cities...`);

  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map((r) => ({
      id: createId(),
      slug: slugify(r.name),
      name: r.name,
      state: r.state,
      ibgeCode: r.ibgeCode,
      population: null,
    }));
    await db.insert(cities).values(batch).onConflictDoNothing();
    process.stdout.write(`\r${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }

  console.log('\n✅ Cities seeded.');
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
