-- Migrate existing XP-based 'bronze' badge_type rows to the new streak-based tier name.
-- Idempotent: only touches rows where badge_type is still the old 'bronze' value.
UPDATE user_badges
SET badge_type = 'der_einsteiger'
WHERE badge_type = 'bronze';
