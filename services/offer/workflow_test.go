package offer

import (
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"go.temporal.io/sdk/testsuite"
)

var in = Input{OfferID: "O1", ListingID: "L1", BuyerID: "B1", AmountUSD: 1}

func newEnv(t *testing.T) *testsuite.TestWorkflowEnvironment {
	env := (&testsuite.WorkflowTestSuite{}).NewTestWorkflowEnvironment()
	env.RegisterActivity(&Activities{})
	return env
}

func TestApprovedClosesDeal(t *testing.T) {
	env := newEnv(t)
	env.RegisterDelayedCallback(func() { env.SignalWorkflow(SignalFinancing, nil) }, time.Hour)
	env.ExecuteWorkflow(OfferWorkflow, in)
	var got string
	if err := env.GetWorkflowResult(&got); err != nil || got != StatusClosed {
		t.Fatalf("got %q err %v", got, err)
	}
}

func TestTimeoutExpires(t *testing.T) {
	env := newEnv(t)
	env.ExecuteWorkflow(OfferWorkflow, in) // test env skips time: 72h timer fires instantly
	var got string
	if err := env.GetWorkflowResult(&got); err != nil || got != StatusExpired {
		t.Fatalf("got %q err %v", got, err)
	}
}

func TestFailureCompensates(t *testing.T) {
	env := newEnv(t)
	a := &Activities{}
	env.OnActivity(a.ScheduleInspection, mock.Anything, mock.Anything).Return(errors.New("boom"))
	env.OnActivity(a.ReleaseListing, mock.Anything, mock.Anything).Return(nil).Once()
	env.ExecuteWorkflow(OfferWorkflow, in)
	if env.GetWorkflowError() == nil {
		t.Fatal("expected workflow error")
	}
	env.AssertExpectations(t) // fails if ReleaseListing (the saga undo) never ran
}

func TestStatusQueryTracksProgress(t *testing.T) {
	env := newEnv(t)
	env.RegisterDelayedCallback(func() {
		v, err := env.QueryWorkflow(QueryStatus)
		var step string
		if err != nil || v.Get(&step) != nil || step != StepAwaitingFinancing {
			t.Errorf("mid-flight step = %q err %v", step, err)
		}
		env.SignalWorkflow(SignalFinancing, nil)
	}, time.Hour)
	env.ExecuteWorkflow(OfferWorkflow, in)
	if err := env.GetWorkflowError(); err != nil {
		t.Fatal(err)
	}
}
