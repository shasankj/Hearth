package offer

import (
	"context"
	"log"
)

// Activities hold side effects (DB, HTTP, gRPC). They may fail and are retried by Temporal.
type Activities struct{}

func (a *Activities) HoldListing(ctx context.Context, in Input) error {
	log.Printf("hold listing %s for offer %s", in.ListingID, in.OfferID)
	return nil
}

func (a *Activities) ReleaseListing(ctx context.Context, in Input) error {
	log.Printf("release listing %s (compensation)", in.ListingID)
	return nil
}

func (a *Activities) ScheduleInspection(ctx context.Context, in Input) error {
	log.Printf("inspection scheduled for %s", in.ListingID)
	return nil
}

func (a *Activities) CloseDeal(ctx context.Context, in Input) error {
	log.Printf("deal closed: offer %s", in.OfferID)
	return nil
}
