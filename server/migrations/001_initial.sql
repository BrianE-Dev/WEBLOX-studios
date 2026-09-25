CREATE TABLE IF NOT EXISTS accounts (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL,
  salt text NOT NULL,
  hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enquiries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  company text NOT NULL DEFAULT '',
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  project_type text NOT NULL,
  budget_range text NOT NULL,
  description text NOT NULL,
  timeline text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS internship_applications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_directory (
  email text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_portfolios (
  account_id text PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  public_slug text UNIQUE,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'unpublished')),
  draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  published jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
