class TokenBucketRateLimiter {
  constructor(tokensPerMinute = 60) {
    this.tokensPerMinute = tokensPerMinute;
    this.buckets = new Map(); // tenantId -> { tokens, lastRefill }
  }

  _refill(bucket) {
    const now = Date.now();
    const elapsedMinutes = (now - bucket.lastRefill) / 60000;
    const refill = elapsedMinutes * this.tokensPerMinute;
    if (refill > 0) {
      bucket.tokens = Math.min(this.tokensPerMinute, bucket.tokens + refill);
      bucket.lastRefill = now;
    }
  }

  take(tenantId, cost = 1) {
    if (!this.buckets.has(tenantId)) {
      this.buckets.set(tenantId, { tokens: this.tokensPerMinute, lastRefill: Date.now() });
    }
    const bucket = this.buckets.get(tenantId);
    this._refill(bucket);
    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return true;
    }
    return false;
  }
}

module.exports = new TokenBucketRateLimiter(30); // default 30 ops/min per tenant
