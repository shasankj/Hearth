package main

import (
	"context"
	"net"
	"testing"
	"time"

	"github.com/apache/thrift/lib/go/thrift"
	"github.com/you/hearth/gen/thrift/pricing"
)

// startServer runs the real Thrift server on a free port and returns a connected client.
func startServer(t *testing.T) *pricing.PricingServiceClient {
	addr := freeAddr(t)
	srv, err := newServer(addr)
	if err != nil {
		t.Fatal(err)
	}
	go srv.Serve()
	t.Cleanup(func() { srv.Stop() })
	return dialClient(t, addr)
}

func freeAddr(t *testing.T) string {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()
	return l.Addr().String()
}

func dialClient(t *testing.T, addr string) *pricing.PricingServiceClient {
	sock, err := thrift.NewTSocket(addr)
	if err != nil {
		t.Fatal(err)
	}
	tr, err := thrift.NewTBufferedTransportFactory(8192).GetTransport(sock)
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; tr.Open() != nil; i++ { // server starts async: retry briefly
		if i > 50 {
			t.Fatal("server never came up")
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Cleanup(func() { tr.Close() }) // cleanups run LIFO: client closes before server.Stop
	return pricing.NewPricingServiceClientFactory(tr, thrift.NewTBinaryProtocolFactoryDefault())
}

func TestEstimateOverWire(t *testing.T) {
	c := startServer(t)
	res, err := c.Estimate(context.Background(), &pricing.PriceRequest{ListingPrice: 1000000, City: "Boston", Beds: 2})
	if err != nil || res.Estimated != 1071000 {
		t.Fatalf("got %+v err %v", res, err)
	}
}

func TestInvalidInputException(t *testing.T) {
	c := startServer(t)
	_, err := c.Estimate(context.Background(), &pricing.PriceRequest{ListingPrice: 0, City: "X", Beds: 1})
	if _, ok := err.(*pricing.InvalidInput); !ok {
		t.Fatalf("want InvalidInput, got %T %v", err, err)
	}
}
