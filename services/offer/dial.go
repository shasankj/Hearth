package offer

import (
	"os"

	"go.temporal.io/sdk/client"
)

// Dial connects to Temporal at $TEMPORAL_ADDRESS (default localhost:7233).
func Dial() (client.Client, error) {
	return client.Dial(client.Options{HostPort: os.Getenv("TEMPORAL_ADDRESS")}) // "" => default
}
