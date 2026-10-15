package main

import (
	"context"
	"fmt"

	"github.com/you/hearth/gen/thrift/pricing"
)

var cityFactor = map[string]float64{"Boston": 1.05, "New York": 1.15, "Austin": 0.98}

// handler implements the generated pricing.PricingService interface.
type handler struct{}

func (handler) Estimate(ctx context.Context, req *pricing.PriceRequest) (*pricing.Estimate, error) {
	if err := validate(req); err != nil {
		return nil, err
	}
	est := float64(req.ListingPrice) * factorFor(req.City) * bedBonus(req.Beds)
	return &pricing.Estimate{Estimated: int64(est), Confidence: confidence(req.City)}, nil
}

func validate(req *pricing.PriceRequest) error {
	if req.ListingPrice <= 0 || req.Beds < 0 {
		return &pricing.InvalidInput{Message: fmt.Sprintf("bad request: %+v", req)}
	}
	return nil
}

func factorFor(city string) float64 {
	if f, ok := cityFactor[city]; ok {
		return f
	}
	return 1.0
}

func bedBonus(beds int32) float64 { return 1 + 0.01*float64(beds) }

func confidence(city string) float64 {
	if _, ok := cityFactor[city]; ok {
		return 0.9
	}
	return 0.5
}
