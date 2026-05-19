-- =========================================================================
-- Test agri_records — pilot smoke-test dataset.
-- =========================================================================
--
-- Generated:    2026-05-19T19:55:41
-- Total records: 30
--
-- Commodity x status distribution:
--   Corn       active     3
--   Corn       damaged    1
--   Corn       harvested  1
--   Fishery    active     6
--   Fishery    damaged    2
--   Fishery    harvested  2
--   Rice       active     9
--   Rice       damaged    3
--   Rice       harvested  3
--
-- Per-barangay distribution:
--   Alangtin     3
--   Amtuagan     3
--   Dilong       3
--   Kili         3
--   Poblacion    3
--   Supo         3
--   Tabacda      3
--   Tiempo       3
--   Tubtuba      3
--   Wayangan     3
--
-- PRE-REQUISITES
--   * scripts/wipe-pilot-data.sql + scripts/import-rsbsa.sql have
--     been applied (this script references the deterministic UUIDs
--     of those imported farmers).
--
-- USAGE
--   Supabase Dashboard → SQL Editor → paste → Run.
--   Run AFTER the RSBSA import; otherwise the FK to farmers would
--   look up unknown UUIDs (the import populates them).
--
-- WHAT TO TEST AFTER
--   1. Records tab — see ~25 rows with mixed statuses + commodities.
--   2. Overview tab — KPI tiles populate.
--   3. Click Edit on an Active record — modify a field — close —
--      Discard confirm fires (Week 3.5 Part 8).
--   4. Click Edit on a Harvested record — numeric fields should be
--      locked for reporting integrity (Week 2 confirm-on-finalize).
--   5. Try to save the same record from two browser tabs — the
--      second save should show 'Someone else updated this record...'
--      (Week 3.5 Part 1 optimistic concurrency).
--   6. Activity tab — entries for each record creation.
--   7. Soft-delete one record — /admin/restore shows it — restore.
--
-- RE-RUNNING
--   ON CONFLICT (id) DO NOTHING — idempotent. UUIDs are deterministic.
--

BEGIN;

