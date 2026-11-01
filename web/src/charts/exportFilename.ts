export function exportFilename(name: string, extension: string, now = new Date()): string {
  const safeName = name.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/g, '') || 'Export';
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + '-' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
  return safeName + '-' + stamp + '.' + extension;
}
