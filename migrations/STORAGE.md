# Supabase Storage: `farmer-photos`

1. In **Supabase Dashboard → Storage → New bucket**  
   - Name: `farmer-photos`  
   - Public bucket: **ON** (MVP public read URLs)

2. **Policies** (SQL Editor), or use Dashboard policy UI:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('farmer-photos', 'farmer-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "farmer_photos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'farmer-photos');

CREATE POLICY "farmer_photos_authenticated_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'farmer-photos');

CREATE POLICY "farmer_photos_authenticated_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'farmer-photos');

CREATE POLICY "farmer_photos_authenticated_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'farmer-photos');
```

Objects are stored at `{farmer_id}/photo.jpg` (or similar). The app sets `farmers.photo_url` from `getPublicUrl`.
