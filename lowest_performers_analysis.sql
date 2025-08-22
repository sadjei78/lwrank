-- =====================================================
-- LWRank: Lowest Performing Players Analysis
-- =====================================================
-- This query analyzes all ranking data to identify the 10 lowest performing players overall
-- EXCLUDING players who have ever achieved top 10 rankings or been weekly point leaders
-- based on multiple performance metrics including average ranking, total appearances, and points

-- =====================================================
-- COMPREHENSIVE LOWEST PERFORMERS ANALYSIS
-- =====================================================

WITH player_performance AS (
  SELECT 
    commander,
    -- Count total appearances
    COUNT(*) as total_appearances,
    -- Calculate average ranking (lower is better, so we'll invert this for analysis)
    AVG(ranking::integer) as avg_ranking,
    -- Calculate average points (convert text to numeric, handling potential formatting)
    AVG(
      CASE 
        WHEN points ~ '^[0-9,\.]+$' THEN 
          REPLACE(REPLACE(points, ',', ''), '.', '')::numeric
        ELSE 0 
      END
    ) as avg_points,
    -- Count bottom 20 appearances (rankings 21+)
    COUNT(CASE WHEN ranking::integer > 20 THEN 1 END) as bottom_20_count,
    -- Count bottom 10 appearances (rankings 11+)
    COUNT(CASE WHEN ranking::integer > 10 THEN 1 END) as bottom_10_count,
    -- Worst ranking achieved
    MAX(ranking::integer) as worst_ranking,
    -- Best ranking achieved
    MIN(ranking::integer) as best_ranking,
    -- Days participated
    COUNT(DISTINCT day) as days_participated
  FROM rankings
  WHERE commander IS NOT NULL 
    AND commander != ''
    AND ranking ~ '^[0-9]+$'  -- Ensure ranking is numeric
  GROUP BY commander
  HAVING COUNT(*) >= 3  -- Only include players with at least 3 appearances
),

-- Identify players who have EVER achieved top 10 rankings
top_10_achievers AS (
  SELECT DISTINCT commander
  FROM rankings
  WHERE ranking::integer <= 10
    AND commander IS NOT NULL 
    AND commander != ''
),

-- Identify players who have EVER been weekly point leaders (top 5 cumulative scores)
weekly_leaders AS (
  SELECT DISTINCT commander
  FROM (
    SELECT 
      commander,
      SUM(
        CASE 
          WHEN points ~ '^[0-9,\.]+$' THEN 
            REPLACE(REPLACE(points, ',', ''), '.', '')::numeric
          ELSE 0 
        END
      ) as weekly_points
    FROM rankings
    WHERE commander IS NOT NULL 
      AND commander != ''
      AND points ~ '^[0-9,\.]+$'
    GROUP BY commander, 
             -- Extract week from day (assuming day format is YYYY-MM-DD or similar)
             CASE 
               WHEN day ~ '^\d{4}-\d{2}-\d{2}$' THEN 
                 DATE_TRUNC('week', day::date)
               WHEN day ~ '^\d{4}-W\d{2}$' THEN 
                 -- Handle ISO week format if needed
                 day
               ELSE 
                 day  -- Fallback for other formats
             END
  ) weekly_scores
  WHERE weekly_points > 0
  GROUP BY commander
  HAVING COUNT(*) >= 1  -- At least one week as a leader
),

-- Filter out top performers and weekly leaders
filtered_players AS (
  SELECT p.*
  FROM player_performance p
  WHERE p.commander NOT IN (
    SELECT commander FROM top_10_achievers
  )
  AND p.commander NOT IN (
    SELECT commander FROM weekly_leaders
  )
),

ranked_performance AS (
  SELECT 
    commander,
    total_appearances,
    avg_ranking,
    avg_points,
    bottom_20_count,
    bottom_10_count,
    worst_ranking,
    best_ranking,
    days_participated,
    -- Create a composite score for ranking (lower is worse performance)
    -- Weight factors: avg_ranking (40%), bottom_20_count (30%), worst_ranking (20%), avg_points (10%)
    (
      (avg_ranking * 0.4) + 
      (bottom_20_count * 0.3) + 
      (worst_ranking * 0.2) + 
      (CASE WHEN avg_points > 0 THEN (1000000 / avg_points) * 0.1 ELSE 1000 * 0.1 END)
    ) as performance_score
  FROM filtered_players
)

-- Final result: Top 10 lowest performing players (excluding top performers)
SELECT 
  ROW_NUMBER() OVER (ORDER BY performance_score DESC) as rank,
  commander,
  total_appearances,
  ROUND(avg_ranking, 2) as average_ranking,
  ROUND(avg_points, 0) as average_points,
  bottom_20_count,
  bottom_10_count,
  worst_ranking,
  best_ranking,
  days_participated,
  ROUND(performance_score, 2) as performance_score
FROM ranked_performance
ORDER BY performance_score DESC
LIMIT 10;

-- =====================================================
-- ALTERNATIVE ANALYSIS: SIMPLE AVERAGE RANKING (FILTERED)
-- =====================================================
-- If you prefer a simpler approach based just on average ranking

/*
WITH top_10_achievers AS (
  SELECT DISTINCT commander
  FROM rankings
  WHERE ranking::integer <= 10
    AND commander IS NOT NULL 
    AND commander != ''
),
weekly_leaders AS (
  SELECT DISTINCT commander
  FROM (
    SELECT 
      commander,
      SUM(
        CASE 
          WHEN points ~ '^[0-9,\.]+$' THEN 
            REPLACE(REPLACE(points, ',', ''), '.', '')::numeric
          ELSE 0 
        END
      ) as weekly_points
    FROM rankings
    WHERE commander IS NOT NULL 
      AND commander != ''
      AND points ~ '^[0-9,\.]+$'
    GROUP BY commander, 
             CASE 
               WHEN day ~ '^\d{4}-\d{2}-\d{2}$' THEN 
                 DATE_TRUNC('week', day::date)
               WHEN day ~ '^\d{4}-W\d{2}$' THEN 
                 day
               ELSE 
                 day
             END
  ) weekly_scores
  WHERE weekly_points > 0
  GROUP BY commander
  HAVING COUNT(*) >= 1
)
SELECT 
  ROW_NUMBER() OVER (ORDER BY avg_ranking DESC) as rank,
  commander,
  COUNT(*) as total_appearances,
  ROUND(AVG(ranking::integer), 2) as average_ranking,
  COUNT(DISTINCT day) as days_participated,
  MIN(ranking::integer) as best_ranking,
  MAX(ranking::integer) as worst_ranking
FROM rankings
WHERE commander IS NOT NULL 
  AND commander != ''
  AND ranking ~ '^[0-9]+$'
  AND commander NOT IN (SELECT commander FROM top_10_achievers)
  AND commander NOT IN (SELECT commander FROM weekly_leaders)
GROUP BY commander
HAVING COUNT(*) >= 3
ORDER BY avg_ranking DESC
LIMIT 10;
*/

-- =====================================================
-- DATA QUALITY CHECK
-- =====================================================
-- Run this first to check the quality of your data

/*
SELECT 
  COUNT(*) as total_rankings,
  COUNT(DISTINCT commander) as unique_players,
  COUNT(DISTINCT day) as unique_days,
  COUNT(CASE WHEN ranking ~ '^[0-9]+$' THEN 1 END) as valid_rankings,
  COUNT(CASE WHEN points ~ '^[0-9,\.]+$' THEN 1 END) as valid_points,
  MIN(ranking::integer) as min_ranking,
  MAX(ranking::integer) as max_ranking
FROM rankings;
*/
