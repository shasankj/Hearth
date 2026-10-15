namespace go pricing

struct PriceRequest {
  1: required i64 listing_price,
  2: required string city,
  3: required i32 beds,
}

struct Estimate {
  1: i64 estimated,
  2: double confidence,
}

exception InvalidInput {
  1: string message,
}

service PricingService {
  Estimate estimate(1: PriceRequest req) throws (1: InvalidInput bad),
}
