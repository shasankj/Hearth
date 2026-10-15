package main

import (
	"fmt"
	"strconv"
	"strings"

	pb "github.com/you/hearth/gen/listingv2"
)

const (
	defaultPageSize = 12
	maxPageSize     = 48
	defaultOrder    = "listed_at DESC"
)

// orderBy is a whitelist: user input never reaches SQL text, only these constants do.
var orderBy = map[string]string{
	"newest":     defaultOrder,
	"price_asc":  "price_usd ASC",
	"price_desc": "price_usd DESC",
	"beds_desc":  "beds DESC, price_usd ASC",
	"sqft_desc":  "sqft DESC",
}

var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

// builder accumulates WHERE conditions and their positional arguments ($1, $2, ...).
type builder struct {
	where []string
	args  []any
}

// add appends a condition; each "?" becomes the next $n placeholder and consumes one arg.
func (b *builder) add(cond string, args ...any) {
	for _, a := range args {
		b.args = append(b.args, a)
		cond = strings.Replace(cond, "?", "$"+strconv.Itoa(len(b.args)), 1)
	}
	b.where = append(b.where, cond)
}

func (b *builder) status(r *pb.SearchRequest) {
	status := r.Status
	if status == "" {
		status = "for_sale"
	}
	b.add("status = ?", status)
}

func (b *builder) text(r *pb.SearchRequest) {
	if r.City != "" {
		b.add("city = ?", r.City)
	}
	if q := strings.TrimSpace(r.Q); q != "" {
		like := "%" + likeEscaper.Replace(q) + "%"
		b.add("(tsv @@ websearch_to_tsquery('english', ?) OR address ILIKE ? OR city ILIKE ? OR neighborhood ILIKE ? OR zip ILIKE ?)", q, like, like, like, like)
	}
}

func (b *builder) minmax(col string, lo, hi int64) {
	if lo > 0 {
		b.add(col+" >= ?", lo)
	}
	if hi > 0 {
		b.add(col+" <= ?", hi)
	}
}

func (b *builder) numeric(r *pb.SearchRequest) {
	b.minmax("price_usd", r.MinPriceUsd, r.MaxPriceUsd)
	b.minmax("sqft", int64(r.MinSqft), int64(r.MaxSqft))
	b.minimums(r)
}

func (b *builder) minimums(r *pb.SearchRequest) {
	if r.MinBeds > 0 {
		b.add("beds >= ?", r.MinBeds)
	}
	if r.MinBaths > 0 {
		b.add("baths >= ?", r.MinBaths)
	}
	if r.MinYearBuilt > 0 {
		b.add("year_built >= ?", r.MinYearBuilt)
	}
}

func (b *builder) lists(r *pb.SearchRequest) {
	if len(r.PropertyTypes) > 0 {
		b.add("property_type = ANY(?)", r.PropertyTypes)
	}
	if len(r.Features) > 0 {
		b.add("features @> ?::text[]", r.Features) // array contains ALL requested features
	}
	if r.OpenHouseOnly {
		b.add("open_house_at IS NOT NULL AND open_house_at >= now()")
	}
}

func (b *builder) geo(r *pb.SearchRequest) {
	if bd := r.Bounds; bd != nil {
		b.add("lat BETWEEN ? AND ?", bd.South, bd.North)
		b.add("lng BETWEEN ? AND ?", bd.West, bd.East)
	}
}

type paging struct{ number, size int32 }

func normalizePage(r *pb.SearchRequest) paging {
	size := r.PageSize
	if size < 1 {
		size = defaultPageSize
	}
	return paging{number: max(r.Page, 1), size: min(size, maxPageSize)}
}

// prevPrice = the price before the latest change (0 if it never changed). Drives "price drop" badges.
const prevPrice = `COALESCE((SELECT ph.price_usd FROM price_history ph WHERE ph.listing_id = l.id
  AND ph.event IN ('listed','price_change') ORDER BY ph.date DESC, ph.id DESC OFFSET 1 LIMIT 1), 0)`

// selectCols is the one column list shared by every query, matching dbListing's `db` tags.
func selectCols(total string) string {
	return `id, status, property_type, address, city, state, zip, neighborhood, lat, lng, price_usd, beds,
  baths::float8 AS baths, sqft, lot_sqft, year_built, hoa_monthly, description, features, photos, agent_id,
  listed_at, open_house_at, ` + prevPrice + ` AS previous_price_usd,
  GREATEST(0, now()::date - listed_at::date)::int AS days_on_market, ` + total + ` AS total`
}

func (b *builder) all(r *pb.SearchRequest) {
	b.status(r)
	b.text(r)
	b.numeric(r)
	b.lists(r)
	b.geo(r)
}

func orderFor(sort string) string {
	if o, ok := orderBy[sort]; ok {
		return o
	}
	return defaultOrder
}

func buildSearch(r *pb.SearchRequest) (string, []any) {
	var b builder
	b.all(r)
	p := normalizePage(r)
	cols := selectCols("(COUNT(*) OVER())::int")
	return fmt.Sprintf("SELECT %s FROM listings l WHERE %s ORDER BY %s, id LIMIT %d OFFSET %d",
		cols, strings.Join(b.where, " AND "), orderFor(r.Sort), p.size, (p.number-1)*p.size), b.args
}
