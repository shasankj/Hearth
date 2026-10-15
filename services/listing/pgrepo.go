package main

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	pb "github.com/you/hearth/gen/listingv2"
)

// pgRepo is the Postgres implementation of Repo. Works unchanged against AWS RDS (just a different URL).
type pgRepo struct{ pool *pgxpool.Pool }

func newPgRepo(pool *pgxpool.Pool) *pgRepo { return &pgRepo{pool: pool} }

func (r *pgRepo) list(ctx context.Context, sql string, args ...any) ([]dbListing, error) {
	rows, err := r.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByName[dbListing])
}

func (r *pgRepo) Search(ctx context.Context, req *pb.SearchRequest) ([]*pb.Listing, int32, error) {
	sql, args := buildSearch(req)
	items, err := r.list(ctx, sql, args...)
	if err != nil {
		return nil, 0, err
	}
	return toPBList(items), totalOf(items), nil
}

func (r *pgRepo) one(ctx context.Context, id string) (dbListing, error) {
	items, err := r.list(ctx, "SELECT "+selectCols("1")+" FROM listings l WHERE id = $1", id)
	if err != nil {
		return dbListing{}, err
	}
	if len(items) == 0 {
		return dbListing{}, ErrNotFound
	}
	return items[0], nil
}

func (r *pgRepo) GetMany(ctx context.Context, ids []string) ([]*pb.Listing, error) {
	items, err := r.list(ctx, "SELECT "+selectCols("0")+" FROM listings l WHERE id = ANY($1) ORDER BY id", ids)
	return toPBList(items), err
}

// Get returns the full detail view: listing + agent + price history.
func (r *pgRepo) Get(ctx context.Context, id string) (*pb.Listing, error) {
	d, err := r.one(ctx, id)
	if err != nil {
		return nil, err
	}
	l := d.toPB()
	if l.Agent, err = r.agent(ctx, d.AgentID); err != nil {
		return nil, err
	}
	l.PriceHistory, err = r.history(ctx, id)
	return l, err
}

func (r *pgRepo) agent(ctx context.Context, id string) (*pb.Agent, error) {
	a := &pb.Agent{}
	row := r.pool.QueryRow(ctx, "SELECT id, name, brokerage, phone, email, bio, rating::float8, sales FROM agents WHERE id = $1", id)
	err := row.Scan(&a.Id, &a.Name, &a.Brokerage, &a.Phone, &a.Email, &a.Bio, &a.Rating, &a.Sales)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return a, err
}

func scanPoint(row pgx.CollectableRow) (*pb.PricePoint, error) {
	p := &pb.PricePoint{}
	return p, row.Scan(&p.Date, &p.PriceUsd, &p.Event)
}

func (r *pgRepo) history(ctx context.Context, id string) ([]*pb.PricePoint, error) {
	rows, err := r.pool.Query(ctx, "SELECT to_char(date, 'YYYY-MM-DD'), price_usd, event FROM price_history WHERE listing_id = $1 ORDER BY date, id", id)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, scanPoint)
}

// Similar = same city/status/type, price within +-30%, closest price first.
func (r *pgRepo) Similar(ctx context.Context, id string, limit int32) ([]*pb.Listing, error) {
	base, err := r.one(ctx, id)
	if err != nil {
		return nil, err
	}
	p := float64(base.PriceUSD)
	sql := "SELECT " + selectCols("0") + ` FROM listings l WHERE id <> $1 AND status = $2 AND city = $3 AND property_type = $4
  AND price_usd BETWEEN $5 AND $6 ORDER BY abs(price_usd - $7), id LIMIT $8`
	items, err := r.list(ctx, sql, id, base.Status, base.City, base.PropertyType, int64(p*0.7), int64(p*1.3), base.PriceUSD, limit)
	return toPBList(items), err
}

const marketSQL = `SELECT city, COUNT(*)::int,
  (percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd))::bigint,
  AVG(price_usd)::bigint,
  COALESCE(AVG(price_usd::float8 / NULLIF(sqft, 0)), 0)::float8,
  COALESCE(AVG(GREATEST(0, now()::date - listed_at::date)), 0)::float8
  FROM listings WHERE status = $1 GROUP BY city ORDER BY city`

func scanCity(row pgx.CollectableRow) (*pb.CityStat, error) {
	c := &pb.CityStat{}
	return c, row.Scan(&c.City, &c.Listings, &c.MedianPriceUsd, &c.AvgPriceUsd, &c.AvgPricePerSqft, &c.AvgDaysOnMarket)
}

func (r *pgRepo) Market(ctx context.Context, status string) ([]*pb.CityStat, error) {
	rows, err := r.pool.Query(ctx, marketSQL, status)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, scanCity)
}
