import { useState } from 'react'
import AiSettings from './AiSettings'
import DataExport from './DataExport'
import ThemeSettings from './ThemeSettings'
import ChangelogModal from './ChangelogModal'
import SupabaseSettings from './SupabaseSettings'
import AiKeyBackup from './AiKeyBackup'
import ClinicalLockSettings from './ClinicalLockSettings'

// Настройки = как ведёт себя приложение (оформление, AI, синхронизация).
// Медицинское содержание (шаблоны, клинреки, лекарства, группы) — в Справочнике.
export default function SettingsPage() {
  const [changelogOpen, setChangelogOpen] = useState(false)
  return (
    <div className="settings-tab settings-page-single">
      <h2 className="guidelines-title">Настройки</h2>
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
        <h4>Защита данных пациентов</h4>
        <ClinicalLockSettings />
      </div>
      <div className="general-settings-block">
        <h4>Supabase (синхронизация между устройствами)</h4>
        <SupabaseSettings />
        <details className="supabase-sql-details">
          <summary>SQL для настройки таблиц (один раз, в SQL Editor Supabase)</summary>
          <pre className="supabase-sql-block">{`-- Отдельная таблица на каждый неймспейс (clinical/reference/workspace/system) —
-- та же логика, что и в разбивке localStorage. Повтори блок для всех четырёх.
create table if not exists medconsult_ns_clinical (
  id uuid primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
alter table medconsult_ns_clinical enable row level security;
create policy "own row select" on medconsult_ns_clinical for select using (auth.uid() = id);
create policy "own row insert" on medconsult_ns_clinical for insert with check (auth.uid() = id);
create policy "own row update" on medconsult_ns_clinical for update using (auth.uid() = id) with check (auth.uid() = id);

create table if not exists medconsult_ns_reference (
  id uuid primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
alter table medconsult_ns_reference enable row level security;
create policy "own row select" on medconsult_ns_reference for select using (auth.uid() = id);
create policy "own row insert" on medconsult_ns_reference for insert with check (auth.uid() = id);
create policy "own row update" on medconsult_ns_reference for update using (auth.uid() = id) with check (auth.uid() = id);

create table if not exists medconsult_ns_workspace (
  id uuid primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
alter table medconsult_ns_workspace enable row level security;
create policy "own row select" on medconsult_ns_workspace for select using (auth.uid() = id);
create policy "own row insert" on medconsult_ns_workspace for insert with check (auth.uid() = id);
create policy "own row update" on medconsult_ns_workspace for update using (auth.uid() = id) with check (auth.uid() = id);

create table if not exists medconsult_ns_system (
  id uuid primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
alter table medconsult_ns_system enable row level security;
create policy "own row select" on medconsult_ns_system for select using (auth.uid() = id);
create policy "own row insert" on medconsult_ns_system for insert with check (auth.uid() = id);
create policy "own row update" on medconsult_ns_system for update using (auth.uid() = id) with check (auth.uid() = id);

-- Отдельная таблица визитов — построчный синк (только изменённое), не блоком целиком
create table if not exists medconsult_visits (
  id uuid primary key,
  user_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table medconsult_visits enable row level security;
create policy "own visits select" on medconsult_visits for select using (auth.uid() = user_id);
create policy "own visits insert" on medconsult_visits for insert with check (auth.uid() = user_id);
create policy "own visits update" on medconsult_visits for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists medconsult_visits_updated_at_idx on medconsult_visits (user_id, updated_at);

-- Та же логика для пациентов — построчный синк
create table if not exists medconsult_patients (
  id uuid primary key,
  user_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table medconsult_patients enable row level security;
create policy "own patients select" on medconsult_patients for select using (auth.uid() = user_id);
create policy "own patients insert" on medconsult_patients for insert with check (auth.uid() = user_id);
create policy "own patients update" on medconsult_patients for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists medconsult_patients_updated_at_idx on medconsult_patients (user_id, updated_at);

-- Зашифрованные AI-ключи (для восстановления на другом устройстве) — отдельно, не привязано к неймспейсам
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
          <p className="settings-note-inline">
            Если раньше уже создавал таблицу <code>medconsult_sync</code> под старую версию — её можно удалить,
            она больше не используется (данные теперь по отдельным таблицам-неймспейсам выше).
          </p>
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
