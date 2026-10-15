package main

import (
	"log"

	"github.com/you/hearth/services/offer"
	"go.temporal.io/sdk/worker"
)

func main() {
	c, err := offer.Dial()
	if err != nil {
		log.Fatal(err)
	}
	defer c.Close()
	w := worker.New(c, offer.TaskQueue, worker.Options{})
	w.RegisterWorkflow(offer.OfferWorkflow)
	w.RegisterActivity(&offer.Activities{})
	log.Fatal(w.Run(worker.InterruptCh()))
}
