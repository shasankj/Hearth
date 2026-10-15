-- Hearth schema. Runs once on first container start (docker-entrypoint-initdb.d).
-- On RDS: run these files with psql (see README "Using AWS RDS").
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agents (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  brokerage  TEXT NOT NULL,
  phone      TEXT NOT NULL,
  email      TEXT NOT NULL,
  bio        TEXT NOT NULL,
  rating     NUMERIC(2,1) NOT NULL,
  sales      INT NOT NULL
);

CREATE TABLE listings (
  id             TEXT PRIMARY KEY,
  status         TEXT NOT NULL CHECK (status IN ('for_sale','for_rent','pending','sold')),
  property_type  TEXT NOT NULL CHECK (property_type IN ('house','condo','townhouse','multi_family','land')),
  address        TEXT NOT NULL,
  city           TEXT NOT NULL,
  state          TEXT NOT NULL,
  zip            TEXT NOT NULL,
  neighborhood   TEXT NOT NULL,
  lat            DOUBLE PRECISION NOT NULL,
  lng            DOUBLE PRECISION NOT NULL,
  price_usd      BIGINT NOT NULL CHECK (price_usd > 0),     -- sale price, or monthly rent when for_rent
  beds           INT NOT NULL DEFAULT 0,
  baths          NUMERIC(3,1) NOT NULL DEFAULT 0,
  sqft           INT NOT NULL,
  lot_sqft       INT NOT NULL DEFAULT 0,
  year_built     INT NOT NULL,
  hoa_monthly    INT NOT NULL DEFAULT 0,
  description    TEXT NOT NULL,
  features       TEXT[] NOT NULL DEFAULT '{}',
  photos         TEXT[] NOT NULL DEFAULT '{}',              -- real image URLs (S3/CDN); empty => UI draws an illustration
  agent_id       TEXT NOT NULL REFERENCES agents(id),
  listed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  open_house_at  TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  tsv            TSVECTOR GENERATED ALWAYS AS (
                   to_tsvector('english', address || ' ' || city || ' ' || neighborhood || ' ' || description)
                 ) STORED
);
CREATE INDEX idx_listings_search   ON listings (status, city, price_usd);
CREATE INDEX idx_listings_geo      ON listings (lat, lng);
CREATE INDEX idx_listings_features ON listings USING GIN (features);
CREATE INDEX idx_listings_tsv      ON listings USING GIN (tsv);

CREATE TABLE price_history (
  id          SERIAL PRIMARY KEY,
  listing_id  TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  price_usd   BIGINT NOT NULL,
  event       TEXT NOT NULL CHECK (event IN ('listed','price_change','pending','sold','rented'))
);
CREATE INDEX idx_price_history_listing ON price_history (listing_id, date);

CREATE TABLE favorites (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id  TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE saved_searches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  query       JSONB NOT NULL,
  alerts      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE inquiries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT NOT NULL DEFAULT '',
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Owned by the Java inspection service. UNIQUE(listing_id, date) is the real double-booking guard.
CREATE TABLE tours (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  date        DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (listing_id, date)
);

CREATE TABLE offers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id     TEXT NOT NULL REFERENCES listings(id),
  user_id        UUID NOT NULL REFERENCES users(id),
  amount_usd     BIGINT NOT NULL CHECK (amount_usd > 0),
  financing      TEXT NOT NULL CHECK (financing IN ('cash','conventional','fha','va')),
  contingencies  TEXT[] NOT NULL DEFAULT '{}',
  closing_date   DATE,
  workflow_id    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_offers_user ON offers (user_id, created_at DESC);

CREATE SCHEMA analytics;   -- warehouse layer loaded by the Airflow DAG
CREATE TABLE analytics.city_stats (
  day DATE, city TEXT, listings INT, avg_price_usd BIGINT, PRIMARY KEY (day, city)
);
