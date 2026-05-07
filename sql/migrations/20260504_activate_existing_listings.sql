UPDATE listings
SET
  status = 'active',
  approved_at = COALESCE(approved_at, NOW()),
  updated_at = NOW()
WHERE status = 'pending';
