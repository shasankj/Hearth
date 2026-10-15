package main

import (
	"strings"
	"testing"

	pb "github.com/you/hearth/gen/listingv2"
)

func TestDefaultsToForSaleNewestFirst(t *testing.T) {
	sql, args := buildSearch(&pb.SearchRequest{})
	if !strings.Contains(sql, "status = $1") || args[0] != "for_sale" {
		t.Fatalf("status default missing: %s %v", sql, args)
	}
	if !strings.Contains(sql, "ORDER BY listed_at DESC, id LIMIT 12 OFFSET 0") {
		t.Fatalf("unexpected tail: %s", sql)
	}
}

func TestUserInputNeverReachesSQLText(t *testing.T) {
	evil := "x'; DROP TABLE listings; --"
	sql, args := buildSearch(&pb.SearchRequest{Q: evil, City: evil, Sort: evil})
	if strings.Contains(sql, "DROP") {
		t.Fatalf("injection leaked into SQL: %s", sql)
	}
	if len(args) != 7 { // status, city, q, 4x like
		t.Fatalf("want 7 args, got %d", len(args))
	}
}

func TestFiltersBecomeNumberedPlaceholders(t *testing.T) {
	r := &pb.SearchRequest{MinPriceUsd: 100, MaxPriceUsd: 900, MinBeds: 2, Features: []string{"pool"}}
	sql, args := buildSearch(r)
	for _, want := range []string{"price_usd >= $2", "price_usd <= $3", "beds >= $4", "features @> $5::text[]"} {
		if !strings.Contains(sql, want) {
			t.Errorf("missing %q in %s", want, sql)
		}
	}
	if len(args) != 5 {
		t.Fatalf("want 5 args, got %d", len(args))
	}
}

func TestPagingIsClamped(t *testing.T) {
	sql, _ := buildSearch(&pb.SearchRequest{Page: 3, PageSize: 9999})
	if !strings.Contains(sql, "LIMIT 48 OFFSET 96") {
		t.Fatalf("paging not clamped: %s", sql)
	}
}

func TestLikeWildcardsAreEscaped(t *testing.T) {
	_, args := buildSearch(&pb.SearchRequest{Q: "50%_off"})
	if args[2] != `%50\%\_off%` {
		t.Fatalf("got %v", args[2])
	}
}

func TestBoundsAddLatLngConditions(t *testing.T) {
	sql, args := buildSearch(&pb.SearchRequest{Bounds: &pb.Bounds{North: 2, South: 1, East: 4, West: 3}})
	if !strings.Contains(sql, "lat BETWEEN $2 AND $3") || args[1] != 1.0 || args[2] != 2.0 {
		t.Fatalf("bounds wrong: %s %v", sql, args)
	}
}
