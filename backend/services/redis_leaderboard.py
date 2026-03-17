"""
Redis-based Leaderboard Service using Sorted Sets.
Provides O(log n) ranking operations for all-time, weekly, monthly, and regional leaderboards.
"""
import redis.asyncio as aioredis
import logging

logger = logging.getLogger("redis_leaderboard")

KEYS = {
    "all": "lb:all",
    "week": "lb:week",
    "month": "lb:month",
}

def region_key(region: str) -> str:
    return f"lb:region:{region.lower()}"


class RedisLeaderboard:
    def __init__(self):
        self.redis: aioredis.Redis | None = None
        self.db = None

    async def init(self, redis_url: str = "redis://localhost:6379", db=None):
        self.redis = aioredis.from_url(redis_url, decode_responses=True)
        self.db = db
        logger.info("Redis leaderboard initialized")

    async def close(self):
        if self.redis:
            await self.redis.close()

    # ── Score Updates ──

    async def update_score(self, user_id: str, points: int, region: str = ""):
        """Increment user score across all relevant leaderboards."""
        pipe = self.redis.pipeline()
        pipe.zincrby(KEYS["all"], points, user_id)
        pipe.zincrby(KEYS["week"], points, user_id)
        pipe.zincrby(KEYS["month"], points, user_id)
        if region:
            pipe.zincrby(region_key(region), points, user_id)
        await pipe.execute()

    async def set_score(self, user_id: str, total_points: int, region: str = ""):
        """Set absolute score (used during sync)."""
        pipe = self.redis.pipeline()
        pipe.zadd(KEYS["all"], {user_id: total_points})
        if region:
            pipe.zadd(region_key(region), {user_id: total_points})
        await pipe.execute()

    # ── Queries ──

    async def get_top(self, period: str = "all", limit: int = 20) -> list[dict]:
        """Get top users for a given period."""
        key = KEYS.get(period, KEYS["all"])
        entries = await self.redis.zrevrange(key, 0, limit - 1, withscores=True)
        return [{"user_id": uid, "score": int(score), "rank": i + 1} for i, (uid, score) in enumerate(entries)]

    async def get_region_top(self, region: str, limit: int = 20) -> list[dict]:
        """Get top users for a specific region."""
        key = region_key(region)
        entries = await self.redis.zrevrange(key, 0, limit - 1, withscores=True)
        return [{"user_id": uid, "score": int(score), "rank": i + 1} for i, (uid, score) in enumerate(entries)]

    async def get_user_rank(self, user_id: str, period: str = "all") -> dict:
        """Get a user's rank and score."""
        key = KEYS.get(period, KEYS["all"])
        rank = await self.redis.zrevrank(key, user_id)
        score = await self.redis.zscore(key, user_id)
        if rank is None:
            return {"rank": 0, "score": 0}
        return {"rank": rank + 1, "score": int(score or 0)}

    async def get_total_players(self, period: str = "all") -> int:
        key = KEYS.get(period, KEYS["all"])
        return await self.redis.zcard(key)

    # ── Sync from MongoDB ──

    async def sync_from_mongo(self):
        """Full sync: load all user_progress + gamification_profiles into Redis.
        Uses temporary keys to avoid inconsistent state during sync."""
        if self.db is None:
            logger.warning("No DB reference for sync")
            return 0

        # Use temporary keys to build the new leaderboard atomically
        tmp_suffix = ":tmp"
        tmp_keys = {k: v + tmp_suffix for k, v in KEYS.items()}
        tmp_region_keys = []

        # Clean up any leftover temp keys
        pipe = self.redis.pipeline()
        for k in tmp_keys.values():
            pipe.delete(k)
        await pipe.execute()

        count = 0
        # Sync from user_progress (main gamification data)
        cursor = self.db.user_progress.find({}, {"_id": 0, "user_id": 1, "total_points": 1})
        async for doc in cursor:
            uid = doc.get("user_id")
            pts = doc.get("total_points", 0)
            if uid and pts > 0:
                await self.redis.zadd(tmp_keys["all"], {uid: pts})
                count += 1

        # Also sync from gamification_profiles for region data
        cursor2 = self.db.gamification_profiles.find({}, {"_id": 0, "user_id": 1, "xp": 1, "region_counts": 1})
        async for doc in cursor2:
            uid = doc.get("user_id")
            xp = doc.get("xp", 0)
            if uid and xp > 0:
                # Update all-time if not already higher
                current = await self.redis.zscore(tmp_keys["all"], uid)
                if current is None or xp > current:
                    await self.redis.zadd(tmp_keys["all"], {uid: xp})
                # Region leaderboards
                for region_name, reg_count in doc.get("region_counts", {}).items():
                    if reg_count > 0:
                        tmp_rk = region_key(region_name) + tmp_suffix
                        await self.redis.zadd(tmp_rk, {uid: reg_count})
                        if tmp_rk not in tmp_region_keys:
                            tmp_region_keys.append(tmp_rk)

        # Atomically swap temp keys to live keys
        pipe = self.redis.pipeline()
        # Delete old live keys
        for k in KEYS.values():
            pipe.delete(k)
        async for key in self.redis.scan_iter("lb:region:*"):
            if not key.endswith(tmp_suffix):
                pipe.delete(key)
        await pipe.execute()

        # Rename temp keys to live keys
        pipe = self.redis.pipeline()
        for period, tmp_key in tmp_keys.items():
            pipe.rename(tmp_key, KEYS[period])
        for tmp_rk in tmp_region_keys:
            live_rk = tmp_rk.removesuffix(tmp_suffix)
            pipe.rename(tmp_rk, live_rk)
        try:
            await pipe.execute()
        except Exception:
            # Some temp keys may not exist if no data, that's OK
            pass

        logger.info(f"Synced {count} users from MongoDB to Redis")
        return count

    # ── Period Reset ──

    async def reset_period(self, period: str):
        """Clear a period leaderboard (called by scheduler)."""
        key = KEYS.get(period)
        if key:
            await self.redis.delete(key)
            logger.info(f"Reset leaderboard: {period}")

    # ── Enrich with user data ──

    async def enrich_entries(self, entries: list[dict]) -> list[dict]:
        """Add user name, picture, level, badges from MongoDB (bulk fetch)."""
        if self.db is None or not entries:
            return entries

        uids = [e["user_id"] for e in entries]
        uid_filter = {"user_id": {"$in": uids}}

        # Bulk fetch all data in 3 queries instead of 3*N
        users_cursor = self.db.users.find(uid_filter, {"_id": 0, "user_id": 1, "name": 1, "picture": 1})
        users_map = {u["user_id"]: u async for u in users_cursor}

        progress_cursor = self.db.user_progress.find(uid_filter, {"_id": 0, "user_id": 1, "level": 1, "badges_earned": 1})
        progress_map = {p["user_id"]: p async for p in progress_cursor}

        profiles_cursor = self.db.gamification_profiles.find(uid_filter, {"_id": 0, "user_id": 1, "display_name": 1, "xp": 1, "total_checkins": 1, "streak_days": 1, "earned_badges": 1, "region_counts": 1})
        profiles_map = {p["user_id"]: p async for p in profiles_cursor}

        result = []
        for entry in entries:
            uid = entry["user_id"]
            user = users_map.get(uid)
            progress = progress_map.get(uid)
            profile = profiles_map.get(uid)

            name = "Explorador"
            picture = None
            level = 1
            badges_count = 0
            total_checkins = 0
            streak = 0
            top_region = ""

            if user:
                name = user.get("name", name)
                picture = user.get("picture")
            if progress:
                level = progress.get("level", 1)
                badges_count = len(progress.get("badges_earned", []))
            if profile:
                name = profile.get("display_name") or name
                xp = profile.get("xp", 0)
                level = max(level, max(1, xp // 100 + 1))
                total_checkins = profile.get("total_checkins", 0)
                streak = profile.get("streak_days", 0)
                badges_count = max(badges_count, len(profile.get("earned_badges", [])))
                rc = profile.get("region_counts", {})
                if rc:
                    top_region = max(rc, key=rc.get)

            result.append({
                **entry,
                "name": name,
                "picture": picture,
                "level": level,
                "badges_count": badges_count,
                "total_checkins": total_checkins,
                "streak_days": streak,
                "top_region": top_region,
            })
        return result


redis_lb = RedisLeaderboard()
