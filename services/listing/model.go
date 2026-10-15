package main

import (
	"time"

	pb "github.com/you/hearth/gen/listingv2"
)

// dbListing mirrors one row; pgx.RowToStructByName maps columns to fields by their `db` tag.
type dbListing struct {
	ID               string     `db:"id"`
	Status           string     `db:"status"`
	PropertyType     string     `db:"property_type"`
	Address          string     `db:"address"`
	City             string     `db:"city"`
	State            string     `db:"state"`
	Zip              string     `db:"zip"`
	Neighborhood     string     `db:"neighborhood"`
	Lat              float64    `db:"lat"`
	Lng              float64    `db:"lng"`
	PriceUSD         int64      `db:"price_usd"`
	Beds             int32      `db:"beds"`
	Baths            float64    `db:"baths"`
	Sqft             int32      `db:"sqft"`
	LotSqft          int32      `db:"lot_sqft"`
	YearBuilt        int32      `db:"year_built"`
	HoaMonthly       int32      `db:"hoa_monthly"`
	Description      string     `db:"description"`
	Features         []string   `db:"features"`
	Photos           []string   `db:"photos"`
	AgentID          string     `db:"agent_id"`
	ListedAt         time.Time  `db:"listed_at"`
	OpenHouseAt      *time.Time `db:"open_house_at"`
	PreviousPriceUSD int64      `db:"previous_price_usd"`
	DaysOnMarket     int32      `db:"days_on_market"`
	Total            int32      `db:"total"`
}

func (d dbListing) core() *pb.Listing {
	return &pb.Listing{
		Id: d.ID, Status: d.Status, PropertyType: d.PropertyType, Address: d.Address, City: d.City,
		State: d.State, Zip: d.Zip, Neighborhood: d.Neighborhood, Lat: d.Lat, Lng: d.Lng,
	}
}

func (d dbListing) numbers(l *pb.Listing) {
	l.PriceUsd, l.Beds, l.Baths, l.Sqft = d.PriceUSD, d.Beds, d.Baths, d.Sqft
	l.LotSqft, l.YearBuilt, l.HoaMonthly = d.LotSqft, d.YearBuilt, d.HoaMonthly
	l.PreviousPriceUsd, l.DaysOnMarket = d.PreviousPriceUSD, d.DaysOnMarket
}

func (d dbListing) text(l *pb.Listing) {
	l.Description, l.Features, l.Photos = d.Description, d.Features, d.Photos
	l.ListedAt = d.ListedAt.UTC().Format(time.RFC3339)
	if d.OpenHouseAt != nil {
		l.OpenHouseAt = d.OpenHouseAt.UTC().Format(time.RFC3339)
	}
}

func (d dbListing) toPB() *pb.Listing {
	l := d.core()
	d.numbers(l)
	d.text(l)
	return l
}

func toPBList(items []dbListing) []*pb.Listing {
	out := make([]*pb.Listing, 0, len(items))
	for _, d := range items {
		out = append(out, d.toPB())
	}
	return out
}

// totalOf reads the COUNT(*) OVER() value that every row of a search carries.
func totalOf(items []dbListing) int32 {
	if len(items) == 0 {
		return 0
	}
	return items[0].Total
}
