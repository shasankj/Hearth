package main

import (
	"context"
	"errors"

	pb "github.com/you/hearth/gen/listingv2"
)

// ErrNotFound is the domain error; the gRPC layer maps it to codes.NotFound.
var ErrNotFound = errors.New("listing not found")

// Repo hides storage. The server never sees SQL, so it can be tested with a fake.
type Repo interface {
	Get(ctx context.Context, id string) (*pb.Listing, error)
	GetMany(ctx context.Context, ids []string) ([]*pb.Listing, error)
	Search(ctx context.Context, req *pb.SearchRequest) ([]*pb.Listing, int32, error)
	Similar(ctx context.Context, id string, limit int32) ([]*pb.Listing, error)
	Market(ctx context.Context, status string) ([]*pb.CityStat, error)
}
