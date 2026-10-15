package main

import (
	"context"
	"log"
	"net"
	"os"
	"os/signal"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	pb "github.com/you/hearth/gen/listingv2"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/reflection"
)

func main() {
	pool := mustPool(env("DATABASE_URL", "postgres://hearth:hearth@localhost:5432/hearth"))
	defer pool.Close()
	serve(env("LISTING_ADDR", ":50051"), buildGRPC(newPgRepo(pool)))
}

func serve(addr string, srv *grpc.Server) {
	lis, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatal(err)
	}
	go shutdownOnSignal(srv)
	log.Printf("listing-svc listening on %s", addr)
	log.Fatal(srv.Serve(lis))
}

// mustPool connects with retries: in Compose/Kubernetes the database may start after us.
func mustPool(url string) *pgxpool.Pool {
	for attempt := 1; attempt <= 30; attempt++ {
		if pool, err := connect(url); err == nil {
			return pool
		}
		log.Printf("waiting for database (attempt %d)...", attempt)
		time.Sleep(2 * time.Second)
	}
	log.Fatal("database unreachable")
	return nil
}

func connect(url string) (*pgxpool.Pool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	return pool, pool.Ping(ctx)
}

func buildGRPC(repo Repo) *grpc.Server {
	srv := grpc.NewServer(grpc.UnaryInterceptor(logInterceptor))
	pb.RegisterListingServiceServer(srv, newServer(repo))
	healthpb.RegisterHealthServer(srv, health.NewServer()) // k8s gRPC probes
	reflection.Register(srv)                               // lets grpcurl discover methods
	return srv
}

// logInterceptor is gRPC middleware: runs around every unary call.
func logInterceptor(ctx context.Context, req any, info *grpc.UnaryServerInfo, h grpc.UnaryHandler) (any, error) {
	start := time.Now()
	resp, err := h(ctx, req)
	log.Printf("method=%s dur=%s err=%v", info.FullMethod, time.Since(start), err)
	return resp, err
}

// shutdownOnSignal drains in-flight RPCs on SIGINT so deploys don't drop requests.
func shutdownOnSignal(srv *grpc.Server) {
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt)
	<-c
	srv.GracefulStop()
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
