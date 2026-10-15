-- seed.sql (uses a placeholder user_id for testing)
-- Run after migrations with a real user_id substituted

DO $$
DECLARE
  test_user_id UUID := '00000000-0000-0000-0000-000000000001';
  b1 UUID := gen_random_uuid();
  b2 UUID := gen_random_uuid();
  b3 UUID := gen_random_uuid();
  b4 UUID := gen_random_uuid();
  b5 UUID := gen_random_uuid();
BEGIN
  INSERT INTO businesses (id, user_id, place_id, name, address, phone, website, category, rating, review_count, latitude, longitude, social_links)
  VALUES
    (b1, test_user_id, 'place_001', 'Joe''s Plumbing', '123 Main St, Austin TX', '555-0101', 'https://joesplumbing.com', 'Plumber', 4.2, 87, 30.2672, -97.7431, '{"facebook":"https://fb.com/joesplumbing","instagram":null,"linkedin":null,"tiktok":null,"twitter":null,"youtube":null}'),
    (b2, test_user_id, 'place_002', 'Sunrise Dental', '456 Oak Ave, Austin TX', '555-0202', 'https://sunrisedental.com', 'Dentist', 4.8, 213, 30.2850, -97.7350, '{"facebook":"https://fb.com/sunrisedental","instagram":"https://instagram.com/sunrisedental","linkedin":null,"tiktok":null,"twitter":null,"youtube":null}'),
    (b3, test_user_id, 'place_003', 'Green Thumb Landscaping', '789 Elm Rd, Austin TX', '555-0303', NULL, 'Landscaping', 3.9, 45, 30.2510, -97.7510, '{"facebook":null,"instagram":null,"linkedin":null,"tiktok":null,"twitter":null,"youtube":null}'),
    (b4, test_user_id, 'place_004', 'Bella''s Italian Kitchen', '321 Pine Blvd, Austin TX', '555-0404', 'https://bellasitalian.com', 'Restaurant', 4.5, 312, 30.2700, -97.7400, '{"facebook":"https://fb.com/bellasitalian","instagram":"https://instagram.com/bellasitalian","linkedin":null,"tiktok":"https://tiktok.com/@bellasitalian","twitter":null,"youtube":null}'),
    (b5, test_user_id, 'place_005', 'Peak Performance Gym', '654 Birch Lane, Austin TX', '555-0505', 'https://peakperformancegym.com', 'Gym', 4.1, 156, 30.2600, -97.7600, '{"facebook":"https://fb.com/peakgym","instagram":"https://instagram.com/peakgym","linkedin":null,"tiktok":null,"twitter":"https://twitter.com/peakgym","youtube":"https://youtube.com/peakgym"}');

  INSERT INTO website_audits (business_id, performance_score, seo_score, accessibility_score, mobile_friendly, has_ssl, has_analytics, cms_detected, page_speed_ms, tech_stack)
  VALUES
    (b1, 55, 60, 70, true, true, false, 'wordpress', 2800, ARRAY['WordPress','PHP']),
    (b2, 82, 78, 85, true, true, true, 'squarespace', 1200, ARRAY['Squarespace']),
    (b4, 71, 65, 72, true, true, true, 'shopify', 1800, ARRAY['Shopify']),
    (b5, 63, 55, 68, true, true, false, 'wordpress', 2200, ARRAY['WordPress','WooCommerce']);

  INSERT INTO social_audits (business_id, channels, platform_coverage_score, engagement_score, missing_platforms)
  VALUES
    (b1, '[]'::jsonb, 20, 10, ARRAY['facebook','instagram','linkedin','twitter','youtube']),
    (b2, '[{"platform":"facebook","exists":true,"follower_count":1200}]'::jsonb, 40, 35, ARRAY['instagram','linkedin','twitter']),
    (b4, '[{"platform":"facebook","exists":true,"follower_count":3400},{"platform":"instagram","exists":true,"follower_count":5600}]'::jsonb, 70, 65, ARRAY['linkedin','twitter']),
    (b5, '[{"platform":"facebook","exists":true,"follower_count":890},{"platform":"instagram","exists":true,"follower_count":1100},{"platform":"twitter","exists":true,"follower_count":340}]'::jsonb, 60, 45, ARRAY['linkedin','tiktok']);

  INSERT INTO ads_audits (business_id, has_meta_ads, meta_ad_count, has_google_ads)
  VALUES
    (b1, false, 0, false),
    (b2, false, 0, true),
    (b4, true, 5, true),
    (b5, true, 2, false);

  INSERT INTO scores (business_id, total_score, grade, label, website_score, social_score, engagement_score, advertising_score, reviews_score)
  VALUES
    (b1, 32, 'D', 'Digital Starter', 57, 20, 10, 0, 84),
    (b2, 68, 'B', 'Digital Active', 80, 40, 35, 50, 96),
    (b3, 15, 'F', 'Digital Absent', 0, 0, 0, 0, 78),
    (b4, 75, 'B', 'Digital Active', 68, 70, 65, 100, 90),
    (b5, 58, 'C', 'Digital Present', 59, 60, 45, 50, 82);
END $$;
