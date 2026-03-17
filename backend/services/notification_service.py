"""
Background Tasks for Automated Push Notifications
Checks surf conditions and sends alerts to subscribed users
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict
import httpx

logger = logging.getLogger(__name__)

# Expo Push Notification API
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

# Quality levels for comparison
QUALITY_LEVELS = {"flat": 0, "poor": 1, "fair": 2, "good": 3, "excellent": 4}


class SurfAlertChecker:
    """
    Background service that checks surf conditions and sends alerts
    """

    def __init__(self, db, marine_service):
        self.db = db
        self.marine_service = marine_service
        self.is_running = False
        self.check_interval = 30 * 60  # 30 minutes

    async def start(self):
        """Start the background checker"""
        if self.is_running:
            return

        self.is_running = True
        logger.info("Starting surf alert checker")

        while self.is_running:
            try:
                await self.check_and_send_alerts()
            except Exception as e:
                logger.error(f"Error in surf alert checker: {e}")

            await asyncio.sleep(self.check_interval)

    async def stop(self):
        """Stop the background checker"""
        self.is_running = False
        logger.info("Stopped surf alert checker")

    async def check_and_send_alerts(self):
        """Check conditions and send alerts to subscribed users"""
        logger.info("Checking surf conditions for alerts...")

        # Get all spots with current conditions
        spots_conditions = await self.marine_service.get_all_spots_conditions()

        # Find spots with good/excellent conditions
        alert_worthy_spots = []
        for spot in spots_conditions:
            quality = spot.get("surf_quality", "fair")
            quality_level = QUALITY_LEVELS.get(quality, 0)

            if quality_level >= QUALITY_LEVELS["good"]:
                alert_worthy_spots.append({
                    "spot_id": spot["spot_id"],
                    "spot_name": spot["spot"]["name"],
                    "wave_height_m": spot.get("wave_height_m", 0),
                    "surf_quality": quality,
                    "quality_level": quality_level
                })

        if not alert_worthy_spots:
            logger.info("No alert-worthy spots found")
            return

        logger.info(f"Found {len(alert_worthy_spots)} spots with good/excellent conditions")

        # Get users with surf alerts enabled
        alert_prefs = await self.db.surf_alerts.find(
            {"enabled": True}
        ).to_list(1000)

        # Get users with favorite spots
        favorite_spots = await self.db.favorite_spots.find({}).to_list(1000)

        # Group favorites by user
        user_favorites: Dict[str, List[Dict]] = {}
        for fav in favorite_spots:
            user_id = fav["user_id"]
            if user_id not in user_favorites:
                user_favorites[user_id] = []
            user_favorites[user_id].append(fav)

        # Prepare notifications
        notifications_to_send = []

        for spot in alert_worthy_spots:
            # Find users who should be notified about this spot
            for pref in alert_prefs:
                user_id = pref["user_id"]
                min_quality = pref.get("min_quality", "good")
                subscribed_spots = pref.get("spots", [])

                # Check if user is subscribed to this spot
                if spot["spot_id"] in subscribed_spots:
                    # Check if quality meets user's preference
                    if spot["quality_level"] >= QUALITY_LEVELS.get(min_quality, 3):
                        notifications_to_send.append({
                            "user_id": user_id,
                            "spot": spot,
                            "type": "surf_alert_subscription"
                        })

            # Also notify users who have this spot as favorite
            for user_id, favorites in user_favorites.items():
                for fav in favorites:
                    if fav["spot_id"] == spot["spot_id"]:
                        # Check notification preferences
                        if spot["surf_quality"] == "excellent" and fav.get("notify_excellent", True):
                            notifications_to_send.append({
                                "user_id": user_id,
                                "spot": spot,
                                "type": "favorite_spot_alert"
                            })
                        elif spot["surf_quality"] == "good" and fav.get("notify_good", False):
                            notifications_to_send.append({
                                "user_id": user_id,
                                "spot": spot,
                                "type": "favorite_spot_alert"
                            })

        # Deduplicate notifications (one per user per spot)
        seen = set()
        unique_notifications = []
        for notif in notifications_to_send:
            key = (notif["user_id"], notif["spot"]["spot_id"])
            if key not in seen:
                seen.add(key)
                unique_notifications.append(notif)

        logger.info(f"Prepared {len(unique_notifications)} notifications to send")

        # Send notifications
        for notif in unique_notifications:
            await self.send_notification(notif)

    async def send_notification(self, notification: Dict):
        """Send a push notification to a user"""
        user_id = notification["user_id"]
        spot = notification["spot"]

        # Get user's push tokens
        tokens = await self.db.push_tokens.find(
            {"user_id": user_id, "active": True}
        ).to_list(10)

        if not tokens:
            logger.debug(f"No push tokens for user {user_id}")
            return

        # Build notification payload
        quality_emoji = "🏄‍♂️" if spot["surf_quality"] == "excellent" else "🌊"
        title = f"{quality_emoji} {spot['spot_name']}"
        body = f"Condições {spot['surf_quality']}! Ondas de {spot['wave_height_m']:.1f}m"

        # Prepare Expo push messages
        messages = []
        for token_doc in tokens:
            token = token_doc["token"]
            if token.startswith("ExponentPushToken"):
                messages.append({
                    "to": token,
                    "title": title,
                    "body": body,
                    "sound": "default",
                    "data": {
                        "type": "surf_alert",
                        "spot_id": spot["spot_id"],
                        "quality": spot["surf_quality"]
                    },
                    "channelId": "surf-alerts"
                })

        if not messages:
            return

        # Send via Expo Push API
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    EXPO_PUSH_URL,
                    json=messages,
                    headers={"Content-Type": "application/json"}
                )

                if response.status_code == 200:
                    logger.info(f"Sent surf alert to user {user_id} for {spot['spot_name']}")

                    # Record in notification history
                    await self.db.notification_history.insert_one({
                        "user_id": user_id,
                        "type": "surf_alert",
                        "title": title,
                        "body": body,
                        "data": {
                            "spot_id": spot["spot_id"],
                            "quality": spot["surf_quality"],
                            "wave_height_m": spot["wave_height_m"]
                        },
                        "sent_at": datetime.now(timezone.utc),
                        "status": "sent"
                    })
                else:
                    logger.error(f"Failed to send notification: {response.status_code}")
        except Exception as e:
            logger.error(f"Error sending push notification: {e}")


class GeofenceAlertChecker:
    """
    Checks user locations against POI geofences and sends notifications
    This would typically be triggered by location updates from the mobile app
    """

    def __init__(self, db):
        self.db = db
        self.geofence_radius_m = 500
        self.cooldown_minutes = 30

    async def check_user_location(self, user_id: str, lat: float, lng: float):
        """
        Check if user is near any POIs and should receive notification
        Called when user location is updated
        """
        # Check notification preferences
        prefs = await self.db.notification_prefs.find_one({"user_id": user_id})
        if not prefs or not prefs.get("geofence_alerts", True):
            return None

        # Find nearby heritage items
        nearby_items = await self.db.heritage_items.find({
            "location": {
                "$near": {
                    "$geometry": {
                        "type": "Point",
                        "coordinates": [lng, lat]
                    },
                    "$maxDistance": self.geofence_radius_m
                }
            }
        }).limit(5).to_list(5)

        if not nearby_items:
            return None

        # Check cooldown for each item
        now = datetime.now(timezone.utc)
        notifications_sent = []

        for item in nearby_items:
            # Check if we recently notified about this item
            recent_notification = await self.db.notification_history.find_one({
                "user_id": user_id,
                "type": "geofence",
                "data.item_id": item["id"],
                "sent_at": {"$gt": now - timedelta(minutes=self.cooldown_minutes)}
            })

            if recent_notification:
                continue

            # Send notification
            notification = await self.send_geofence_notification(user_id, item)
            if notification:
                notifications_sent.append(notification)

        return notifications_sent if notifications_sent else None

    async def send_geofence_notification(self, user_id: str, item: Dict):
        """Send a geofence notification"""
        # Get user's push tokens
        tokens = await self.db.push_tokens.find(
            {"user_id": user_id, "active": True}
        ).to_list(10)

        if not tokens:
            return None

        title = f"📍 {item['name']}"
        body = f"Está perto de {item['name']}! Descubra mais sobre este local."

        # Prepare Expo push messages
        messages = []
        for token_doc in tokens:
            token = token_doc["token"]
            if token.startswith("ExponentPushToken"):
                messages.append({
                    "to": token,
                    "title": title,
                    "body": body,
                    "sound": "default",
                    "data": {
                        "type": "geofence",
                        "item_id": item["id"],
                        "category": item.get("category")
                    },
                    "channelId": "geofence"
                })

        if not messages:
            return None

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    EXPO_PUSH_URL,
                    json=messages,
                    headers={"Content-Type": "application/json"}
                )

                if response.status_code == 200:
                    # Record in notification history
                    await self.db.notification_history.insert_one({
                        "user_id": user_id,
                        "type": "geofence",
                        "title": title,
                        "body": body,
                        "data": {
                            "item_id": item["id"],
                            "item_name": item["name"]
                        },
                        "sent_at": datetime.now(timezone.utc),
                        "status": "sent"
                    })

                    return {"item_id": item["id"], "item_name": item["name"]}
        except Exception as e:
            logger.error(f"Error sending geofence notification: {e}")

        return None

