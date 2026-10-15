package main

import (
	"log"
	"os"

	"github.com/apache/thrift/lib/go/thrift"
	"github.com/you/hearth/gen/thrift/pricing"
)

func main() {
	addr := env("PRICING_ADDR", ":9090")
	server, err := newServer(addr)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("pricing-svc (thrift) listening on %s", addr)
	log.Fatal(server.Serve())
}

// newServer wires processor (what to call) + transport (socket) + protocol (wire format).
func newServer(addr string) (*thrift.TSimpleServer, error) {
	socket, err := thrift.NewTServerSocket(addr)
	if err != nil {
		return nil, err
	}
	proc := pricing.NewPricingServiceProcessor(handler{})
	tf := thrift.NewTBufferedTransportFactory(8192)
	pf := thrift.NewTBinaryProtocolFactoryDefault()
	return thrift.NewTSimpleServer4(proc, socket, tf, pf), nil
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
