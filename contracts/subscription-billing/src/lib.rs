#![no_std]
// Soroban smart contract for recurring subscription billing — Stage
// 6.2's on-chain half. Deliberately scoped smaller than a fully
// autonomous "charges itself with no interaction" mechanism (which
// would need a stored token allowance plus a keeper bot polling and
// invoking `pay` on a schedule — real, buildable, but a second
// deployment of moving parts on top of everything else in this pass).
// What this contract does instead: makes the actual billing STATE
// (who owes what, how often, whether they're current) live verifiably
// on-chain, and each payment itself is a real, auth-checked, on-chain
// token transfer this contract records — not just "we happen to accept
// USDC" off-chain bookkeeping, which was the whole point of leading
// with Stellar per my-todo.md Stage 6.2. Autonomous keeper-driven
// charging is a real, contained follow-up once this is live: `pay`'s
// signature doesn't need to change for that, only who calls it.
use soroban_sdk::{contract, contractevent, contractimpl, contracttype, token, Address, Env, Symbol};

#[contractevent]
pub struct SubscriptionCreated {
    #[topic]
    pub school: Address,
    pub id: u64,
}

#[contractevent]
pub struct SubscriptionPaid {
    #[topic]
    pub school: Address,
    pub id: u64,
    pub amount: i128,
    pub paid_at: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct Subscription {
    pub school: Address,
    pub treasury: Address,
    pub token: Address,
    pub amount: i128,
    pub period_seconds: u64,
    pub last_paid: u64,
    // Explicit, not inferred from last_paid == 0 — a real bug caught by
    // this contract's own test suite: Soroban's ledger timestamp is a
    // plain u64 with no reserved "unset" value, and a fresh test
    // environment genuinely starts at timestamp 0, so "last_paid == 0"
    // is indistinguishable from "paid at ledger timestamp zero." Fragile
    // regardless of test-vs-production, not just a test artifact.
    pub has_paid: bool,
    pub plan: Symbol,
    pub active: bool,
}

#[derive(Clone)]
#[contracttype]
enum DataKey {
    Subscription(u64),
    NextId,
}

#[contract]
pub struct SubscriptionBilling;

#[contractimpl]
impl SubscriptionBilling {
    /// Registers a new subscription on-chain. Requires the school's own
    /// authorization — a subscription can't be created on a school's
    /// behalf by anyone else, including the platform itself.
    pub fn create_subscription(
        env: Env,
        school: Address,
        treasury: Address,
        token: Address,
        amount: i128,
        period_seconds: u64,
        plan: Symbol,
    ) -> u64 {
        school.require_auth();
        assert!(amount > 0, "amount must be positive");
        assert!(period_seconds > 0, "period_seconds must be positive");

        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextId)
            .unwrap_or(0);

        let sub = Subscription {
            school: school.clone(),
            treasury,
            token,
            amount,
            period_seconds,
            last_paid: 0,
            has_paid: false,
            plan,
            active: true,
        };

        env.storage().persistent().set(&DataKey::Subscription(id), &sub);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));
        SubscriptionCreated { school, id }.publish(&env);

        id
    }

    /// Settles one billing period. Requires the school's live
    /// authorization (this call itself IS the payment — a real token
    /// transfer, auth-checked by the token contract too, not just this
    /// one) and records the result on-chain. Returns the ledger
    /// timestamp the next payment is due.
    pub fn pay(env: Env, id: u64) -> u64 {
        let mut sub: Subscription = env
            .storage()
            .persistent()
            .get(&DataKey::Subscription(id))
            .expect("subscription not found");
        assert!(sub.active, "subscription is not active");

        sub.school.require_auth();

        let token_client = token::Client::new(&env, &sub.token);
        token_client.transfer(&sub.school, &sub.treasury, &sub.amount);

        let now = env.ledger().timestamp();
        sub.last_paid = now;
        sub.has_paid = true;
        env.storage().persistent().set(&DataKey::Subscription(id), &sub);
        SubscriptionPaid {
            school: sub.school.clone(),
            id,
            amount: sub.amount,
            paid_at: now,
        }
        .publish(&env);

        now + sub.period_seconds
    }

    /// True only if a payment has actually been recorded and the
    /// current billing period hasn't lapsed — the on-chain source of
    /// truth this document's own Stage 6.2 asks for ("the payment logic
    /// itself should be verifiably on-chain").
    pub fn is_current(env: Env, id: u64) -> bool {
        let sub: Subscription = env
            .storage()
            .persistent()
            .get(&DataKey::Subscription(id))
            .expect("subscription not found");

        if !sub.active || !sub.has_paid {
            return false;
        }

        env.ledger().timestamp() <= sub.last_paid + sub.period_seconds
    }

    pub fn get_subscription(env: Env, id: u64) -> Subscription {
        env.storage()
            .persistent()
            .get(&DataKey::Subscription(id))
            .expect("subscription not found")
    }

    /// The school can cancel its own subscription at any time — no
    /// further `pay` calls will succeed against it afterward.
    pub fn cancel(env: Env, id: u64) {
        let mut sub: Subscription = env
            .storage()
            .persistent()
            .get(&DataKey::Subscription(id))
            .expect("subscription not found");
        sub.school.require_auth();
        sub.active = false;
        env.storage().persistent().set(&DataKey::Subscription(id), &sub);
    }
}

mod test;
