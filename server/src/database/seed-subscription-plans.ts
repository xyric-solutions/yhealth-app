/**
 * @file Seed Subscription Plans
 * @description Creates subscription plans for Balencia: Free, 1 Month, 3 Month.
 * New users get 1 week free trial (see subscription.service TRIAL_DAYS); then they can stay on Free or subscribe.
 * Run after subscription tables migration. Stripe IDs are left null; create products in Stripe via Admin or API.
 */

import { query, closePool } from './pg.js';

const PLANS = [
  {
    name: 'Free',
    slug: 'free',
    description: '1 week free full access, then continue with essential tracking and community.',
    amount_cents: 0,
    currency: 'usd',
    interval: 'month' as const,
    features: [
      '1 week free full access to all features',
      'Basic activity & mood tracking',
      'Daily step counter',
      'Water intake logging',
      '7-day history',
      'Community access',
    ],
    sort_order: 0,
  },
  {
    name: '1 Month',
    slug: 'monthly',
    description: 'Full access, billed monthly. Cancel anytime.',
    amount_cents: 999, // $9.99/mo
    currency: 'usd',
    interval: 'month' as const,
    features: [
      'Everything in Free',
      'Unlimited AI coaching & insights',
      'Advanced analytics & trends',
      'Nutrition & meal planning',
      'Sleep & recovery analysis',
      'Unlimited history',
      'Priority support',
    ],
    sort_order: 1,
  },
  {
    name: '3 Month',
    slug: '3-month',
    description: 'Full access, billed every 3 months. Best value.',
    amount_cents: 2499, // $24.99 per 3 months (~$8.33/mo)
    currency: 'usd',
    interval: 'month' as const,
    features: [
      'Everything in 1 Month',
      'Billed every 3 months — save vs monthly',
      'Unlimited AI coaching & insights',
      'Nutrition & meal planning',
      'Sleep & recovery analysis',
      'Priority support',
    ],
    sort_order: 2,
  },
];

async function seedSubscriptionPlans(): Promise<void> {
  const now = new Date().toISOString();
  console.log('🌱 Seeding subscription plans...\n');

  for (const plan of PLANS) {
    await query(
      `INSERT INTO subscription_plans (
        name, slug, description, stripe_price_id, stripe_product_id,
        amount_cents, currency, interval, features, is_active, sort_order, created_at, updated_at
      ) VALUES ($1, $2, $3, NULL, NULL, $4, $5, $6, $7::jsonb, true, $8, $9::timestamptz, $9::timestamptz)
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        amount_cents = EXCLUDED.amount_cents,
        currency = EXCLUDED.currency,
        interval = EXCLUDED.interval,
        features = EXCLUDED.features,
        sort_order = EXCLUDED.sort_order,
        updated_at = EXCLUDED.updated_at`,
      [
        plan.name,
        plan.slug,
        plan.description,
        plan.amount_cents,
        plan.currency,
        plan.interval,
        JSON.stringify(plan.features),
        plan.sort_order,
        now,
      ]
    );
    const intervalLabel = (plan.interval as string) === 'year' ? '/year' : '/mo';
    const price = `$${(plan.amount_cents / 100).toFixed(2)}${intervalLabel}`;
    console.log(`✅ ${plan.name} (${plan.slug}) — ${price}`);
  }

  // Reset test user's created_at so the 7-day free trial restarts (dev convenience)
  const updated = await query(
    `UPDATE users SET created_at = NOW() AT TIME ZONE 'UTC' WHERE email = 'salman@xyric.ai' RETURNING id`
  );
  if (updated.rows.length > 0) {
    console.log('✅ Reset salman@xyric.ai created_at to NOW (trial restarted)');
  }

  console.log('\n🎉 Subscription plans seed completed.');
  await closePool();
}

seedSubscriptionPlans().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
