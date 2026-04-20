import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../lib/dbConnect';
import VisitLog from '../../models/VisitLog';
import { UAParser } from 'ua-parser-js';

// Simple in-memory rate limiter: max 5 pings per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const ip =
    req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
    req.socket.remoteAddress ||
    '';

  if (isRateLimited(ip)) {
    return res.status(429).json({ message: 'Too many requests' });
  }

  await dbConnect();

  const userAgent = req.headers['user-agent'] || '';
  const parser = new UAParser(userAgent);
  const browser = parser.getBrowser().name || 'Unknown';

  // Sanitize source: max 100 chars, strip any non-printable characters
  const rawSource = req.body?.source ?? '';
  const source = String(rawSource).replace(/[^\x20-\x7E]/g, '').slice(0, 100);

  await VisitLog.create({
    ip,
    userAgent,
    browser,
    source,
  });

  res.status(201).json({ message: 'Visit logged' });
}
