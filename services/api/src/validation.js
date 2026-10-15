import { z } from 'zod';
import { badRequest } from './errors.js';

// Never trust input: every request body/query goes through a schema; unknown fields are dropped.
export function parse(schema, data) {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;
  const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
  throw badRequest('Invalid request', details);
}

const csv = z.string().optional().transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []));
const money = z.coerce.number().min(0).max(1e10).optional();
const count = z.coerce.number().min(0).max(20).optional();
const coord = z.coerce.number().min(-180).max(180).optional();
const STATUSES = ['for_sale', 'for_rent', 'pending', 'sold'];
const SORTS = ['newest', 'price_asc', 'price_desc', 'beds_desc', 'sqft_desc'];

export const searchQuery = z.object({
  q: z.string().max(100).optional(),
  status: z.enum(STATUSES).optional(),
  types: csv,
  features: csv,
  city: z.string().max(60).optional(),
  minPrice: money, maxPrice: money, beds: count, baths: count,
  minSqft: money, maxSqft: money, minYear: z.coerce.number().min(0).max(2100).optional(),
  north: coord, south: coord, east: coord, west: coord,
  openHouse: z.enum(['1', 'true']).optional(),
  sort: z.enum(SORTS).optional(),
  page: z.coerce.number().int().min(1).max(500).optional(),
  pageSize: z.coerce.number().int().min(1).max(48).optional(),
});

export const batchQuery = z.object({ ids: csv.pipe(z.array(z.string().max(30)).max(24)) });

const email = z.string().trim().toLowerCase().email().max(120);
export const registerBody = z.object({ name: z.string().trim().min(2).max(60), email, password: z.string().min(8).max(72) });
export const loginBody = z.object({ email, password: z.string().min(1).max(72) });
export const inquiryBody = z.object({
  listingId: z.string().min(1).max(30),
  name: z.string().trim().min(2).max(60),
  email,
  phone: z.string().trim().max(30).optional().default(''),
  message: z.string().trim().min(5).max(1000),
});
export const tourBody = z.object({ listingId: z.string().min(1).max(30), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD') });
export const savedSearchBody = z.object({
  name: z.string().trim().min(1).max(60),
  query: z.record(z.string(), z.unknown()),
  alerts: z.boolean().default(true),
});
export const offerBody = z.object({
  listingId: z.string().min(1).max(30),
  amountUsd: z.number().int().positive().max(1e10),
  financing: z.enum(['cash', 'conventional', 'fha', 'va']),
  contingencies: z.array(z.enum(['inspection', 'appraisal', 'financing', 'sale_of_home'])).max(4).default([]),
  closingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
