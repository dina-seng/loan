import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db.js';
import { hashPassword } from '../../src/auth.js';

const app = createApp();
let agent;
let deliveryId;
let productId;
let dadPaymentId;
let closingJanId;
let closingFebId;
let settlementId;

const head = (key) => ({ 'Idempotency-Key': key });
const post = (path, body, key) => agent.post(path).set(head(key)).send(body);
const balanceOf = async () => Number((await agent.get('/api/v1/dashboard')).body.data.balance);

async function clean() {
  await prisma.auditLog.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.session.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.deliveryItem.deleteMany();
  await prisma.productDelivery.deleteMany();
  await prisma.lendingTransaction.deleteMany();
  await prisma.periodClosing.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  await prisma.accountSettings.deleteMany();
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes('test')) {
    throw new Error('Integration tests require TEST_DATABASE_URL pointing at a separate test database.');
  }
  await clean();
  await prisma.accountSettings.create({
    data: { id: 'main', businessName: 'Business Ledger', ownerName: 'ប៉ា', partnerName: 'អ៊ូដុំ', openingBalance: 100000n, openingDate: new Date('2000-01-01T00:00:00.000Z') },
  });
  await prisma.user.create({
    data: { username: 'dad', passwordHash: await hashPassword('test-pass-123'), displayName: 'ប៉ា', role: 'OWNER' },
  });
  const product = await prisma.product.create({ data: { name: 'ស៊ីម៉ង់', unit: 'កាប់', unitPrice: 1000n } });
  productId = product.id;
  agent = request.agent(app);
  const login = await agent.post('/api/v1/auth/login').send({ username: 'dad', password: 'test-pass-123' });
  expect(login.status).toBe(200);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Business Ledger API — financial correctness', () => {
  it('authenticates and exposes account data', async () => {
    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.username).toBe('dad');
    expect(me.body.data.account.openingBalance).toBe('100000');
  });

  it('1–4. lending, delivery and both payment directions move the balance correctly', async () => {
    const lend = await post('/api/v1/lending', { transactionDate: '2020-01-02', amount: '400000', note: 'ឱ្យខ្ចី' }, 'key-lending-001');
    expect(lend.status).toBe(201);
    expect(await balanceOf()).toBe(500000);

    const delivery = await post('/api/v1/deliveries', {
      reference: 'DO-2020-001', deliveryDate: '2020-01-03',
      items: [{ productId, quantity: '2.500', unitPrice: '80000' }],
    }, 'key-delivery-001');
    expect(delivery.status).toBe(201);
    deliveryId = delivery.body.data.id;
    expect(delivery.body.data.totalAmount).toBe('200000');
    expect(delivery.body.data.items[0].lineTotal).toBe('200000');
    expect(await balanceOf()).toBe(300000);

    const repay = await post('/api/v1/payments', {
      paymentDate: '2020-01-04', direction: 'OUDOM_TO_DAD', amount: '150000', method: 'cash',
    }, 'key-payment-001');
    expect(repay.status).toBe(201);
    expect(await balanceOf()).toBe(150000);

    expect((await agent.get('/api/v1/dashboard')).body.data.direction).toBe('OUDOM_OWES_DAD');
  });

  it('12. previews a custom period and 7. closing does not double count', async () => {
    const preview = await agent.get('/api/v1/period-closings/preview?startDate=2020-01-01&endDate=2020-01-31');
    expect(preview.status).toBe(200);
    expect(preview.body.data.openingBalance).toBe('100000');
    expect(preview.body.data.totalLent).toBe('400000');
    expect(preview.body.data.totalDelivered).toBe('200000');
    expect(preview.body.data.totalReceived).toBe('150000');
    expect(preview.body.data.closingBalance).toBe('150000');
    expect(preview.body.data.canClose).toBe(true);

    const closed = await post('/api/v1/period-closings', { startDate: '2020-01-01', endDate: '2020-01-31', note: 'ខួបទី១' }, 'key-close-001');
    expect(closed.status).toBe(201);
    closingJanId = closed.body.data.id;
    expect(closed.body.data.closingBalance).toBe('150000');
    expect(await balanceOf()).toBe(150000); // closing itself changes nothing
  });

  it('13. backdated writes cannot silently modify a closed period', async () => {
    const response = await post('/api/v1/lending', { transactionDate: '2020-01-05', amount: '1000' }, 'key-lending-backdated');
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('PERIOD_CLOSED');
    expect(await balanceOf()).toBe(150000);
  });

  it('8. historical statement snapshots remain unchanged', async () => {
    const statement = await agent.get(`/api/v1/period-closings/${closingJanId}/statement`);
    expect(statement.status).toBe(200);
    expect(statement.body.data.closing.snapshot.closingBalance).toBe('150000');
    expect(statement.body.data.closing.snapshot.totalLent).toBe('400000');
    expect(statement.body.data.entries).toHaveLength(3);
  });

  it('6. outstanding balance carries into the next period', async () => {
    const preview = await agent.get('/api/v1/period-closings/preview?startDate=2020-02-01&endDate=2020-02-29');
    expect(preview.body.data.openingBalance).toBe('150000');
    expect(preview.body.data.previousClosingBalance).toBe('150000');
  });

  it('4 + 10. Dad payment increases the balance and voiding reverses it', async () => {
    const paid = await post('/api/v1/payments', {
      paymentDate: '2020-02-02', direction: 'DAD_TO_OUDOM', amount: '50000', method: 'bank',
    }, 'key-payment-002');
    expect(paid.status).toBe(201);
    dadPaymentId = paid.body.data.id;
    expect(await balanceOf()).toBe(200000);

    const voided = await post(`/api/v1/payments/${dadPaymentId}/void`, { reason: 'កត់ត្រាខុស' }, 'key-void-payment');
    expect(voided.status).toBe(200);
    expect(voided.body.data.voidedAt).not.toBeNull();
    expect(await balanceOf()).toBe(150000);
    const audit = await agent.get('/api/v1/reports/statements');
    expect(audit.status).toBe(200);
  });

  it('5. partial settlement is recorded separately and residual carries forward', async () => {
    const settled = await post('/api/v1/settlements', {
      paymentDate: '2020-02-03', amount: '30000', direction: 'OUDOM_TO_DAD', method: 'cash', note: 'ទូទាត់ផ្នែក',
    }, 'key-settlement-001');
    expect(settled.status).toBe(201);
    settlementId = settled.body.data.id;
    expect(settled.body.data.status).toBe('PARTIAL');
    expect(settled.body.data.balanceAfter).toBe('120000');
    expect(await balanceOf()).toBe(120000);

    const settlement = await agent.get(`/api/v1/settlements/${settlementId}`);
    expect(settlement.body.data.paymentId).toBeTruthy();
  });

  it('11. editing the catalog price does not alter historical delivery items', async () => {
    const delivery = await agent.get(`/api/v1/deliveries/${deliveryId}`);
    expect(delivery.body.data.items[0].unitPrice).toBe('80000');
    const updated = await agent.patch(`/api/v1/products/${productId}`).send({ unitPrice: '999000' });
    expect(updated.status).toBe(200);
    const again = await agent.get(`/api/v1/deliveries/${deliveryId}`);
    expect(again.body.data.items[0].unitPrice).toBe('80000');
    expect(again.body.data.totalAmount).toBe('200000');
  });

  it('9. duplicate submissions with the same idempotency key are prevented', async () => {
    const body = { transactionDate: '2020-02-04', amount: '10000', note: 'សាកល្បង' };
    const first = await post('/api/v1/lending', body, 'key-duplicate-001');
    expect(first.status).toBe(201);
    const second = await post('/api/v1/lending', body, 'key-duplicate-001');
    expect(second.status).toBe(201);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(await balanceOf()).toBe(130000);
  });

  it('14. concurrent payments produce an exact, valid balance', async () => {
    const before = await balanceOf();
    const results = await Promise.all([1, 2, 3].map((n) => post('/api/v1/payments', {
      paymentDate: '2020-02-05', direction: 'OUDOM_TO_DAD', amount: '10000', note: ` concurrent ${n}`,
    }, `key-concurrent-${n}`)));
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(await balanceOf()).toBe(before - 30000);
  });

  it('closes a custom short period and keeps earlier statements intact', async () => {
    const closed = await post('/api/v1/period-closings', { startDate: '2020-02-01', endDate: '2020-02-10' }, 'key-close-002');
    expect(closed.status).toBe(201);
    closingFebId = closed.body.data.id;
    expect(closed.body.data.openingBalance).toBe('150000');
    expect(closed.body.data.closingBalance).toBe('100000');

    const earlier = await agent.get(`/api/v1/period-closings/${closingJanId}/statement`);
    expect(earlier.body.data.closing.snapshot.closingBalance).toBe('150000');

    const nextPreview = await agent.get('/api/v1/period-closings/preview?startDate=2020-02-11&endDate=2020-02-29');
    expect(nextPreview.body.data.openingBalance).toBe('100000');
  });

  it('validates input and rejects overlapping periods', async () => {
    const invalid = await post('/api/v1/lending', { transactionDate: '2020-02-12', amount: '1.5' }, 'key-invalid-001');
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    const overlap = await post('/api/v1/period-closings', { startDate: '2020-02-05', endDate: '2020-02-20' }, 'key-close-overlap');
    expect(overlap.status).toBe(409);
    expect(overlap.body.error.code).toBe('PERIOD_OVERLAP');
  });

  it('records an audit trail for financial changes', async () => {
    const logs = await prisma.auditLog.findMany({ where: { action: { in: ['LENDING_CREATE', 'PERIOD_CLOSE', 'SETTLEMENT_CREATE', 'LENDING_VOID'] } } });
    expect(logs.length).toBeGreaterThanOrEqual(4);
    expect(logs.some((log) => log.entityId === closingFebId)).toBe(true);
  });
});
