package offer

import "time"

const (
	TaskQueue       = "offers"
	SignalFinancing = "financing-approved"
	FinancingWait   = 72 * time.Hour // durable timer: survives worker restarts
)

type Input struct {
	OfferID   string
	ListingID string
	BuyerID   string
	AmountUSD int64
}

// QueryStatus returns the current step; Step* are its possible values (shown in the UI timeline).
const (
	QueryStatus           = "status"
	StepSubmitted         = "submitted"
	StepInspection        = "inspection"
	StepAwaitingFinancing = "awaiting_financing"
	StepClosing           = "closing"
	StepClosed            = "closed"
	StepExpired           = "expired"
)

// Result values are plain strings so they are easy to read in the Temporal UI.
const (
	StatusClosed  = "CLOSED"
	StatusExpired = "EXPIRED"
)
