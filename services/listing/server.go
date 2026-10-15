package main

import (
	"context"
	"errors"
	"log"

	pb "github.com/you/hearth/gen/listingv2"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

var validStatus = map[string]bool{"": true, "for_sale": true, "for_rent": true, "pending": true, "sold": true}

// server implements pb.ListingServiceServer. Embedding Unimplemented... keeps us forward compatible.
type server struct {
	pb.UnimplementedListingServiceServer
	repo Repo
}

func newServer(r Repo) *server { return &server{repo: r} }

func validate(r *pb.SearchRequest) error {
	if !validStatus[r.Status] {
		return status.Errorf(codes.InvalidArgument, "unknown status %q", r.Status)
	}
	if len(r.Q) > 100 || len(r.Features) > 12 {
		return status.Error(codes.InvalidArgument, "query too large")
	}
	return nil
}

func (s *server) GetListing(ctx context.Context, req *pb.GetListingRequest) (*pb.Listing, error) {
	l, err := s.repo.Get(ctx, req.Id)
	return l, toStatus(err)
}

func (s *server) GetListings(ctx context.Context, req *pb.GetListingsRequest) (*pb.ListingsResponse, error) {
	items, err := s.repo.GetMany(ctx, req.Ids)
	return &pb.ListingsResponse{Listings: items}, toStatus(err)
}

func (s *server) SearchListings(ctx context.Context, q *pb.SearchRequest) (*pb.SearchResponse, error) {
	if err := validate(q); err != nil {
		return nil, err
	}
	items, total, err := s.repo.Search(ctx, q)
	p := normalizePage(q)
	return &pb.SearchResponse{Listings: items, Total: total, Page: p.number, PageSize: p.size}, toStatus(err)
}

func (s *server) SimilarListings(ctx context.Context, req *pb.SimilarRequest) (*pb.ListingsResponse, error) {
	limit := min(max(req.Limit, 1), 12)
	items, err := s.repo.Similar(ctx, req.Id, limit)
	return &pb.ListingsResponse{Listings: items}, toStatus(err)
}

func (s *server) MarketStats(ctx context.Context, req *pb.MarketRequest) (*pb.MarketResponse, error) {
	st := req.Status
	if st == "" {
		st = "for_sale"
	}
	cities, err := s.repo.Market(ctx, st)
	return &pb.MarketResponse{Cities: cities}, toStatus(err)
}

func sendAll(stream pb.ListingService_StreamListingsServer, items []*pb.Listing) error {
	for _, l := range items {
		if err := stream.Send(l); err != nil {
			return err
		}
	}
	return nil
}

// StreamListings pages through every match and streams them one by one (bulk export).
func (s *server) StreamListings(q *pb.SearchRequest, stream pb.ListingService_StreamListingsServer) error {
	q.PageSize = maxPageSize
	for q.Page = 1; ; q.Page++ {
		items, _, err := s.repo.Search(stream.Context(), q)
		if err != nil {
			return toStatus(err)
		}
		if err := sendAll(stream, items); err != nil || len(items) < maxPageSize {
			return err
		}
	}
}

// toStatus maps domain errors to gRPC codes (like HTTP 404 / 500). nil stays nil.
func toStatus(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, ErrNotFound) {
		return status.Error(codes.NotFound, err.Error())
	}
	log.Printf("internal error: %v", err) // details stay in our logs, never sent to clients
	return status.Error(codes.Internal, "internal error")
}
