import { app } from 'electron'
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { createRequire } from 'node:module'
import path from 'node:path'
import fs from 'node:fs/promises'

const require = createRequire(import.meta.url)
let SQL: SqlJsStatic

export class PassDatabase {
  private database!: Database
  private filePath!: string
  private writeQueue: Promise<void> = Promise.resolve()

  async initialize(): Promise<void> {
    const wasmPath = path.join(path.dirname(require.resolve('sql.js')), 'sql-wasm.wasm')
    SQL ??= await initSqlJs({ locateFile: () => wasmPath })
    this.filePath = path.join(app.getPath('userData'), 'pass.sqlite')
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    try {
      this.database = new SQL.Database(new Uint8Array(await fs.readFile(this.filePath)))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      this.database = new SQL.Database()
    }
    this.database.run(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS classes (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, section TEXT NOT NULL, subject TEXT NOT NULL,
        school_year TEXT NOT NULL, source_xlsx_path TEXT, col_map_json TEXT
      );
      CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT, class_id TEXT NOT NULL,
        student_id TEXT NOT NULL, name TEXT NOT NULL,
        UNIQUE(class_id, student_id), FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS attendance (
        class_id TEXT NOT NULL, student_id TEXT NOT NULL, date TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('P','L','A')), time_in TEXT,
        source TEXT NOT NULL CHECK(source IN ('webcam','manual')), remark TEXT,
        PRIMARY KEY(class_id, student_id, date),
        FOREIGN KEY(class_id, student_id) REFERENCES students(class_id, student_id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `)
    await this.persist()
  }

  all<T extends object>(sql: string, params: unknown[] = []): T[] {
    const statement = this.database.prepare(sql)
    try {
      statement.bind(params as (string | number | null | Uint8Array)[])
      const rows: T[] = []
      while (statement.step()) rows.push(statement.getAsObject() as T)
      return rows
    } finally { statement.free() }
  }

  get<T extends object>(sql: string, params: unknown[] = []): T | undefined {
    return this.all<T>(sql, params)[0]
  }

  async write<T>(operation: (database: Database) => T): Promise<T> {
    let result!: T
    const next = this.writeQueue.then(async () => {
      this.database.run('BEGIN IMMEDIATE')
      try {
        result = operation(this.database)
        this.database.run('COMMIT')
        await this.persist()
      } catch (error) {
        try { this.database.run('ROLLBACK') } catch { /* transaction may already be closed */ }
        throw error
      }
    })
    this.writeQueue = next.catch(() => undefined)
    await next
    return result
  }

  private async persist(): Promise<void> {
    const temporaryPath = `${this.filePath}.tmp`
    const handle = await fs.open(temporaryPath, 'w')
    try {
      await handle.writeFile(Buffer.from(this.database.export()))
      await handle.sync()
    } finally { await handle.close() }
    await fs.rename(temporaryPath, this.filePath)
  }
}
