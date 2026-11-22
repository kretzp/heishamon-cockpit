import { useLanguage } from './i18n/Language';
import { getLocale, t } from './i18n/core';
import releaseNotes from 'virtual:release-notes';
import './about.css';

export function AboutPanel({ version }: { version?: string }) {
  const language = useLanguage();
  const notes = releaseNotes.translations[language];
  const date = new Intl.DateTimeFormat(getLocale(), { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(releaseNotes.date + 'T00:00:00Z'));
  return <section className="about-panel" aria-label={t('Über HeishaMon Cockpit')}>
    <article className="panel"><h2>{t('Über HeishaMon Cockpit')}</h2>
      <h3>{t('Ideen austauschen und diskutieren')}</h3>
      <p>{t('Du hast Fragen, Anregungen oder möchtest deine Erfahrungen teilen? Tausche dich mit anderen in den GitHub Discussions aus.')}</p>
      <a href="https://github.com/kretzp/heishamon-cockpit/discussions" target="_blank" rel="noopener noreferrer">{t('GitHub Discussions öffnen')}</a>
      <h3>{t('Fehler melden und Verbesserungen vorschlagen')}</h3>
      <p>{t('Du hast einen Fehler entdeckt oder einen konkreten Verbesserungsvorschlag? Erstelle ein GitHub Issue. Beschreibe möglichst genau, was passiert und welches Verhalten du erwartest.')}</p>
      <a href="https://github.com/kretzp/heishamon-cockpit/issues" target="_blank" rel="noopener noreferrer">{t('GitHub Issue erstellen')}</a>
      <p><a href="https://github.com/kretzp/heishamon-cockpit" target="_blank" rel="noopener noreferrer">{t('GitHub-Repository öffnen')}</a></p>
    </article>
    <article className="panel"><h2>{t('Version')}</h2><p>{t('Installierte Version: {0}', [version ?? releaseNotes.version])}</p></article>
    <article className="panel" aria-label={t('Release Notes')}><h2>{t('Was ist neu?')}</h2>
      <h3>{releaseNotes.version} · {notes.title}</h3><p><time dateTime={releaseNotes.date}>{date}</time></p>
      <ul>{notes.items.map((item, index) => <li key={index}>{item}</li>)}</ul>
    </article>
  </section>;
}
