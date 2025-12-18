import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = path.resolve(__dirname, '../database/db.sqlite');
const schemaPath = path.resolve(__dirname, '../database/schema.sql');

export class DB {
    private db: Database.Database;

    constructor() {
        this.db = new Database(dbPath);
        this.init();
    }

    private init() {
        if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, 'utf-8');
            this.db.exec(schema);
        }
    }

    query(sql: string, params: any[] = []) {
        return this.db.prepare(sql).all(...params);
    }

    run(sql: string, params: any[] = []) {
        return this.db.prepare(sql).run(...params);
    }

    get(sql: string, params: any[] = []) {
        return this.db.prepare(sql).get(...params);
    }
}

export const db = new DB();










