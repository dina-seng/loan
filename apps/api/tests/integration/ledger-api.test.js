import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db.js';
import { hashPassword } from '../../src/auth.js';
import { DEFAULT_PARTNER_ID } from '../../src/partner.js';

const app = createApp();
let agent;
let partnerA;
let partnerB;

const withPartner = (partnerId) => ({ 'X-Partner-Id': partnerId });
const addEntry = (body, partnerId = partnerA.id) =>
  agent.post('/api/v1/entries').set(withPartner(partnerId)).send({ id: randomUUID(), ...body });
const get = (path, partnerId = partnerA.id) => agent.get(path).set(withPartner(partnerId));
const balanceOf = async (partnerId = partnerA.id) =>
  Number((await get('/api/v1/dashboard', partnerId)).body.data.balance);

async function clean() {
  await prisma.session.deleteMany();
  await prisma.entry.deleteMany();
  await prisma.partner.deleteMany();
  await prisma.user.deleteMany();
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes('test')) {
    throw new Error('Integration tests require TEST_DATABASE_URL pointing at a separate test database.');
  }
  await clean();
  partnerA = await prisma.partner.create({ data: { id: DEFAULT_PARTNER_ID, name: 'អ៊ូដុំ' } });
  partnerB = await prisma.partner.create({ data: { name: 'សុភី' } });
  await prisma.user.create({
    data: { username: 'dad', passwordHash: await hashPassword('test-pass-123'), displayName: 'ប៉ា' },
  });
  agent = request.agent(app);
  expect((await agent.post('/api/v1/auth/login').send({ username: 'dad', password: 'test-pass-123' })).status).toBe(200);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('entries API', () => {
  it('records a lend and a product, and reports who owes whom', async () => {
    expect((await addEntry({ type: 'LEND', date: '2026-01-02', amount: '5000000', note: 'ឱ្យខ្ចី' })).status).toBe(201);
    expect((await addEntry({ type: 'PRODUCT', date: '2026-01-03', amount: '4504500' })).status).toBe(201);

    const dashboard = (await get('/api/v1/dashboard')).body.data;
    expect(dashboard.balance).toBe('495500');
    expect(dashboard.direction).toBe('PARTNER_OWES_US');
    expect(dashboard.recentEntries).toHaveLength(2);
    expect(dashboard.recentEntries[0].note).toBeNull();
  });

  it('lists entries newest first and filters by type', async () => {
    const all = (await get('/api/v1/entries')).body.data;
    expect(all.map((entry) => entry.type)).toEqual(['PRODUCT', 'LEND']);

    const lends = (await get('/api/v1/entries?type=LEND')).body.data;
    expect(lends).toHaveLength(1);
    expect(lends[0].amount).toBe('5000000');
    expect(lends[0].signedAmount).toBe('5000000');
  });

  it('settles the whole balance with one entry and then accepts a same-day lend', async () => {
    const settled = await agent.post(`/api/v1/partners/${partnerA.id}/settle`)
      .send({ id: randomUUID(), date: '2026-01-04' });
    expect(settled.status).toBe(201);
    expect(settled.body.data.type).toBe('SETTLE_IN');
    expect(settled.body.data.amount).toBe('495500');
    expect(await balanceOf()).toBe(0);

    const lend = await addEntry({ type: 'LEND', date: '2026-01-04', amount: '1000000' });
    expect(lend.status).toBe(201);
    expect(await balanceOf()).toBe(1000000);
  });

  it('refuses to settle a zero balance', async () => {
    const other = await prisma.partner.create({ data: { name: 'គ្មានសមតុល្យ' } });
    const response = await agent.post(`/api/v1/partners/${other.id}/settle`).send({ id: randomUUID() });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('NOTHING_TO_SETTLE');
  });

  it('settles in the other direction when we owe the partner', async () => {
    const result = await agent.post(`/api/v1/partners/${partnerB.id}/settle`).send({ id: randomUUID(), date: '2026-02-01' });
    expect(result.status).toBe(409);

    await addEntry({ type: 'PRODUCT', date: '2026-02-01', amount: '300000' }, partnerB.id);
    expect(await balanceOf(partnerB.id)).toBe(-300000);

    const settled = await agent.post(`/api/v1/partners/${partnerB.id}/settle`).send({ id: randomUUID(), date: '2026-02-01' });
    expect(settled.status).toBe(201);
    expect(settled.body.data.type).toBe('SETTLE_OUT');
    expect(settled.body.data.amount).toBe('300000');
    expect(await balanceOf(partnerB.id)).toBe(0);
  });

  it('a repeated entry id returns the same row without writing twice', async () => {
    const id = randomUUID();
    const body = { id, type: 'LEND', date: '2026-03-01', amount: '25000' };
    const first = await agent.post('/api/v1/entries').set(withPartner(partnerA.id)).send(body);
    const second = await agent.post('/api/v1/entries').set(withPartner(partnerA.id)).send(body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(id);
    expect(await prisma.entry.count({ where: { id } })).toBe(1);
  });

  it('delete is a soft void: excluded from every balance, row kept', async () => {
    const before = await balanceOf();
    const created = await addEntry({ type: 'LEND', date: '2026-03-02', amount: '40000' });
    expect(await balanceOf()).toBe(before + 40000);

    const voided = await agent.post(`/api/v1/entries/${created.body.data.id}/void`).set(withPartner(partnerA.id));
    expect(voided.status).toBe(200);
    expect(voided.body.data.voidedAt).toBeTruthy();
    expect(await balanceOf()).toBe(before);
    expect(await prisma.entry.count({ where: { id: created.body.data.id } })).toBe(1);

    const active = (await get('/api/v1/entries')).body.data;
    expect(active.some((entry) => entry.id === created.body.data.id)).toBe(false);
  });

  it('only LEND and PRODUCT can be hand-entered', async () => {
    const response = await addEntry({ type: 'SETTLE_IN', date: '2026-03-03', amount: '1000' });
    expect(response.status).toBe(400);
    expect(response.body.error.details.type).toBeTruthy();
  });

  it('validates amounts, dates and the entry id', async () => {
    for (const amount of ['0', '-500', '12.5', 'abc', '']) {
      const response = await addEntry({ type: 'LEND', date: '2026-03-04', amount });
      expect(response.status).toBe(400);
    }
    const badDate = await addEntry({ type: 'LEND', date: '2026-02-30', amount: '1000' });
    expect(badDate.status).toBe(400);
    const badId = await agent.post('/api/v1/entries').set(withPartner(partnerA.id))
      .send({ id: 'not-a-uuid', type: 'LEND', date: '2026-03-04', amount: '1000' });
    expect(badId.status).toBe(400);
  });

  it('requires login and a selected partner', async () => {
    const anonymous = await request(app).get('/api/v1/entries').set(withPartner(partnerA.id));
    expect(anonymous.status).toBe(401);
    expect((await agent.get('/api/v1/entries')).status).toBe(400);
  });

  it('partners list shows each balance from the single balance function', async () => {
    const list = (await agent.get('/api/v1/partners')).body.data;
    expect(list.find((p) => p.id === partnerA.id).balance).toBe(String(await balanceOf()));
    expect(list.find((p) => p.id === partnerB.id).balance).toBe('0');
  });

  it('creates partners with a normalized, unique name', async () => {
    const created = await agent.post('/api/v1/partners').send({ name: '  ថ្មី   ដៃគូ  ' });
    expect(created.status).toBe(201);
    expect(created.body.data.name).toBe('ថ្មី ដៃគូ');
    expect(created.body.data.balance).toBe('0');

    const duplicate = await agent.post('/api/v1/partners').send({ name: 'ថ្មី ដៃគូ' });
    expect(duplicate.status).toBe(409);

    const renamed = await agent.patch(`/api/v1/partners/${created.body.data.id}`).send({ name: 'ដៃគូបី' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.name).toBe('ដៃគូបី');
  });
});
