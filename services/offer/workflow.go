package offer

import (
	"time"

	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

var acts *Activities // only used to reference method names

// progress is what the "status" query returns, so the UI can draw a timeline without touching the DB.
type progress struct{ step string }

func (p *progress) set(step string) { p.step = step }

// expose registers the "status" query handler.
func (p *progress) expose(ctx workflow.Context) error {
	return workflow.SetQueryHandler(ctx, QueryStatus, func() (string, error) { return p.step, nil })
}

// OfferWorkflow must be DETERMINISTIC: no time.Now, rand, goroutines or network calls here.
func OfferWorkflow(ctx workflow.Context, in Input) (string, error) {
	p := &progress{step: StepSubmitted}
	if err := p.expose(ctx); err != nil {
		return "", err
	}
	ctx = withOptions(ctx)
	if err := workflow.ExecuteActivity(ctx, acts.HoldListing, in).Get(ctx, nil); err != nil {
		return "", err
	}
	return finish(ctx, in, p)
}

// finish runs the remaining steps and undoes the hold (saga) if any of them fails.
func finish(ctx workflow.Context, in Input, p *progress) (string, error) {
	status, err := runSteps(ctx, in, p)
	if err != nil {
		compensate(ctx, in)
	}
	return status, err
}

func runSteps(ctx workflow.Context, in Input, p *progress) (string, error) {
	p.set(StepInspection)
	if err := workflow.ExecuteActivity(ctx, acts.ScheduleInspection, in).Get(ctx, nil); err != nil {
		return "", err
	}
	p.set(StepAwaitingFinancing)
	if !waitForFinancing(ctx) {
		p.set(StepExpired)
		return StatusExpired, nil
	}
	return closeDeal(ctx, in, p)
}

func closeDeal(ctx workflow.Context, in Input, p *progress) (string, error) {
	p.set(StepClosing)
	err := workflow.ExecuteActivity(ctx, acts.CloseDeal, in).Get(ctx, nil)
	p.set(StepClosed)
	return StatusClosed, err
}

// waitForFinancing blocks until the signal arrives or the durable timer fires.
func waitForFinancing(ctx workflow.Context) bool {
	sig := workflow.GetSignalChannel(ctx, SignalFinancing)
	timer := workflow.NewTimer(ctx, FinancingWait)
	approved := false
	sel := workflow.NewSelector(ctx)
	sel.AddReceive(sig, func(c workflow.ReceiveChannel, _ bool) { c.Receive(ctx, nil); approved = true })
	sel.AddFuture(timer, func(f workflow.Future) {})
	sel.Select(ctx)
	return approved
}

// compensate is the saga undo step; a disconnected context lets it run even if the workflow is cancelled.
func compensate(ctx workflow.Context, in Input) {
	dctx, _ := workflow.NewDisconnectedContext(ctx)
	_ = workflow.ExecuteActivity(dctx, acts.ReleaseListing, in).Get(dctx, nil)
}

func withOptions(ctx workflow.Context) workflow.Context {
	return workflow.WithActivityOptions(ctx, workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Second,
		RetryPolicy:         &temporal.RetryPolicy{MaximumAttempts: 5},
	})
}
