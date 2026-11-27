import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db.js';
import { hashPassword } from '../../src/auth.js';

const app = createApp();
const suffix = Date.now().toString(36);
let owner;
let member;
let partnerA;
let partnerB;
let product;
let janClosingId;
let febClosingId;
let paymentId;

const post = (path, body, partnerId, agent = owner) =>
  agent.post(path).set('X-Partner-Id', partnerId).send(body);
const get = (path, partnerId, agent = owner) =>
  agent.get(path).set('X-Partner-Id', partnerId);
const balanceOf = async (partnerId) =>
  Number((await get('/api/v1/dashboard', partnerId)).body.data.balance);

beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes('test')) {
    throw new Error('Integration tests require TEST_DATABASE_URL pointing at a separate test database.');
  }

  partnerA = await prisma.partner.create({
    data: { name: `សុភី-${suffix}`, openingBalance: 100000n },
  });
  partnerB = await prisma.partner.create({
    data: { name: `អ៊ូដុំ-${suffix}`, openingBalance: 50000n },
  });
  await prisma.user.create({
    data: {
      username: `owner-${suffix}`, passwordHash: await hashPassword('test-pass-123'),
      displayName: 'ប៉ា', role: 'OWNER',
    },
  });
  await prisma.user.create({
    data: {
      username: `member-${suffix}`, passwordHash: await hashPassword('test-pass-123'),
      displayName: 'ជំនួយការ', role: 'MEMBER',
    },
  });

  owner = request.agent(app);
  member = request.agent(app);
  expect((await owner.post('/api/v1/auth/login')
    .send({ username: `owner-${suffix}`, password: 'test-pass-123' })).status).toBe(200);
  expect((await member.post('/api/v1/auth/login')
    .send({ username: `member-${suffix}`, password: 'test-pass-123' })).status).toBe(200);

  const created = await owner.post('/api/v1/products').send({
    name: `កាប់-${suffix}`, unit: 'គីឡូ', defaultUnitPrice: '80000',
  });
  expect(created.status).toBe(201);
  product = created.body.data;
});

afterAll(async () => {
  if (!partnerA) return;
  const partners = [partnerA.id, partnerB.id];
  await prisma.auditLog.deleteMany({ where: { partnerId: { in: partners } } });
  await prisma.settlement.deleteMany({ where: { partnerId: { in: partners } } });
  await prisma.deliveryItem.deleteMany({ where: { entry: { partnerId: { in: partners } } } });
  await prisma.periodClosing.deleteMany({ where: { partnerId: { in: partners } } });
  await prisma.entry.deleteMany({ where: { partnerId: { in: partners } } });
  await prisma.session.deleteMany({ where: { user: { username: { in: [`owner-${suffix}`, `member-${suffix}`] } } } });
  await prisma.product.deleteMany({ where: { id: product?.id || '' } });
  await prisma.partner.deleteMany({ where: { id: { in: partners } } });
  await prisma.user.deleteMany({ where: { username: { in: [`owner-${suffix}`, `member-${suffix}`] } } });
  await prisma.$disconnect();
});

