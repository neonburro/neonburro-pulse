// src/lib/invoiceConstants.js
// Shared constants for the invoicing surface.
// Repainted to brand tokens: Topo Lime signal, softer off-white ink.
//
// 2026-09-25. FIELD_LABEL and NAKED_INPUT now come from src/theme/layout.js
// so the invoice modals carry the same inset and label as every other field
// in Pulse. NAKED_INPUT keeps its name for the two modals that still import
// it and is the house field, not an underline any more. No oxford commas,
// no em dashes.

import colors from '../theme/colors';
import { FIELD_LABEL as HOUSE_LABEL, INPUT } from '../theme/layout';

export const SENT_STATUSES = ['sent', 'viewed', 'partial', 'overdue'];

export const SENT_LIKE_STATUSES = ['sent', 'viewed', 'partial', 'overdue', 'paid'];

export const FUNDING_MODES = [
  { value: 'approve_only', label: 'Confirm Scope', color: colors.surface[500] },
  { value: 'deposit_50',   label: '50% to Start',  color: colors.accent.banana },
  { value: 'pay_full',     label: 'Fund in Full',  color: colors.accent.signal },
];

export const STATUS_COLORS = {
  draft:     { color: colors.surface[500],  label: 'DRAFT' },
  sent:      { color: colors.accent.signal, label: 'SENT' },
  viewed:    { color: colors.accent.banana, label: 'VIEWED' },
  partial:   { color: colors.accent.banana, label: 'PARTIAL' },
  overdue:   { color: colors.accent.coral,  label: 'OVERDUE' },
  paid:      { color: colors.status.green,  label: 'PAID' },
  cancelled: { color: colors.surface[600],  label: 'CANCELLED' },
};

// Off-platform payment sources for Mark Paid. payments.method is free text in
// the database (no check constraint), so this list is presentation only and can
// grow freely. "Other" pairs with a free-text note so anything not listed still
// records. Stripe card, wallet and USDC settlements come in through their own
// rails, this is for money that arrived some other way.
export const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer', referenceLabel: 'Confirmation #' },
  { value: 'venmo',         label: 'Venmo',         referenceLabel: 'Venmo handle or note' },
  { value: 'zelle',         label: 'Zelle',         referenceLabel: 'Zelle reference' },
  { value: 'check',         label: 'Check',         referenceLabel: 'Check number' },
  { value: 'ach',           label: 'ACH',           referenceLabel: 'ACH reference' },
  { value: 'wire',          label: 'Wire',          referenceLabel: 'Wire confirmation #' },
  { value: 'cash',          label: 'Cash',          referenceLabel: 'Receipt #' },
  { value: 'other',         label: 'Other',         referenceLabel: 'Reference or note' },
];

// A dark ink tooltip pill reads clean on cream.
export const TOOLTIP_PROPS = {
  placement: 'top',
  hasArrow: true,
  bg: 'chrome.ground',
  color: 'chrome.text',
  fontSize: 'xs',
  fontWeight: '600',
  px: 3,
  py: 2,
  borderRadius: 'md',
  border: '1px solid',
  borderColor: 'chrome.line',
};

export const FIELD_LABEL = HOUSE_LABEL;

export const NAKED_INPUT = INPUT;

export const formatCurrency = (val) => {
  const num = parseFloat(val || 0);
  if (num === 0) return '$0';
  return `$${num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
};

export const formatCurrencyCompact = (val) => {
  const num = parseFloat(val || 0);
  if (num === 0) return '$0';
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}k`;
  return `$${num.toLocaleString()}`;
};
