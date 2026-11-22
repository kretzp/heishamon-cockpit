declare module 'virtual:release-notes' {
  const notes: { version: string; date: string; translations: Record<import('./i18n/core').Language, { title: string; items: string[] }> };
  export default notes;
}