describe('Business Ledger spec v4', () => {
  it('1–4. lends, delivers multiple priced lines and accepts a partial payment', async () => {
    const lend = await post('/api/v1/lending', {
      transactionDate: '2021-01-02', amount: '400000', note: 'ឱ្យខ្ចី',
    }, partnerA.id);
    expect(lend.status).toBe(201);
    expect(lend.body.data.kind).toBe('LENDING');
    expect(await balanceOf(partnerA.id)).toBe(500000);

    const delivery = await post('/api/v1/deliveries', {
      deliveryDate: '2021-01-03',
      items: [
        { productId: product.id, quantity: '2.500' },
        { productName: 'ឈើ', quantity: '1.200', unitPrice: '25000' },
      ],
    }, partnerA.id);
    expect(delivery.status).toBe(201);
    expect(delivery.body.data.amount).toBe('230000');
    expect(delivery.body.data.deliveryItems).toHaveLength(2);
    expect(delivery.body.data.deliveryItems[0]).toEqual(expect.objectContaining({
      productName: product.name, quantity: '2.500', unitPrice: '80000', lineTotal: '200000',
    }));
    expect(delivery.body.data.deliveryItems[1].lineTotal).toBe('30000');
    expect(await balanceOf(partnerA.id)).toBe(270000);

    const payment = await post('/api/v1/payments', {
      paymentDate: '2021-01-04', direction: 'PARTNER_TO_DAD', amount: '70000', method: 'cash',
    }, partnerA.id);
    expect(payment.status).toBe(201);
    expect(payment.body.data.status).toBe('PARTIAL');
    expect(payment.body.data.balanceAfter).toBe('200000');
    expect(await balanceOf(partnerA.id)).toBe(200000);
  });

  it('12. previews a custom period and 7. closing does not double count', async () => {
    const preview = await get('/api/v1/period-closings/preview?startDate=2021-01-01&endDate=2021-01-31', partnerA.id);
    expect(preview.status).toBe(200);
    expect(preview.body.data.openingBalance).toBe('100000');
    expect(preview.body.data.totalLent).toBe('400000');
    expect(preview.body.data.totalDelivered).toBe('230000');
    expect(preview.body.data.totalReceived).toBe('70000');
    expect(preview.body.data.closingBalance).toBe('200000');

    const closed = await post('/api/v1/period-closings', {
      startDate: '2021-01-01', endDate: '2021-01-31', note: 'ខួបទី១',
    }, partnerA.id);
    expect(closed.status).toBe(201);
    janClosingId = closed.body.data.id;
    expect(closed.body.data.closingBalance).toBe('200000');
    expect(await balanceOf(partnerA.id)).toBe(200000);
  });

  it('13. closed periods are per partner and the 409 names both dates', async () => {
    const blocked = await post('/api/v1/lending', {
      transactionDate: '2021-01-05', amount: '1000',
    }, partnerA.id);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('PERIOD_CLOSED');
    expect(blocked.body.error.details.lastClosedDate).toBe('2021-01-31');
    expect(blocked.body.error.details.earliestAllowedDate).toBe('2021-02-01');
    expect(blocked.body.error.message).toContain('2021-02-01');

    const dashboard = await get('/api/v1/dashboard', partnerA.id);
    expect(dashboard.body.data.firstOpenDate).toBe('2021-02-01');

    const bLend = await post('/api/v1/lending', {
      transactionDate: '2021-01-05', amount: '250000',
    }, partnerB.id);
    expect(bLend.status).toBe(201);
    const bDelivery = await post('/api/v1/deliveries', {
      deliveryDate: '2021-01-06', items: [{ productName: 'ឈើ', quantity: '3', unitPrice: '10000' }],
    }, partnerB.id);
    expect(bDelivery.status).toBe(201);
    const bPayment = await post('/api/v1/payments', {
      paymentDate: '2021-01-07', direction: 'PARTNER_TO_DAD', amount: '20000',
    }, partnerB.id);
    expect(bPayment.status).toBe(201);
    expect(await balanceOf(partnerB.id)).toBe(250000);

    const bClose = await post('/api/v1/period-closings', {
      startDate: '2021-01-01', endDate: '2021-01-31',
    }, partnerB.id);
    expect(bClose.status).toBe(201);
    expect(bClose.body.data.closingBalance).toBe('250000');
  });

  it('8. snapshots stay unchanged while the partner name can be renamed', async () => {
    const statement = await get('/api/v1/reports/statement?from=2021-01-01&to=2021-01-31', partnerA.id);
    expect(statement.status).toBe(200);
    expect(statement.body.data.closingBalance).toBe('200000');

    await owner.patch(`/api/v1/partners/${partnerA.id}`).send({ name: `អ៊ូដុំប៉ា-${suffix}` });
    const renamed = await get('/api/v1/reports/statement?from=2021-01-01&to=2021-01-31', partnerA.id);
    expect(renamed.body.data.closingBalance).toBe('200000');
    const closing = await get(`/api/v1/period-closings/${janClosingId}`, partnerA.id);
    expect(closing.body.data.snapshot.totalLent).toBe('400000');
    await owner.patch(`/api/v1/partners/${partnerA.id}`).send({ name: `សុភី-${suffix}` });
  });

  it('6. balances and carry-forward are isolated per partner', async () => {
    expect(await balanceOf(partnerA.id)).toBe(200000);
    expect(await balanceOf(partnerB.id)).toBe(250000);

    const aPreview = await get('/api/v1/period-closings/preview?startDate=2021-02-01&endDate=2021-02-28', partnerA.id);
    expect(aPreview.body.data.openingBalance).toBe('200000');
    expect(aPreview.body.data.previousClosingBalance).toBe('200000');
    const bPreview = await get('/api/v1/period-closings/preview?startDate=2021-02-01&endDate=2021-02-28', partnerB.id);
    expect(bPreview.body.data.openingBalance).toBe('250000');

    const aTransactions = await get('/api/v1/transactions?pageSize=100', partnerA.id);
    expect(aTransactions.body.data.every((entry) => entry.partnerId === partnerA.id)).toBe(true);
    expect(aTransactions.body.meta.monthlyTotals.length).toBeGreaterThan(0);
  });

  it('4 + 10. a Dad payment increases the balance and voiding reverses it with a reason', async () => {
    const paid = await post('/api/v1/payments', {
      paymentDate: '2021-02-02', direction: 'DAD_TO_PARTNER', amount: '50000', method: 'bank',
    }, partnerA.id);
    expect(paid.status).toBe(201);
    paymentId = paid.body.data.paymentId;
    expect(await balanceOf(partnerA.id)).toBe(250000);

    const voided = await post(`/api/v1/payments/${paymentId}/void`, { reason: 'កត់ត្រាខុស' }, partnerA.id);
    expect(voided.status).toBe(200);
    expect(voided.body.data.voidReason).toBe('កត់ត្រាខុស');
    expect(await balanceOf(partnerA.id)).toBe(200000);
    expect(await balanceOf(partnerB.id)).toBe(250000);
  });

  it('5. a partial settlement records the residual balance', async () => {
    const settled = await post('/api/v1/settlements', {
      paymentDate: '2021-02-03', amount: '30000', direction: 'PARTNER_TO_DAD', note: 'ទូទាត់ផ្នែក',
    }, partnerA.id);
    expect(settled.status).toBe(201);
    expect(settled.body.data.status).toBe('PARTIAL');
    expect(settled.body.data.balanceAfter).toBe('170000');
    expect(settled.body.data.balanceBefore).toBe('200000');
    expect(await balanceOf(partnerA.id)).toBe(170000);

    const found = await get(`/api/v1/settlements/${settled.body.data.id}`, partnerA.id);
    expect(found.body.data.paymentId).toBeTruthy();
    expect(found.body.data.direction).toBe('PARTNER_TO_DAD');
  });

  it('9. repeated browser ids are idempotent and scoped to one partner', async () => {
    const id = randomUUID();
    const body = { id, transactionDate: '2021-02-04', amount: '10000' };
    const first = await post('/api/v1/lending', body, partnerA.id);
    const second = await post('/api/v1/lending', body, partnerA.id);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(id);
    expect(await balanceOf(partnerA.id)).toBe(180000);

    const other = await post('/api/v1/lending', body, partnerB.id);
    expect(other.status).toBe(409);
  });

  it('14. concurrent partial payments produce an exact balance', async () => {
    const before = await balanceOf(partnerA.id);
    const results = await Promise.all([1, 2, 3].map((n) => post('/api/v1/payments', {
      paymentDate: '2021-02-05', direction: 'PARTNER_TO_DAD', amount: '10000', note: `concurrent ${n}`,
    }, partnerA.id)));
    expect(results.every((result) => result.status === 201)).toBe(true);
    expect(await balanceOf(partnerA.id)).toBe(before - 30000);
  });

  it('closes a custom short period and keeps earlier statements intact', async () => {
    const closed = await post('/api/v1/period-closings', {
      startDate: '2021-02-01', endDate: '2021-02-28',
    }, partnerA.id);
    expect(closed.status).toBe(201);
    febClosingId = closed.body.data.id;
    expect(closed.body.data.openingBalance).toBe('200000');
    expect(closed.body.data.closingBalance).toBe('150000');

    const earlier = await get('/api/v1/reports/statement?from=2021-01-01&to=2021-01-31', partnerA.id);
    expect(earlier.body.data.closingBalance).toBe('200000');
    const next = await get('/api/v1/period-closings/preview?startDate=2021-03-01&endDate=2021-03-31', partnerA.id);
    expect(next.body.data.openingBalance).toBe('150000');
  });

  it('reopens only the latest closing, and only the owner may do it', async () => {
    const memberReopen = await post(`/api/v1/period-closings/${janClosingId}/reopen`, { reason: 'សាកល្បង' }, partnerA.id, member);
    expect(memberReopen.status).toBe(403);

    const earlierReopen = await post(`/api/v1/period-closings/${janClosingId}/reopen`, { reason: 'សាកល្បង' }, partnerA.id);
    expect(earlierReopen.status).toBe(409);
    expect(earlierReopen.body.error.code).toBe('PERIOD_HAS_LATER_CLOSING');

    const latest = await post(`/api/v1/period-closings/${febClosingId}/reopen`, { reason: 'កែតម្រូវ' }, partnerA.id);
    expect(latest.status).toBe(200);
    expect(latest.body.data.status).toBe('REOPENED');
  });

  it('records an append-only audit trail for financial changes', async () => {
    const logs = await get('/api/v1/audit?pageSize=100', partnerA.id);
    expect(logs.status).toBe(200);
    const actions = logs.body.data.map((log) => log.action);
    expect(actions).toContain('ENTRY_CREATE');
    expect(actions).toContain('DELIVERY_CREATE');
    expect(actions).toContain('SETTLEMENT_CREATE');
    expect(actions).toContain('PERIOD_CLOSE');
    expect(actions).toContain('PERIOD_REOPEN');
    expect(actions).toContain('ENTRY_VOID');
  });

  it('exports every entry as an authenticated CSV and validates money input', async () => {
    const csv = await get('/api/v1/reports/transactions.csv', partnerA.id);
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('Amount(KHR)');

    const invalid = await post('/api/v1/lending', {
      transactionDate: '2021-03-02', amount: '1.5',
    }, partnerA.id);
    expect(invalid.status).toBe(400);
    const khmer = await post('/api/v1/lending', {
      transactionDate: '2021-03-02', amount: '១២,០០០',
    }, partnerA.id);
    expect(khmer.status).toBe(201);
    expect(khmer.body.data.amount).toBe('12000');
  });
});
