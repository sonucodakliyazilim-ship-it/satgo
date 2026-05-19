CREATE TABLE IF NOT EXISTS listing_image_files (
  image_id UUID PRIMARY KEY REFERENCES listing_images(id) ON DELETE CASCADE,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL DEFAULT 0,
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

WITH data_images AS (
  SELECT
    id,
    COALESCE(NULLIF(substring(url FROM '^data:([^;]+);base64,'), ''), 'image/jpeg') AS mime_type,
    substring(url FROM 'base64,(.*)$') AS payload
  FROM listing_images
  WHERE url LIKE 'data:%;base64,%'
)
INSERT INTO listing_image_files (image_id, mime_type, byte_size, data)
SELECT
  id,
  mime_type,
  octet_length(decode(payload, 'base64')),
  decode(payload, 'base64')
FROM data_images
WHERE payload IS NOT NULL
ON CONFLICT (image_id) DO NOTHING;

UPDATE listing_images
SET url = '/api/upload/listing-images/' || id || '/file'
WHERE url LIKE 'data:%;base64,%';
