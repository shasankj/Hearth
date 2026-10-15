package main

import (
	"context"
	"net"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	pb "github.com/you/hearth/gen/listingv2"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
)

// Integration tests: need the seeded Postgres.  TEST_DATABASE_URL=postgres://hearth:hearth@localhost:5432/hearth go test ./services/listing
func testRepo(t *testing.T) *pgRepo {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	return newPgRepo(pool)
}

func TestPgSearchByCityAndBeds(t *testing.T) {
	items, total, err := testRepo(t).Search(context.Background(), &pb.SearchRequest{City: "Boston", MinBeds: 2, PageSize: 5})
	if err != nil || total == 0 {
		t.Fatalf("total %d err %v", total, err)
	}
	for _, l := range items {
		if l.City != "Boston" || l.Beds < 2 || l.Status != "for_sale" {
			t.Fatalf("filter leaked: %+v", l)
		}
	}
}

func TestPgSortByPrice(t *testing.T) {
	items, _, err := testRepo(t).Search(context.Background(), &pb.SearchRequest{Sort: "price_asc", PageSize: 10})
	if err != nil || len(items) < 2 {
		t.Fatalf("err %v len %d", err, len(items))
	}
	for i := 1; i < len(items); i++ {
		if items[i].PriceUsd < items[i-1].PriceUsd {
			t.Fatal("not sorted ascending")
		}
	}
}

func TestPgFullTextAndFeatures(t *testing.T) {
	r := testRepo(t)
	items, _, err := r.Search(context.Background(), &pb.SearchRequest{Q: "seattle", Features: []string{"garage"}})
	if err != nil {
		t.Fatal(err)
	}
	for _, l := range items {
		if l.City != "Seattle" {
			t.Fatalf("text search leaked %s", l.City)
		}
	}
}

func TestPgDetailHasAgentAndHistory(t *testing.T) {
	l, err := testRepo(t).Get(context.Background(), "H-1001")
	if err != nil || l.Agent == nil || len(l.PriceHistory) == 0 {
		t.Fatalf("detail incomplete: %+v err %v", l, err)
	}
}

func TestPgSimilarExcludesSelf(t *testing.T) {
	items, err := testRepo(t).Similar(context.Background(), "H-1001", 4)
	if err != nil {
		t.Fatal(err)
	}
	for _, l := range items {
		if l.Id == "H-1001" {
			t.Fatal("similar returned the listing itself")
		}
	}
}

func TestPgMarketStats(t *testing.T) {
	cities, err := testRepo(t).Market(context.Background(), "for_sale")
	if err != nil || len(cities) < 5 || cities[0].MedianPriceUsd == 0 {
		t.Fatalf("stats wrong: %v err %v", cities, err)
	}
}

func bufClient(t *testing.T, repo Repo) pb.ListingServiceClient {
	lis := bufconn.Listen(1 << 20)
	srv := buildGRPC(repo)
	go srv.Serve(lis)
	t.Cleanup(srv.Stop)
	dial := func(context.Context, string) (net.Conn, error) { return lis.Dial() }
	conn, _ := grpc.NewClient("passthrough:///bufnet", grpc.WithContextDialer(dial), grpc.WithTransportCredentials(insecure.NewCredentials()))
	return pb.NewListingServiceClient(conn)
}

func TestGRPCNotFoundAndInvalidArgument(t *testing.T) {
	c := bufClient(t, testRepo(t))
	_, err := c.GetListing(context.Background(), &pb.GetListingRequest{Id: "nope"})
	if status.Code(err) != codes.NotFound {
		t.Fatalf("want NotFound, got %v", err)
	}
	_, err = c.SearchListings(context.Background(), &pb.SearchRequest{Status: "bogus"})
	if status.Code(err) != codes.InvalidArgument {
		t.Fatalf("want InvalidArgument, got %v", err)
	}
}

func TestGRPCStreamsEveryMatch(t *testing.T) {
	c := bufClient(t, testRepo(t))
	stream, err := c.StreamListings(context.Background(), &pb.SearchRequest{Status: "for_sale"})
	if err != nil {
		t.Fatal(err)
	}
	n := 0
	for ; ; n++ {
		if _, err := stream.Recv(); err != nil {
			break
		}
	}
	if n < 30 {
		t.Fatalf("streamed only %d listings", n)
	}
}
