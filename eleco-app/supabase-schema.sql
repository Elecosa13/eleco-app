-- =============================================
-- ELECO SA — Schéma base de données Supabase
-- À coller dans l'éditeur SQL de Supabase
-- =============================================

-- Table utilisateurs (employés + admins)
create table utilisateurs (
  id uuid primary key default gen_random_uuid(),
  prenom text not null unique,
  mot_de_passe text not null,
  role text not null check (role in ('employe', 'admin')),
  initiales text not null,
  actif boolean default true,
  created_at timestamptz default now()
);

-- Table chantiers
create table chantiers (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  adresse text,
  actif boolean default true,
  created_at timestamptz default now()
);

-- Table sous-dossiers d'un chantier
create table sous_dossiers (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid references chantiers(id) on delete cascade,
  nom text not null,
  created_at timestamptz default now()
);

-- Table rapports journaliers
create table rapports (
  id uuid primary key default gen_random_uuid(),
  sous_dossier_id uuid references sous_dossiers(id) on delete cascade,
  employe_id uuid references utilisateurs(id),
  date_travail date not null,
  heure_debut time not null,
  heure_fin time not null,
  remarques text,
  valide boolean default false,
  valide_par uuid references utilisateurs(id),
  valide_le timestamptz,
  created_at timestamptz default now()
);

-- Table matériaux utilisés dans un rapport
create table rapport_materiaux (
  id uuid primary key default gen_random_uuid(),
  rapport_id uuid references rapports(id) on delete cascade,
  ref_article text not null,
  designation text not null,
  unite text not null,
  quantite numeric not null,
  prix_net numeric,  -- visible admin seulement
  created_at timestamptz default now()
);

-- Table catalogue articles (chargé depuis CSV Sonepar/EM)
create table catalogue (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  nom text not null,
  unite text not null,
  categorie text,
  prix_net numeric,
  prix_perso numeric,  -- prix écrasé manuellement par le patron
  favori boolean default false,
  actif boolean default true
);

-- =============================================
-- Données initiales — Utilisateurs
-- =============================================
insert into utilisateurs (prenom, mot_de_passe, role, initiales) values
  ('paulo',  '1234',  'employe', 'PO'),
  ('bruno',  '1234',  'employe', 'BR'),
  ('ivo',    '1234',  'employe', 'IV'),
  ('noylan', '1234',  'employe', 'NO'),
  ('lucas',  'admin', 'admin',   'LU'),
  ('david',  'admin', 'admin',   'DA'),
  ('carlos', 'admin', 'admin',   'CA');

-- =============================================
-- Sécurité — Row Level Security (RLS)
-- Les employés ne voient PAS les prix
-- =============================================

-- Activer RLS sur toutes les tables
alter table utilisateurs        enable row level security;
alter table chantiers           enable row level security;
alter table sous_dossiers       enable row level security;
alter table rapports            enable row level security;
alter table rapport_materiaux   enable row level security;
alter table catalogue           enable row level security;

-- Pour l'instant on laisse tout ouvert (auth custom)
-- On verrouillera avec Supabase Auth dans une prochaine étape
create policy "Accès public temporaire" on utilisateurs    for all using (true);
create policy "Accès public temporaire" on chantiers       for all using (true);
create policy "Accès public temporaire" on sous_dossiers   for all using (true);
create policy "Accès public temporaire" on rapports        for all using (true);
create policy "Accès public temporaire" on rapport_materiaux for all using (true);
create policy "Accès public temporaire" on catalogue       for all using (true);
