CREATE TABLE IF NOT EXISTS internship_tracks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  is_selectable boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS internship_tracks_name_lower_unique
  ON internship_tracks (lower(name));

INSERT INTO internship_tracks (name, is_selectable, sort_order)
VALUES
  ('Software Engineering', false, 10),
  ('UI/UX / Product Design', false, 20),
  ('Digital Marketing', true, 30),
  ('Business / Operations', false, 40)
ON CONFLICT (lower(name)) DO NOTHING;
