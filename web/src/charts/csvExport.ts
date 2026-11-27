import { exportFilename } from './exportFilename.ts';

export function csvDocument(header: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (value: string | number | null | undefined) => {
    if (value == null) return '';
    if (typeof value === 'number') return Number.isFinite(value) ? String(value).replace('.', ',') : '';
    return '"' + (/^[=+\-@\t\r\n]/.test(value) ? "'" : '') + value.replaceAll('"', '""') + '"';
  };
  return '\uFEFF' + header.join(';') + '\r\n' + rows.map(row => row.map(cell).join(';')).join('\r\n') + '\r\n';
}

export function downloadCsv(name: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = exportFilename(name, 'csv');
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
