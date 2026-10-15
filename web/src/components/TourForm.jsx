import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { api } from '../api.js';
import { useToast } from '../state/ToastContext.jsx';

const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

function friendly(err, date) {
  if (err.status === 409) return `${date} is already booked. Pick another day.`;
  return err.message || 'Could not book. Please try again.';
}

async function book(listingId, date, notify) {
  try {
    await api.tour({ listingId, date });
    notify(`Tour booked for ${date}`, 'success');
    return { ok: true, date, message: `You're booked for ${date}.` };
  } catch (err) {
    return { ok: false, date, message: friendly(err, date) };
  }
}

function Submit({ label }) {
  const { pending } = useFormStatus(); // knows if the parent <form> action is running
  return <button type="submit" className="btn" disabled={pending}>{pending ? 'Booking…' : label}</button>;
}

// React 19 form action: React runs it, tracks pending state, and resets the form when it finishes.
function DateField({ defaultValue }) {
  return <label className="field"><span>Pick a day</span><input type="date" name="date" min={tomorrow()} defaultValue={defaultValue} required /></label>;
}

export function TourForm({ listingId }) {
  const { notify } = useToast();
  const [result, action] = useActionState((_prev, form) => book(listingId, form.get('date'), notify), null);
  return (
    <form action={action} className="stack" aria-label="Schedule a tour">
      <DateField defaultValue={result?.date} />
      <Submit label="Request tour" />
      {result && <p role="status" data-cy="tour-result" className={result.ok ? 'ok' : 'bad'}>{result.message}</p>}
    </form>
  );
}
