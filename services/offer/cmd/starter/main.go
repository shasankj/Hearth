package main

import (
	"context"
	"log"

	"github.com/you/hearth/services/offer"
	"go.temporal.io/sdk/client"
)

func main() {
	c, err := offer.Dial()
	if err != nil {
		log.Fatal(err)
	}
	defer c.Close()
	start(c, offer.Input{OfferID: "O-1", ListingID: "L1", BuyerID: "B-9", AmountUSD: 840000})
}

func start(c client.Client, in offer.Input) {
	run, err := c.ExecuteWorkflow(context.Background(), opts(in), offer.OfferWorkflow, in)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("started workflow id=%s run=%s", run.GetID(), run.GetRunID())
}

// opts uses the offer id as workflow id => starting twice is idempotent.
func opts(in offer.Input) client.StartWorkflowOptions {
	return client.StartWorkflowOptions{ID: "offer-" + in.OfferID, TaskQueue: offer.TaskQueue}
}
