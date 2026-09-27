ALTER TABLE dashboard_images
  DROP CONSTRAINT IF EXISTS dashboard_images_content_type_check;

ALTER TABLE dashboard_images
  ADD CONSTRAINT dashboard_images_content_type_check
  CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'));
