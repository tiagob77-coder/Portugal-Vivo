"""Pure-function tests for beachcam provider resolution.

Open cameras publish as an HLS stream, a refreshing JPEG snapshot, or an
embeddable page. `resolve_provider` normalises whichever a curated entry
declares into the shape the client consumes. No DB needed.
"""
from beachcam_api import (
    BEACHCAM_DATA,
    DEFAULT_SNAPSHOT_REFRESH_SECONDS,
    VALID_PROVIDERS,
    resolve_provider,
)


class TestProviderInference:
    def test_stream_url_means_hls(self):
        cam = resolve_provider({"id": "x", "stream_url": "https://cam/live.m3u8"})
        assert cam["provider"] == "hls"
        assert cam["feed_url"] == "https://cam/live.m3u8"
        assert cam["playable"] is True

    def test_snapshot_url_means_snapshot(self):
        cam = resolve_provider({"id": "x", "snapshot_url": "https://cam/now.jpg"})
        assert cam["provider"] == "snapshot"
        assert cam["feed_url"] == "https://cam/now.jpg"

    def test_embed_url_means_iframe(self):
        cam = resolve_provider({"id": "x", "embed_url": "https://agg/cam"})
        assert cam["provider"] == "iframe"
        assert cam["feed_url"] == "https://agg/cam"

    def test_a_declared_provider_wins_over_inference(self):
        cam = resolve_provider(
            {"id": "x", "provider": "iframe", "stream_url": "https://cam/live.m3u8"}
        )
        assert cam["provider"] == "iframe"

    def test_an_invalid_declared_provider_falls_back_to_inference(self):
        cam = resolve_provider(
            {"id": "x", "provider": "carrier-pigeon", "stream_url": "https://cam/live.m3u8"}
        )
        assert cam["provider"] == "hls"

    def test_stream_wins_when_several_urls_are_present(self):
        # A camera offering both should get the better experience
        cam = resolve_provider({
            "id": "x",
            "stream_url": "https://cam/live.m3u8",
            "snapshot_url": "https://cam/now.jpg",
            "embed_url": "https://agg/cam",
        })
        assert cam["provider"] == "hls"

    def test_a_camera_without_any_url_is_listed_but_not_playable(self):
        cam = resolve_provider({"id": "x", "name": "Sem fonte"})
        assert cam["provider"] is None
        assert cam["feed_url"] is None
        assert cam["playable"] is False
        assert cam["name"] == "Sem fonte"  # continua listada


class TestSnapshotRefresh:
    def test_snapshots_get_a_default_cadence(self):
        cam = resolve_provider({"id": "x", "snapshot_url": "https://cam/now.jpg"})
        assert cam["refresh_seconds"] == DEFAULT_SNAPSHOT_REFRESH_SECONDS

    def test_a_declared_cadence_is_kept(self):
        cam = resolve_provider(
            {"id": "x", "snapshot_url": "https://cam/now.jpg", "refresh_seconds": 5}
        )
        assert cam["refresh_seconds"] == 5

    def test_only_snapshots_carry_a_cadence(self):
        cam = resolve_provider({"id": "x", "stream_url": "https://cam/live.m3u8"})
        assert "refresh_seconds" not in cam


class TestCuratedData:
    def test_resolution_never_mutates_the_curated_entry(self):
        original = dict(BEACHCAM_DATA[0])
        resolve_provider(BEACHCAM_DATA[0])
        assert BEACHCAM_DATA[0] == original

    def test_every_curated_camera_resolves_to_a_valid_provider(self):
        unresolved = [
            cam["id"] for cam in BEACHCAM_DATA
            if resolve_provider(cam)["provider"] not in VALID_PROVIDERS
        ]
        assert unresolved == []

    def test_every_curated_camera_is_playable(self):
        assert all(resolve_provider(cam)["playable"] for cam in BEACHCAM_DATA)

    def test_camera_ids_are_unique(self):
        ids = [cam["id"] for cam in BEACHCAM_DATA]
        assert len(set(ids)) == len(ids)
