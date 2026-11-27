import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db.js';
import { hashPassword } from '../../src/auth.js';
import { DEFAULT_PARTNER_ID } from '../../src/partner.js';

const app = createApp();
let agent;
let memberAgent;
let partnerA;
let partnerB;
let partnerC;
let dadPaymentId;
let closingJanId;
let closingFebId;
let settlementId;

const keyHeaders = (partnerId, key) => ({
  'X-Partner-Id': partnerId,
  ...(key ? { 'Idempotency-Key': key } : {}),
});
const post = (path, body, key, partnerId = partnerA.id) =>
  agent.post(path).set(keyHeaders(partnerId, key)).send(body);
const get = (path, partnerId = partnerA.id) => agent.get(path).set('X-Partner-Id', partnerId);
const balanceOf = async (partnerId = partnerA.id) =>
  Number((await get('/api/v1/dashboard', partnerId)).body.data.balance);

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
  await prisma.partner.deleteMany();
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
  partnerA = await prisma.partner.create({
    data: { id: DEFAULT_PARTNER_ID, name: 'អ៊ូដុំ', openingBalance: 100000n, isActive: true },
  });
  partnerB = await prisma.partner.create({
    data: { name: 'សុភី', openingBalance: 50000n, isActive: true },
  });
  await prisma.user.create({
    data: { username: 'dad', passwordHash: await hashPassword('test-pass-123'), displayName: 'ប៉ា', role: 'OWNER' },
  });
  await prisma.user.create({
    data: { username: 'member', passwordHash: await hashPassword('test-pass-123'), displayName: 'ជំនួយការ', role: 'MEMBER' },
  });
  agent = request.agent(app);
  const login = await agent.post('/api/v1/auth/login').send({ username: 'dad', password: 'test-pass-123' });
  expect(login.status).toBe(200);
  memberAgent = request.agent(app);
  expect((await memberAgent.post('/api/v1/auth/login').send({ username: 'member', password: 'test-pass-123' })).status).toBe(200);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Business Ledger API — partners, deliveries and financial correctness', () => {
  it('creates and renames partners, and lists their outstanding balances', async () => {
    const list = await agent.get('/api/v1/partners');
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(2);
    expect(list.body.data.find((p) => p.id === partnerA.id).balance).toBe('100000');

    const created = await agent.post('/api/v1/partners').send({
      name: 'ថ្មី', phone: '012345678', note: 'ដៃគូថ្មី', openingBalance: '0',
    });
    expect(created.status).toBe(201);
    partnerC = created.body.data;

    const renamed = await agent.patch(`/api/v1/partners/${partnerC.id}`).send({ name: 'ដៃគូបី', isActive: true });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.name).toBe('ដៃគូបី');
    const after = await agent.get('/api/v1/partners');
    expect(after.body.data.some((p) => p.name === 'ដៃគូបី')).toBe(true);
    expect(after.body.data).toHaveLength(3);
  });

  it('1–4. lends, records a multi-row delivery without product IDs, and accepts payments', async () => {
    const lend = await post('/api/v1/lending', { transactionDate: '2020-01-02', amount: '400000', note: 'ឱ្យខ្ចី' }, 'key-lending-001');
    expect(lend.status).toBe(201);
    expect(await balanceOf()).toBe(500000);

    const delivery = await post('/api/v1/deliveries', {
      deliveryDate: '2020-01-03', note: 'ទំនិញលើកទី១',
      items: [
        { quantity: '2.500', unitPrice: '80000', note: 'កាប់' },
        { quantity: '1.200', unitPrice: '25000', note: '' },
      ],
    }, 'key-delivery-001');
    expect(delivery.status).toBe(201);
    expect(delivery.body.data.totalAmount).toBe('230000');
    expect(delivery.body.data.items).toHaveLength(2);
    expect(delivery.body.data.items[0]).toEqual(expect.objectContaining({
      quantity: '2.5', unitPrice: '80000', lineTotal: '200000', note: 'កាប់',
    }));
    expect(delivery.body.data.items[0].productId).toBeUndefined();
    expect(delivery.body.data.reference).toBeTruthy(); // internal only
    const unified = await get('/api/v1/transactions?pageSize=100');
    const deliveryEntry = unified.body.data.find((entry) => entry.kind === 'DELIVERY');
    expect(deliveryEntry.reference).toBeNull();
    expect(deliveryEntry.description).toContain('ការទទួលទំនិញ');
    expect(delivery.body.data.items[1].lineTotal).toBe('30000');
    expect(await balanceOf()).toBe(270000);

    const repay = await post('/api/v1/payments', {
      paymentDate: '2020-01-04', direction: 'PARTNER_TO_DAD', amount: '70000', method: 'cash',
    }, 'key-payment-001');
    expect(repay.status).toBe(201);
    expect(await balanceOf()).toBe(200000);
    expect((await get('/api/v1/dashboard')).body.data.direction).toBe('PARTNER_OWES_DAD');
  });

  it('12. previews a custom period and 7. closing does not double count', async () => {
    const preview = await get('/api/v1/period-closings/preview?startDate=2020-01-01&endDate=2020-01-31');
    expect(preview.body.data.openingBalance).toBe('100000');
    expect(preview.body.data.totalLent).toBe('400000');
    expect(preview.body.data.totalDelivered).toBe('230000');
    expect(preview.body.data.totalReceived).toBe('70000');
    expect(preview.body.data.closingBalance).toBe('200000');
    expect(preview.body.data.canClose).toBe(true);

    const closed = await post('/api/v1/period-closings', { startDate: '2020-01-01', endDate: '2020-01-31', note: 'ខួបទី១' }, 'key-close-001');
    expect(closed.status).toBe(201);
    closingJanId = closed.body.data.id;
    expect(closed.body.data.closingBalance).toBe('200000');
    expect(await balanceOf()).toBe(200000);
  });

  it('13. closed periods are per partner: A rejects backdated writes, B accepts its own', async () => {
    const blocked = await post('/api/v1/lending', { transactionDate: '2020-01-05', amount: '1000' }, 'key-lending-backdated');
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('PERIOD_CLOSED');

    const bLend = await post('/api/v1/lending', { transactionDate: '2020-01-05', amount: '250000' }, 'key-b-lending', partnerB.id);
    expect(bLend.status).toBe(201);
    expect(bLend.body.data.partnerId).toBe(partnerB.id);

    const bDelivery = await post('/api/v1/deliveries', {
      deliveryDate: '2020-01-06',
      items: [{ quantity: '3', unitPrice: '10000' }],
    }, 'key-b-delivery', partnerB.id);
    expect(bDelivery.status).toBe(201);

    const bPayment = await post('/api/v1/payments', {
      paymentDate: '2020-01-07', direction: 'PARTNER_TO_DAD', amount: '20000',
    }, 'key-b-payment', partnerB.id);
    expect(bPayment.status).toBe(201);
    expect(await balanceOf(partnerB.id)).toBe(250000);
  });

  it('closes the same date range for partner B without touching A', async () => {
    const bClose = await post('/api/v1/period-closings', { startDate: '2020-01-01', endDate: '2020-01-31' }, 'key-b-close', partnerB.id);
    expect(bClose.status).toBe(201);
    expect(bClose.body.data.closingBalance).toBe('250000'); // 50,000 + 250,000 − 30,000 − 20,000
    const aStatement = await get(`/api/v1/period-closings/${closingJanId}/statement`);
    expect(aStatement.body.data.closing.snapshot.closingBalance).toBe('200000');
  });

  it('8. historical snapshots stay unchanged and show the current partner name after a rename', async () => {
    const statement = await get(`/api/v1/period-closings/${closingJanId}/statement`);
    expect(statement.status).toBe(200);
    expect(statement.body.data.closing.snapshot.closingBalance).toBe('200000');
    expect(statement.body.data.closing.snapshot.totalLent).toBe('400000');
    expect(statement.body.data.partnerName).toBe('អ៊ូដុំ');

    await agent.patch(`/api/v1/partners/${partnerA.id}`).send({ name: 'អ៊ូដុំ (ប៉ា)' });
    const renamedStatement = await get(`/api/v1/period-closings/${closingJanId}/statement`);
    expect(renamedStatement.body.data.partnerName).toBe('អ៊ូដុំ (ប៉ា)');
    expect(renamedStatement.body.data.closing.snapshot.closingBalance).toBe('200000');

    // Keep the original name for the remaining assertions.
    await agent.patch(`/api/v1/partners/${partnerA.id}`).send({ name: 'អ៊ូដុំ' });
  });

  it('6. partner balances are isolated and carry forward independently', async () => {
    const a = await get('/api/v1/dashboard');
    const b = await get('/api/v1/dashboard', partnerB.id);
    expect(a.body.data.balance).toBe('200000');
    expect(b.body.data.balance).toBe('250000');

    const aPreview = await get('/api/v1/period-closings/preview?startDate=2020-02-01&endDate=2020-02-29');
    expect(aPreview.body.data.openingBalance).toBe('200000');
    expect(aPreview.body.data.previousClosingBalance).toBe('200000');
    const bPreview = await get('/api/v1/period-closings/preview?startDate=2020-02-01&endDate=2020-02-29', partnerB.id);
    expect(bPreview.body.data.openingBalance).toBe('250000');

    const aTransactions = await get('/api/v1/transactions?pageSize=100');
    const bTransactions = await get('/api/v1/transactions?pageSize=100', partnerB.id);
    expect(aTransactions.body.data.every((entry) => entry.partnerId === partnerA.id)).toBe(true);
    expect(bTransactions.body.data.every((entry) => entry.partnerId === partnerB.id)).toBe(true);
  });

  it('4 + 10. Dad payment increases the balance and voiding reverses it', async () => {
    const paid = await post('/api/v1/payments', {
      paymentDate: '2020-02-02', direction: 'DAD_TO_PARTNER', amount: '50000', method: 'bank',
    }, 'key-payment-002');
    expect(paid.status).toBe(201);
    dadPaymentId = paid.body.data.id;
    expect(await balanceOf()).toBe(250000);

    const voided = await post(`/api/v1/payments/${dadPaymentId}/void`, { reason: 'កត់ត្រាខុស' }, 'key-void-payment');
    expect(voided.status).toBe(200);
    expect(await balanceOf()).toBe(200000);
    expect(await balanceOf(partnerB.id)).toBe(250000);
  });

  it('5. partial settlement is recorded separately and residual carries forward', async () => {
    const settled = await post('/api/v1/settlements', {
      paymentDate: '2020-02-03', amount: '30000', direction: 'PARTNER_TO_DAD', method: 'cash', note: 'ទូទាត់ផ្នែក',
    }, 'key-settlement-001');
    expect(settled.status).toBe(201);
    settlementId = settled.body.data.id;
    expect(settled.body.data.status).toBe('PARTIAL');
    expect(settled.body.data.balanceAfter).toBe('170000');
    expect(settled.body.data.partnerId).toBe(partnerA.id);
    expect(await balanceOf()).toBe(170000);

    const settlement = await get(`/api/v1/settlements/${settlementId}`);
    expect(settlement.body.data.paymentId).toBeTruthy();
  });

  it('9. duplicate submissions with the same idempotency key are prevented per partner', async () => {
    const body = { transactionDate: '2020-02-04', amount: '10000', note: 'សាកល្បង' };
    const first = await post('/api/v1/lending', body, 'key-duplicate-001');
    const second = await post('/api/v1/lending', body, 'key-duplicate-001');
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(await balanceOf()).toBe(180000);

    // The same key for another partner must not replay partner A's result.
    const other = await post('/api/v1/lending', body, 'key-duplicate-001', partnerB.id);
    expect(other.status).toBe(201);
    expect(other.body.data.partnerId).toBe(partnerB.id);
    expect(await balanceOf(partnerB.id)).toBe(260000);
  });

  it('14. concurrent payments produce an exact, valid balance', async () => {
    const before = await balanceOf();
    const results = await Promise.all([1, 2, 3].map((n) => post('/api/v1/payments', {
      paymentDate: '2020-02-05', direction: 'PARTNER_TO_DAD', amount: '10000', note: `concurrent ${n}`,
    }, `key-concurrent-${n}`)));
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(await balanceOf()).toBe(before - 30000);
  });

  it('closes a custom short period and keeps earlier statements intact', async () => {
    const closed = await post('/api/v1/period-closings', { startDate: '2020-02-01', endDate: '2020-02-10' }, 'key-close-002');
    expect(closed.status).toBe(201);
    closingFebId = closed.body.data.id;
    expect(closed.body.data.openingBalance).toBe('200000');
    expect(closed.body.data.closingBalance).toBe('150000');

    const earlier = await get(`/api/v1/period-closings/${closingJanId}/statement`);
    expect(earlier.body.data.closing.snapshot.closingBalance).toBe('200000');
    const nextPreview = await get('/api/v1/period-closings/preview?startDate=2020-02-11&endDate=2020-02-29');
    expect(nextPreview.body.data.openingBalance).toBe('150000');
  });

  it('validates input and rejects overlapping periods for the same partner', async () => {
    const invalid = await post('/api/v1/lending', { transactionDate: '2020-02-12', amount: '1.5' }, 'key-invalid-001');
    expect(invalid.status).toBe(400);
    const overlap = await post('/api/v1/period-closings', { startDate: '2020-02-05', endDate: '2020-02-20' }, 'key-close-overlap');
    expect(overlap.status).toBe(409);
    expect(overlap.body.error.code).toBe('PERIOD_OVERLAP');

    const missingPartner = await agent.get('/api/v1/dashboard');
    expect(missingPartner.status).toBe(400);
  });

  it('lets any authenticated user write, including MEMBER users and inactive partners', async () => {
    const invalidPartner = await memberAgent.post('/api/v1/partners').send({ name: '' });
    expect(invalidPartner.status).toBe(400);
    expect(invalidPartner.body.error.details.name).toBeTruthy();

    const created = await memberAgent.post('/api/v1/partners').send({ name: 'ដៃគូថ្មី' });
    expect(created.status).toBe(201);

    const memberHeaders = (key) => ({ 'X-Partner-Id': partnerA.id, 'Idempotency-Key': key });
    const lend = await memberAgent.post('/api/v1/lending').set(memberHeaders('key-member-lend'))
      .send({ transactionDate: '2021-01-02', amount: '1000' });
    expect(lend.status).toBe(201);

    const delivery = await memberAgent.post('/api/v1/deliveries').set(memberHeaders('key-member-delivery'))
      .send({ deliveryDate: '2021-01-03', items: [{ quantity: '1', unitPrice: '1000' }] });
    expect(delivery.status).toBe(201);
    expect(delivery.body.data.reference).toBeTruthy();

    const payment = await memberAgent.post('/api/v1/payments').set(memberHeaders('key-member-payment'))
      .send({ paymentDate: '2021-01-04', direction: 'PARTNER_TO_DAD', amount: '500' });
    expect(payment.status).toBe(201);

    await prisma.partner.update({ where: { id: partnerA.id }, data: { isActive: false } });
    const inactiveWrite = await memberAgent.post('/api/v1/lending').set(memberHeaders('key-inactive-lend'))
      .send({ transactionDate: '2021-01-05', amount: '2000' });
    expect(inactiveWrite.status).toBe(201);
    const reactivated = await memberAgent.patch(`/api/v1/partners/${partnerA.id}`).send({ isActive: true });
    expect(reactivated.status).toBe(200);
    expect(reactivated.body.data.isActive).toBe(true);
  });

  it('records an audit trail for financial changes', async () => {
    const logs = await prisma.auditLog.findMany({
      where: { action: { in: ['LENDING_CREATE', 'PERIOD_CLOSE', 'SETTLEMENT_CREATE', 'PARTNER_CREATE'] } },
    });
    expect(logs.length).toBeGreaterThanOrEqual(5);
    expect(logs.some((log) => log.entityId === closingFebId)).toBe(true);
    expect(logs.some((log) => log.action === 'PARTNER_CREATE')).toBe(true);
  });
});
