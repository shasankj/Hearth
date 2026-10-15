import { fileURLToPath } from 'node:url';
import grpc from '@grpc/grpc-js';
import loader from '@grpc/proto-loader';

const PROTO = fileURLToPath(new URL('../../../proto/listing/v2/listing.proto', import.meta.url));
const OPTS = { longs: Number, defaults: true }; // int64 -> JS number; missing fields -> zero values
const DEADLINE_MS = 2000; // every call gets a deadline: never wait forever
// With a k8s headless Service, DNS returns every pod IP. Default pick_first would use only one.
const CHANNEL = {
  'grpc.service_config': JSON.stringify({ loadBalancingConfig: [{ round_robin: {} }] }),
};

export function loadClient(addr) {
  const def = loader.loadSync(PROTO, OPTS);
  const pkg = grpc.loadPackageDefinition(def).hearth.listing.v2;
  return new pkg.ListingService(addr, grpc.credentials.createInsecure(), CHANNEL);
}

// call turns the callback-style gRPC method into a Promise.
export function call(client, method, req) {
  const deadline = new Date(Date.now() + DEADLINE_MS);
  return new Promise((resolve, reject) => {
    client[method](req, { deadline }, (err, res) => (err ? reject(err) : resolve(res)));
  });
}
