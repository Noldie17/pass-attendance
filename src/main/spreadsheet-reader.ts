import { createRequire } from 'node:module'
import path from 'node:path'
import type { Sf2SheetData } from '@shared/sf2'
import { parseSf2Sheet } from '@shared/sf2'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx') as typeof import('xlsx')

export interface SpreadsheetSheet {
  name: string
  rows: unknown[][]
  sf2: Sf2SheetData | null
}

export interface SpreadsheetFile {
  filePath: string
  extension: '.xls' | '.xlsx'
  sheets: SpreadsheetSheet[]
}

export function readSpreadsheet(filePath: string): SpreadsheetFile {
  const extension = path.extname(filePath).toLocaleLowerCase()
  if (extension !== '.xls' && extension !== '.xlsx') {
    throw new Error('Choose an Excel file with the .xls or .xlsx extension.')
  }
  const workbook = XLSX.readFile(filePath, { cellDates: false, cellFormula: true })
  const sheets = workbook.SheetNames.map(name => {
    const worksheet = workbook.Sheets[name]
    if (!worksheet) return { name, rows: [], sf2: null }
    const ref = worksheet['!ref']
    if (!ref) return { name, rows: [], sf2: null }
    const range = XLSX.utils.decode_range(ref)
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      range: { s: { r: 0, c: 0 }, e: range.e },
      defval: null,
      raw: true,
      blankrows: true
    }) as unknown[][]
    return { name, rows, sf2: parseSf2Sheet(rows) }
  })
  if (!sheets.length || sheets.every(sheet => sheet.rows.every(row => row.every(value => value === null || value === undefined || value === '')))) {
    throw new Error('This workbook is empty. Choose a workbook containing a roster.')
  }
  return { filePath, extension, sheets }
}

export function sheetDataRows(sheet: SpreadsheetSheet, headerRow: number): { headers: string[]; rows: unknown[][]; rowCount: number } {
  if (!Number.isInteger(headerRow) || headerRow < 1 || headerRow > sheet.rows.length) {
    throw new Error('Choose a valid header row.')
  }
  const headersRow = sheet.rows[headerRow - 1] ?? []
  const width = Math.max(headersRow.length, ...sheet.rows.slice(headerRow).map(row => row.length), 0)
  const headers = Array.from({ length: width }, (_, index) => {
    const value = headersRow[index]
    return value === null || value === undefined || String(value).trim() === '' ? `Column ${index + 1}` : String(value).trim()
  })
  const dataRows = sheet.rows.slice(headerRow).filter(row => row.some(value => value !== null && value !== undefined && String(value).trim() !== ''))
  if (!dataRows.length) throw new Error('The selected worksheet has no roster rows below this header.')
  return { headers, rows: dataRows.slice(0, 5), rowCount: dataRows.length }
}
