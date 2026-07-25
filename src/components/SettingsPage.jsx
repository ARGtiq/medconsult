import { useState } from 'react'
import TemplateEditor from './TemplateEditor'
import AiSettings from './AiSettings'
import DataExport from './DataExport'
import ThemeSettings from './ThemeSettings'
import ChangelogModal from './ChangelogModal'
import SupabaseSettings from './SupabaseSettings'
import AiKeyBackup from './AiKeyBackup'

function TemplatesTab() {
  return <TemplateEditor />
}

function GeneralTab() {
  const [changelogOpen, setChangelogOpen] = useState(false)
  return (
    <div className="settings-tab">
      <div className="general-settings-block">
        <h4>Оформление</h4>
        <p className="settings-note-inline">Акцентный цвет интерфейса и тёмная тема.</p>
        <ThemeSettings />
      </div>
      <div className="general-settings-block">
        <h4>AI-провайдер</h4>
        <p className="settings-note-inline">Выбор модели и ключ для проверки взаимодействий, аллергий, аналогов, подсказок диагноза.</p>
        <AiSettings inline />
        <AiKeyBackup />
      </div>
      <div className="general-settings-block">
        <h4>Данные приложения</h4>
        <p className="settings-note-inline">Полный бэкап (пациенты, визиты, шаблоны, база лекарств) или перенос на другое устройство.</p>
        <DataExport />
      </div>
      <div className="general-settings-block">
        <h4>Supabase (синхронизация между устройствами)</h4>
        <SupabaseSettings />
        <details className="supabase-sql-details">
          <summary>SQL для настройки таблиц (один раз, в SQL Editor Supabase)</summary>
          <pre className="supabase-sql-block">{`create table if not exists medconsult_sync (
  id uuid primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
alter table medconsult_sync enable row level security;
create policy "own row select" on medconsult_sync for select
  using (auth.uid() = id);
create policy "own row insert" on medconsult_sync for insert
  with check (auth.uid() = id);
create policy "own row update" on medconsult_sync for update
  using (auth.uid() = id) with check (auth.uid() = id);

create table if not exists medconsult_secrets (
  id uuid primary key,
  cipher text not null,
  salt text not null,
  iv text not null,
  updated_at timestamptz not null default now()
);
alter table medconsult_secrets enable row level security;
create policy "own secrets select" on medconsult_secrets for select
  using (auth.uid() = id);
create policy "own secrets insert" on medconsult_secrets for insert
  with check (auth.uid() = id);
create policy "own secrets update" on medconsult_secrets for update
  using (auth.uid() = id) with check (auth.uid() = id);`}</pre>
        </details>
      </div>
      <div className="general-settings-block">
        <h4>История версий</h4>
        <button type="button" className="btn-secondary" onClick={() => setChangelogOpen(true)}>
          Что нового
        </button>
        {changelogOpen && <ChangelogModal onClose={() => setChangelogOpen(false)} />}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [tab, setTab] = useState('templates')

  return (
    <div className="settings-page">
      <div className="settings-tabs">
        <button type="button" className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}>
          Шаблоны
        </button>
        <button type="button" className={tab === 'general' ? 'active' : ''} onClick={() => setTab('general')}>
          Общие
        </button>
      </div>
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'general' && <GeneralTab />}
    </div>
  )
}
