import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { api } from '../api.js';
import { useAuth } from '../state/AuthContext.jsx';

async function send(listing, form) {
  const body = { listingId: listing.id, name: form.get('name'), email: form.get('email'), phone: form.get('phone') || '', message: form.get('message') };
  try {
    await api.inquiry(body);
    return { ok: true, message: `Sent! ${listing.agent?.name ?? 'The agent'} will reply to ${body.email}.` };
  } catch (err) {
    return { ok: false, message: err.details?.[0]?.message ?? err.message };
  }
}

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn" disabled={pending}>{pending ? 'Sending…' : 'Send message'}</button>;
}

function Fields({ user, listing }) {
  return (
    <>
      <label className="field"><span>Name</span><input name="name" defaultValue={user?.name} required minLength={2} /></label>
      <label className="field"><span>Email</span><input name="email" type="email" defaultValue={user?.email} required /></label>
      <label className="field"><span>Phone (optional)</span><input name="phone" type="tel" /></label>
      <label className="field"><span>Message</span>
        <textarea name="message" rows={3} required minLength={5} defaultValue={`Hi, I'm interested in ${listing.address}. Is it still available?`} />
      </label>
    </>
  );
}

export function InquiryForm({ listing }) {
  const { user } = useAuth();
  const [result, action] = useActionState((_prev, form) => send(listing, form), null);
  if (result?.ok) return <p role="status" data-cy="inquiry-result" className="ok">{result.message}</p>;
  return (
    <form action={action} className="stack" aria-label="Contact agent">
      <Fields user={user} listing={listing} />
      <Submit />
      {result && <p role="alert" className="bad">{result.message}</p>}
    </form>
  );
}
