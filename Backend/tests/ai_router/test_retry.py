import random

from app.ai_router.errors import ErrorKind
from app.ai_router.retry import RetryPolicies, RetryPolicy


def test_should_retry_only_retryable_kinds():
    policy = RetryPolicy(max_attempts=3)
    assert policy.should_retry(ErrorKind.SERVER_ERROR, attempt=1) is True
    assert policy.should_retry(ErrorKind.RATE_LIMITED, attempt=1) is True
    assert policy.should_retry(ErrorKind.CONNECTION, attempt=1) is True
    assert policy.should_retry(ErrorKind.TIMEOUT, attempt=1) is False  # not retried by default
    assert policy.should_retry(ErrorKind.BAD_REQUEST, attempt=1) is False
    assert policy.should_retry(ErrorKind.AUTH, attempt=1) is False


def test_should_retry_respects_max_attempts():
    policy = RetryPolicy(max_attempts=2)
    assert policy.should_retry(ErrorKind.SERVER_ERROR, attempt=1) is True
    assert policy.should_retry(ErrorKind.SERVER_ERROR, attempt=2) is False


def test_should_retry_skips_when_retry_after_too_long():
    policy = RetryPolicy(max_attempts=5, max_retry_after_s=5.0)
    assert policy.should_retry(ErrorKind.RATE_LIMITED, attempt=1, retry_after=3.0) is True
    assert policy.should_retry(ErrorKind.RATE_LIMITED, attempt=1, retry_after=30.0) is False


def test_delay_is_bounded_and_jittered():
    policy = RetryPolicy(base_delay_s=0.25, max_delay_s=2.0, multiplier=2.0)
    rng = random.Random(42)
    for attempt in range(1, 6):
        d = policy.delay_s(attempt, rng=rng)
        assert 0 <= d <= policy.max_delay_s

    # No retry storm: successive calls with the same seed do not collide on
    # one fixed delay -- the ceiling grows, but the draw is randomized.
    rng2 = random.Random(1)
    draws = {policy.delay_s(3, rng=rng2) for _ in range(20)}
    assert len(draws) > 1


def test_delay_never_shorter_than_retry_after():
    policy = RetryPolicy(base_delay_s=0.1, max_delay_s=1.0)
    rng = random.Random(0)
    d = policy.delay_s(1, retry_after=0.8, rng=rng)
    assert d >= 0.8


def test_retry_policies_per_provider_override():
    default = RetryPolicy(max_attempts=1)
    custom = RetryPolicy(max_attempts=5)
    policies = RetryPolicies(default=default, per_provider={"openrouter": custom})
    assert policies.for_provider("openrouter") is custom
    assert policies.for_provider("unknown") is default
