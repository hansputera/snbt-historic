import { Database } from 'bun:sqlite';
import { db } from '../src/database/client';

type Row = {
    id: number;
    utbk_no: string;
    name: string;
    date_of_birth: string;
    bidik_misi: number;
    passed: number;
    ptn?: string;
    ptn_code: string;
    prodi?: string;
    prodi_code: string;
    next_url?: string;
}

const executor = process.argv[0];
const args = process.argv.slice(executor?.toLowerCase().includes('bun') ? 2 : 1);
const [filename, year] = args;

if (!filename) throw new Error('Missing db filename');
if (!year || Number.isNaN(Number(year))) throw new Error('Missing or invalid year');

const currentYear = Number.parseInt(year, 10);
const currentDate = new Date();

// Validate year entry
const existingYears = await db.selectFrom('snbt_year')
    .select(['dumped_at', 'id'])
    .where('year', '=', currentYear)
    .execute();

let yearRefId: number = 0;

if (existingYears.length) {
    const sameMonthAndDate = existingYears.filter(y => {
        const dumpedDate = new Date(y.dumped_at);
        return dumpedDate.getDate() === currentDate.getDate() && 
        dumpedDate.getMonth() === currentDate.getMonth();
    });

    if (sameMonthAndDate.length > 1) {
        const needToDeletes = sameMonthAndDate.slice(1);
        await db.deleteFrom('snbt_year').where('id', 'in', needToDeletes.map(n => n.id))
            .execute();
        yearRefId = sameMonthAndDate.at(0)!.id;
    } else if (sameMonthAndDate.length === 1) {
        const rowId = sameMonthAndDate.at(0)!.id;
        const rows = await db.selectFrom('snbt_data').where('snbt_year_ref', '=', rowId)
            .select('id').execute();
        
        if (rows.length) {
            throw new Error('The dump is already exist on this year');
        } else {
            yearRefId = rowId;
        }
    } else {
        const row = await db.insertInto('snbt_year')
            .values({ year: currentYear })
            .executeTakeFirst();

        if (row) {
            if (!row.insertId) {
                const rows = await db.selectFrom('snbt_year').select('id').execute();
                const lastRow = rows.at(-1);

                yearRefId = lastRow!.id;
            } else {
                yearRefId = Number(row.insertId);
            }
        } else {
            throw new Error('Failed to create SNBT year');
        }
    }
} else {
    const row = await db.insertInto('snbt_year')
    .values({ year: currentYear })
    .executeTakeFirst();

    if (row) {
        if (!row.insertId) {
            const rows = await db.selectFrom('snbt_year').select('id').execute();
            const lastRow = rows.at(-1);

            yearRefId = lastRow!.id;
        } else {
            yearRefId = Number(row.insertId);
        }
    } else {
        throw new Error('Failed to create SNBT year');
    }
}

// SQLite connection
const fileSQL = new Database(filename);
const CHUNK_SIZE = 500; // Adjust based on SQLite parameter limits

await db.transaction().execute(async trx => {
    const allRows = fileSQL.prepare('SELECT * FROM snbt_dump').all() as Row[];
    const inserts = [];
    
    for (const row of allRows) {
        inserts.push({
            is_scholarship: row.bidik_misi === 1,
            name: row.name.replace(/\s+/g, ' '),
            date_of_birth: row.date_of_birth,
            snbt_year: currentYear,
            snbt_year_ref: Number(yearRefId),
            utbk_number: row.utbk_no,
            accepted: row.passed === 1,
            university_code: row.ptn_code === 'None' ? null : Number(row.ptn_code),
            university_name: row.ptn,
            study_code: row.prodi_code === 'None' ? null : Number(row.prodi_code),
            study_name: row.prodi,
            university_url: row.next_url,
        });
    }

    // Batch insert in chunks
    for (let i = 0; i < inserts.length; i += CHUNK_SIZE) {
        const chunk = inserts.slice(i, i + CHUNK_SIZE);
        await trx.insertInto('snbt_data')
            .values(chunk)
            .execute();
    }
});

fileSQL.close();