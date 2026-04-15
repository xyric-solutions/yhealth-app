import { Router } from 'express';
import { spotifyController } from '../controllers/spotify.controller.js';
import { authenticate, optionalAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// ─── OAuth ────────────────────────────────────────────────
router.post('/auth/connect', authenticate, spotifyController.connect);
router.post('/auth/callback', optionalAuth, spotifyController.callback);
router.delete('/auth/disconnect', authenticate, spotifyController.disconnect);
router.get('/auth/status', authenticate, spotifyController.getStatus);

// ─── Credentials ─────────────────────────────────────────
router.post('/credentials', authenticate, spotifyController.saveCredentials);
router.get('/credentials', authenticate, spotifyController.getCredentials);
router.delete('/credentials', authenticate, spotifyController.removeCredentials);

// ─── Playlists (public with optional auth for better results) ──
router.get('/playlists/:category', optionalAuth, spotifyController.getPlaylists);
router.get('/playlists/:id/tracks', optionalAuth, spotifyController.getTracks);

// ─── Search ───────────────────────────────────────────────
router.get('/search', optionalAuth, spotifyController.search);

// ─── Recommendations ─────────────────────────────────────
router.get('/recommendations', optionalAuth, spotifyController.getRecommendations);

// ─── User Library (requires auth) ────────────────────────
router.get('/me/library', authenticate, spotifyController.getLibrary);

// ─── Playback (requires auth) ────────────────────────────
router.get('/playback/token', authenticate, spotifyController.getPlaybackToken);
router.get('/playback/state', authenticate, spotifyController.getPlaybackState);
router.put('/playback/control', authenticate, spotifyController.controlPlayback);

export default router;