INSERT INTO public.agri_records (
  id, barangay, commodity, commodity_group, sub_category,
  farmer_ids, farmer_names, farmer_male, farmer_female, total_farmers,
  planting_area_hectares, harvesting_output_bags,
  damage_pests_hectares, damage_calamity_hectares,
  stocking, harvesting_fishery, fishery_loss_pieces,
  pests_diseases, calamity, calamity_sub_category,
  remarks, status, period_month, period_year
) VALUES
  ('7f267a65-6f9d-5167-9200-51a41d2b2a6d', 'Kili', 'Rice', 'CROP', 'Inbred', ARRAY['6a6a31ff-f125-50e4-b88d-ab024084ecd8']::text[], 'Miguel Batoon Ramon', 1, 0, 1, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 'None', 'None', 'None', '[test record] Rice active', 'active', 5, 2026),
  ('8eaf5292-e719-582d-99d3-510df1a38e61', 'Tiempo', 'Rice', 'CROP', 'Hybrid', ARRAY['549fbadf-9e03-54f1-ad8a-9ceb3344f53b']::text[], 'Natividad Gardo Jueves', 0, 1, 1, 0.0983, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 'None', 'None', 'None', '[test record] Rice active', 'active', 5, 2026),
  ('e963dbe3-26ea-5605-aa3f-134aaa8cbb94', 'Tiempo', 'Corn', 'CROP', '', ARRAY['2a0e552b-3ce4-569f-9db4-b47e7ee43ff3']::text[], 'Demetrio Guil-Ad Idong', 1, 0, 1, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 'None', 'None', 'None', '[test record] Corn active', 'active', 5, 2026),
  ('3e6165a1-25d9-5551-b9f9-6ec08e03c007', 'Dilong', 'Fishery', 'FISHERY', 'Tilapia', ARRAY['7e3af58f-702e-5c9d-a942-8b2c83c5da6b']::text[], 'Sylvia Matias Malanggay', 0, 1, 1, 0.0, 0.0, 0.0, 0.0, 1093, 821, 0.0, 'None', 'None', 'None', '[test record] Fishery harvested', 'harvested', 5, 2026),
  ('3077aec9-c22e-543a-bd32-3af1cd64c355', 'Amtuagan', 'Rice', 'CROP', 'Traditional', ARRAY['85d8a152-b604-54f8-8bed-1cc0846cbf9e']::text[], 'Roel Melecio Manganip', 1, 0, 1, 0.496, 0.0, 0.2976, 0.0, 0.0, 0.0, 0.0, 'Rats and stem borer', 'None', 'None', '[test record] Rice damaged', 'damaged', 5, 2026),
  ('9393eed2-6d7e-5162-94f8-fda558eeee2e', 'Supo', 'Fishery', 'FISHERY', 'Carp', ARRAY['c38e6d32-bf1c-5091-a674-0dab72f30ea4']::text[], 'Lydia Baliw-An Calbayan', 0, 1, 1, 0.0, 0.0, 0.0, 0.0, 939, 0.0, 0.0, 'None', 'None', 'None', '[test record] Fishery active', 'active', 5, 2026),
  ('a881d6f5-a330-5168-8524-f6dfc0a1bea1', 'Tubtuba', 'Rice', 'CROP', 'Inbred', ARRAY['8b0cb54b-6383-5b98-8e68-e7db20598068']::text[], 'George Sowetan Balinao', 1, 0, 1, 0.112, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 'None', 'None', 'None', '[test record] Rice active', 'active', 5, 2026),
  ('9087a746-64f0-57ca-a34d-3ad99888ecd7', 'Supo', 'Rice', 'CROP', 'Hybrid', ARRAY['1a997745-7b45-590b-b7bf-9aaea951f41e']::text[], 'Hilda Gorio Calbayan', 0, 1, 1, 0.4894, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 'None', 'None', 'None', '[test record] Rice active', 'active', 5, 2026),
  ('e2bc1457-4243-539e-887e-ec628c545d16', 'Alangtin', 'Corn', 'CROP', '', ARRAY['df62c910-727d-5c7c-8bdc-bcb190e29c40']::text[], 'Joel Cadaweng Saway', 1, 0, 1, 0.0635, 2.64, 0.0, 0.0, 0.0, 0.0, 0.0, 'None', 'None', 'None', '[test record] Corn harvested', 'harvested', 5, 2026),
  ('190f5f83-d2bd-59b9-9439-ea39d2fdbff4', 'Wayangan', 'Fishery', 'FISHERY', 'Tilapia', ARRAY['1859e56a-1fc9-59dc-9206-c00a906a37f5']::text[], 'Dorina Sario Dayao', 0, 1, 1, 0.0, 0.0, 0.0, 0.0, 772, 0.0, 540, 'None', 'Flooding', 'None', '[test record] Fishery damaged', 'damaged', 5, 2026),
  ('ddd3cdb9-b7d1-5a52-91c3-46f54cbef3dd', 'Tiempo', 'Rice', 'CROP', 'Traditional', ARRAY['d6944417-e20d-56c6-bfe9-b40b3939f98b']::text[], 'Fidel Manganip Bolante', 1, 0, 1, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 'None', 'None', 'None', '[test record] Rice active', 'active', 5, 2026),
  ('ae9f9579-ff3e-573f-8f3b-e68176fbe45f', 'Amtuagan', 'Fishery', 'FISHERY', 'Carp', ARRAY['2fb8d500-0c70-55aa-9381-0aa9d7900801']::text[], 'Darwin Yagyag Sabino', 1, 0, 1, 0.0, 0.0, 0.0, 0.0, 1049, 0.0, 0.0, 'None', 'None', 'None', '[test record] Fishery active', 'active', 5, 2026),
  ('53f8d884-af59-5def-bf2a-8f8f7e0cc0ca', 'Tabacda', 'Rice', 'CROP', 'Inbred', ARRAY['cfebff78-ef11-5ccd-b6bc-e7682960de34']::text[], 'Anita Ngawit Tibang', 0, 1, 1, 0.2432, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 'None', 'None', 'None', '[test record] Rice active', 'active', 5, 2026),
  ('6feb08cf-a45e-561b-a81f-02bb95aecc93', 'Tubtuba', 'Rice', 'CROP', 'Hybrid', ARRAY['028eed5d-8605-5563-8a8a-a984e0e11e43']::text[], 'Jose Bestre Bruno', 1, 0, 1, 0.05, 15.86, 0.0, 0.0, 0.0, 0.0, 0.0, 'None', 'None', 'None', '[test record] Rice harvested', 'harvested', 5, 2026),
  ('262d5576-75d5-5f9f-982c-9efadf54825a', 'Amtuagan', 'Corn', 'CROP', '', ARRAY['c2672137-732f-5f02-9893-5e5cb92db15f']::text[], 'Editha Ayaba Bakidan', 0, 1, 1, 0.088, 0.0, 0.0528, 0.0, 0.0, 0.0, 0.0, 'Rats and stem borer', 'None', 'None', '[test record] Corn damaged', 'damaged', 5, 2026),
  ('1557827b-85ec-5560-98ed-862af5d6d728', 'Poblacion', 'Fishery', 'FISHERY', 'Tilapia', ARRAY['2db1322e-cace-5642-8fb2-27e5b6643f15']::text[], 'Cesar Agunan Marquez', 1, 0, 1, 0.0, 0.0, 0.0, 0.0, 1227, 0.0, 0.0, 'None', 'None', 'None', '[test record] Fishery active', 'active', 5, 2026),
  ('08957cf9-c025-598f-b3a4-85d81b25a248', 'Dilong', 'Rice', 'CROP', 'Traditional', ARRAY['72e08b95-761c-521f-9f17-593b7bb43829']::text[], 'Lourelie Guliman Joaquin', 0, 1, 1, 0.2834, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 'None', 'None', 'None', '[test record] Rice active', 'active', 5, 2026),
  ('515220cd-85bc-58a2-ba87-3bb84bff684a', 'Tabacda', 'Fishery', 'FISHERY', 'Carp', ARRAY['e8f0a858-80a5-5745-8c93-02b49c0fc895']::text[], 'Pio Tagmangen Pingian', 1, 0, 1, 0.0, 0.0, 0.0, 0.0, 1216, 0.0, 0.0, 'None', 'None', 'None', '[test record] Fishery active', 'active', 5, 2026),
  ('16e4352d-d57b-5ae9-9afe-5603ec92f4e6', 'Alangtin', 'Rice', 'CROP', 'Inbred', ARRAY['40c7706d-c287-5738-a347-0fbde094dff8']::text[], 'Ricky Masadao Tamilan', 1, 0, 1, 0.5, 37.6, 0.0, 0.0, 0.0, 0.0, 0.0, 'None', 'None', 'None', '[test record] Rice harvested', 'harvested', 5, 2026),
  ('b820199a-28c1-5216-afb2-a7aba1ff1bf5', 'Tubtuba', 'Rice', 'CROP', 'Hybrid', ARRAY['757d0ddc-d0ee-54a2-9eb5-0440e74549fb']::text[], 'Rogin Cayandag Tulingan', 1, 0, 1, 0.05, 0.0, 0.03, 0.0, 0.0, 0.0, 0.0, 'Rats and stem borer', 'None', 'None', '[test record] Rice damaged', 'damaged', 5, 2026),
  ('bd31ff35-cccf-54ab-8e59-2f62e8afb1d1', 'Poblacion', 'Corn', 'CROP', '', ARRAY['f0a8b17a-81b1-585b-a9b1-1768b922bae9']::text[], 'Rez Nueva Gregorio', 1, 0, 1, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 'None', 'None', 'None', '[test record] Corn active', 'active', 5, 2026),
  ('80bd9977-dd03-5ed0-ac01-87946093c185', 'Dilong', 'Fishery', 'FISHERY', 'Tilapia', ARRAY['6d3b5f12-b5c0-5f00-bbe2-f6be8bb1928d']::text[], 'Marthesa Bati Tulingan', 0, 1, 1, 0.0, 0.0, 0.0, 0.0, 1013, 0.0, 0.0, 'None', 'None', 'None', '[test record] Fishery active', 'active', 5, 2026),
  ('7fe11619-ca87-5fde-ac75-6cb1a380e8ea', 'Tabacda', 'Rice', 'CROP', 'Traditional', ARRAY['1357095c-2f42-586d-9b7c-b3ef2ce29fe9']::text[], 'Roger Sagmayao Macario', 1, 0, 1, 0.336, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 'None', 'None', 'None', '[test record] Rice active', 'active', 5, 2026),
  ('8c49ae54-d8f6-57ac-83ac-85b6b9700c29', 'Kili', 'Fishery', 'FISHERY', 'Carp', ARRAY['bbe07a4a-7608-56a8-8708-9912eb2412c1']::text[], 'Inocencio Soyon Banasan', 1, 0, 1, 0.0, 0.0, 0.0, 0.0, 638, 518, 0.0, 'None', 'None', 'None', '[test record] Fishery harvested', 'harvested', 5, 2026),
  ('d168a259-cd91-599f-9593-45174fed7343', 'Wayangan', 'Rice', 'CROP', 'Inbred', ARRAY['c7b97637-c36a-51d6-8b80-46628683794d']::text[], 'Diana Dayaoen Reyes', 0, 1, 1, 0.3744, 0.0, 0.2246, 0.0, 0.0, 0.0, 0.0, 'Rats and stem borer', 'None', 'None', '[test record] Rice damaged', 'damaged', 5, 2026),
  ('3769ecb1-b37f-5d7f-918e-e2022b8194fd', 'Kili', 'Rice', 'CROP', 'Hybrid', ARRAY['6f9e4b08-3550-5092-a6a8-04f72ea4fba6']::text[], 'Ruben Macario Sabino', 1, 0, 1, 0.1393, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 'None', 'None', 'None', '[test record] Rice active', 'active', 5, 2026),
  ('c7604903-658e-53a4-ace8-0c4d4133874d', 'Wayangan', 'Corn', 'CROP', '', ARRAY['7d03c6f3-5d7a-5741-a035-dcd89987bc9d']::text[], 'Eric Abangoen Gagarin', 1, 0, 1, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 'None', 'None', 'None', '[test record] Corn active', 'active', 5, 2026),
  ('96ef28ed-9846-5dd1-b5fc-de8713a5947b', 'Supo', 'Fishery', 'FISHERY', 'Tilapia', ARRAY['a22322bf-0a63-5ce3-bc76-50ffd2646b8b']::text[], 'Rufo Banasan Calbayan', 1, 0, 1, 0.0, 0.0, 0.0, 0.0, 1492, 0.0, 0.0, 'None', 'None', 'None', '[test record] Fishery active', 'active', 5, 2026),
  ('ac77708c-b3e6-5972-a1e9-1ac32efb79ae', 'Alangtin', 'Rice', 'CROP', 'Traditional', ARRAY['da4815e0-117c-515e-8496-9040ea65676d']::text[], 'Hilda Dangngay Ocnang', 0, 1, 1, 0.1088, 10.74, 0.0, 0.0, 0.0, 0.0, 0.0, 'None', 'None', 'None', '[test record] Rice harvested', 'harvested', 5, 2026),
  ('b49c393e-f6f7-5d13-8639-d2750b45c0a1', 'Poblacion', 'Fishery', 'FISHERY', 'Carp', ARRAY['35247162-a2fd-516b-a259-ede3a1318282']::text[], 'Aiza Galliedo Dakiwas', 0, 1, 1, 0.0, 0.0, 0.0, 0.0, 1405, 0.0, 983, 'None', 'Flooding', 'None', '[test record] Fishery damaged', 'damaged', 5, 2026)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Verification:
--   SELECT status, count(*) FROM public.agri_records GROUP BY status ORDER BY status;
--   -- expect total: 30
--   SELECT barangay, count(*) FROM public.agri_records GROUP BY barangay ORDER BY barangay;
--   SELECT commodity, count(*) FROM public.agri_records GROUP BY commodity ORDER BY commodity;
