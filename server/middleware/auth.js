import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import db, { logAudit } from '../db.js';

const FALLBACK_SECRET = 'accessmate_dev_secret_key_92837482910384756201928374';
let secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) {
  if (process.env.NODE_ENV === 'production') {
    console.warn('[SECURITY NOTICE] JWT_SECRET was not provided or is under 32 characters. Generating an automatic 256-bit runtime secret.');
    secret = crypto.randomBytes(32).toString('hex');
  } else {
    secret = FALLBACK_SECRET;
  }
}
export const SECRET = secret;

export const COOKIE_NAME = 'accessmate_session';
export const CSRF_COOKIE_NAME = 'accessmate_csrf';

export const isProd = process.env.NODE_ENV === 'production';

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isProd,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

export const csrfCookieOptions = {
  httpOnly: false, // Accessible by client JS to send in X-CSRF-Token header
  sameSite: 'lax',
  secure: isProd,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000
};

export function issueSession(res, user) {
  const token = jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    SECRET,
    { expiresIn: '7d', algorithm: 'HS256' }
  );
  const csrfToken = crypto.randomBytes(24).toString('hex');
  res.cookie(COOKIE_NAME, token, cookieOptions);
  res.cookie(CSRF_COOKIE_NAME, csrfToken, csrfCookieOptions);
  return { token, csrfToken };
}

export function clearSession(res) {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: 0 });
  res.clearCookie(CSRF_COOKIE_NAME, { ...csrfCookieOptions, maxAge: 0 });
}

export function authMiddleware(req, res, next) {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ error: 'Please sign in first' });
    }

    const payload = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
    const user = db.prepare('SELECT id, name, email, role, status FROM users WHERE id=?').get(payload.sub);

    if (!user) {
      clearSession(res);
      return res.status(401).json({ error: 'Session user no longer exists' });
    }

    if (user.status === 'suspended') {
      clearSession(res);
      logAudit(user.id, 'AUTH_BLOCKED', 'Suspended account attempted access', req.ip);
      return res.status(403).json({ error: 'Account is suspended. Please contact support.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }
}

export function optionalAuth(req, _res, next) {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (token) {
      const payload = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
      const user = db.prepare('SELECT id, name, email, role, status FROM users WHERE id=?').get(payload.sub);
      if (user && user.status !== 'suspended') {
        req.user = user;
      }
    }
  } catch {
    // Ignore optional auth error
  }
  next();
}

/**
 * RBAC middleware: ensures req.user has one of the allowed roles
 */
export function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (!roles.includes(req.user.role)) {
      logAudit(
        req.user.id,
        'RBAC_ACCESS_DENIED',
        `Required [${roles.join(',')}]; user has [${req.user.role}] for ${req.method} ${req.originalUrl}`,
        req.ip
      );
      return res.status(403).json({
        error: 'Access denied: You do not have sufficient permissions to access this resource.'
      });
    }
    next();
  };
}

/**
 * IDOR Prevention: Ensures req.user owns the target document OR has admin/staff permissions
 */
export function checkDocOwnership(req, res, next) {
  const docId = Number(req.params.id);
  if (!docId || isNaN(docId)) {
    return res.status(400).json({ error: 'Invalid document ID' });
  }

  const doc = db.prepare('SELECT * FROM documents WHERE id=?').get(docId);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Super Admins, Admins, and Staff can view/manage according to scope
  if (['super_admin', 'admin'].includes(req.user.role)) {
    req.targetDocument = doc;
    return next();
  }

  if (req.user.role === 'staff') {
    // Staff can review all documents for OCR/assistance, but cannot delete unless owner
    if (['DELETE'].includes(req.method) && doc.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Staff members cannot delete documents of other users' });
    }
    req.targetDocument = doc;
    return next();
  }

  // Regular user: strict ownership check
  if (doc.user_id !== req.user.id) {
    logAudit(
      req.user.id,
      'IDOR_ATTEMPT_BLOCKED',
      `User ${req.user.id} attempted to access doc ${docId} owned by user ${doc.user_id}`,
      req.ip
    );
    return res.status(403).json({ error: 'Access denied: You do not own this document' });
  }

  req.targetDocument = doc;
  next();
}

/**
 * CSRF Protection middleware for state-changing requests
 */
export function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // If session cookie is attached, verify CSRF protection
  if (req.cookies[COOKIE_NAME]) {
    const headerToken = req.headers['x-csrf-token'];
    const cookieToken = req.cookies[CSRF_COOKIE_NAME];

    if (headerToken && cookieToken && headerToken === cookieToken) {
      return next();
    }

    const origin = req.headers.origin;
    if (origin && (
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin === process.env.CLIENT_ORIGIN
    )) {
      return next();
    }

    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    return res.status(403).json({ error: 'CSRF validation failed: Missing or invalid token.' });
  }

  next();
}
