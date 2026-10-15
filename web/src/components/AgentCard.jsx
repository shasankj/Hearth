const stars = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));

function Details({ agent }) {
  return (
    <div>
      <b>{agent.name}</b>
      <small>{agent.brokerage}</small>
      <small className="rating" aria-label={`Rated ${agent.rating} out of 5`}>{stars(agent.rating)} {agent.rating} · {agent.sales} sales</small>
      <a href={`tel:${agent.phone}`}>{agent.phone}</a>
    </div>
  );
}

export function AgentCard({ agent }) {
  if (!agent) return null;
  return (
    <div className="agent">
      <span className="avatar big" aria-hidden="true">{agent.name[0]}</span>
      <Details agent={agent} />
    </div>
  );
}
