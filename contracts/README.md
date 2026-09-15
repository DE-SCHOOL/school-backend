# DE-SCHOOL Soroban contracts

Real Stellar smart contracts backing DE-SCHOOL's on-chain billing. Not a
demo — `subscription-billing` is deployed to Stellar testnet and wired
into the live backend (`utilities/stellar/soroban.js`,
`controllers/stellar/subscription_payment.controller.js`).

## subscription-billing

An on-chain, verifiable record of a school's billing relationship with
the platform:

- `create_subscription(school, treasury, token, amount, period_seconds, plan) -> u64` —
  registers a subscription. Requires the school's own authorization.
- `pay(id) -> u64` — settles one billing period: a real token transfer
  from the school to the treasury, executed by the contract, requiring
  the school's live authorization. Returns the next-due ledger
  timestamp.
- `is_current(id) -> bool` — true only if a payment has actually been
  recorded and the period hasn't lapsed. The on-chain source of truth.
- `get_subscription(id) -> Subscription` — the full record.
- `cancel(id)` — the school can cancel its own subscription at any time.

### Scope, deliberately

This is **not** a fully autonomous "charges itself with no interaction"
mechanism — that needs a stored token allowance (`approve`/
`transfer_from`) plus a keeper bot polling and invoking `pay` on a
schedule. What's built instead makes the billing *state* (who owes
what, how often, whether they're current) live verifiably on-chain, and
each payment is a real, auth-checked transfer the contract itself
executes and records — genuinely "the payment logic is verifiably
on-chain," not just "we happen to accept USDC" off-chain bookkeeping.

**Good first issues for contributors**, in roughly increasing order of
scope:

1. A keeper script (Node or a standalone binary) that polls
   `is_current` for every registered on-chain subscription and calls
   `pay` once a token allowance mechanism exists — see #2.
2. Add `approve`/`transfer_from`-based charging so `pay` can be invoked
   by something other than the school itself (a keeper, on schedule),
   using a stored allowance the school grants once at registration
   time instead of re-authorizing every period.
3. A second contract for Stage 6.5's scholarship/bursary pooling —
   right now that's handled at the classic-Stellar layer (any payer can
   pay a fee `Invoice`'s memo — see `paymentService.js`); an on-chain
   pooled-fund version is a natural extension once there's a concrete
   need for pooling multiple donors' contributions before disbursement.
4. Events currently use `#[contractevent]` (`SubscriptionCreated`,
   `SubscriptionPaid`) but nothing indexes them yet — a small service
   that watches these and mirrors them into MongoDB would give a live
   on-chain activity feed for Stage 6.5's "Powered by Stellar"
   transparency page (not yet built, see my-todo.md Stage 6.5).

## Building

```sh
cd contracts
cargo test                                              # local unit tests, no network needed
cargo build --target wasm32v1-none --release -p subscription-billing
```

Note: use the `wasm32v1-none` target, not `wasm32-unknown-unknown` —
Rust 1.82+'s `wasm32-unknown-unknown` enables WASM features (reference
types, multi-value) Soroban's runtime doesn't yet support. This target
needs `rustup target add wasm32v1-none` (Rust 1.84+).

## Deploying (testnet)

```sh
cd ..   # school-backend/
node scripts/deploy-subscription-contract.js
```

Deploys a fresh contract instance plus its own throwaway test-USDC
issuer/SAC, and writes `contracts/.last-deploy.json` (gitignored) with
the IDs and keys. For the real backend app to use a deployment (rather
than each verification script deploying its own throwaway one), set:

```
SOROBAN_SUBSCRIPTION_CONTRACT_ID=<contractId from the deploy output>
SOROBAN_USDC_CONTRACT_ID=<usdcContractId from the deploy output>
```

For mainnet: don't reuse the testnet issuer step — the real, existing
USDC Stellar Asset Contract already exists (see
`utilities/stellar/asset.js`'s own comment for the verified issuer
address); only the `subscription-billing` contract itself needs
deploying there, the same way, on `STELLAR_NETWORK=mainnet`.

## Verifying

```sh
npm run verify:soroban-backend
```

Deploys a fresh contract + test-USDC issuer, then proves the **real
backend HTTP API** — not just the contract directly — can register a
school for on-chain billing and pay through it, against the live
deployed contract. See `scripts/verify-soroban-backend-integration.js`.
