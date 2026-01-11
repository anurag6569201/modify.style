import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import {
  Circle,
  Square,
  Monitor,
  Video,
  CheckCircle2,
  AlertCircle,
  Pause,
  Sparkles,
  Settings,
  Mic,
  Keyboard,
  Bookmark,
  ChevronDown,
  ChevronUp,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Move,
  Lightbulb,
  TrendingUp,
  Info,
  X,
  Zap,
  Activity,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { ParticleSystem } from "@/lib/effects/particles";
import { extensionEventToMoveData, extensionEventToClickData } from "@/lib/extension/coordinate-mapper";
import { extensionWS } from "@/lib/extension/websocket";
import { SimpleViewportManager } from "@/lib/recorder/viewport-manager";

// Extension mouse event type (moved here to avoid WebSocket dependency)
export interface ExtensionMouseEvent {
  type: "mouse";
  t: number;
  clientX: number;
  clientY: number;
  pageX: number;
  pageY: number;
  screenX: number;
  screenY: number;
  vv: {
    x: number;
    y: number;
    scale: number;
  };
  vw: number;
  vh: number;
  dpr: number;
  eventType: "move" | "down" | "up";
}

type RecordingState = "idle" | "selecting" | "ready" | "countdown" | "recording" | "paused" | "stopped";
type AudioSource = "system" | "microphone" | "both" | "none";
type RecordingQuality = "high" | "medium" | "low";
type ZoomState = "NEUTRAL" | "FOCUSED" | "HOLD" | "DECAY";

// 🎯 Content-Aware Zoom Intelligence
const CAMERA_PRESETS = {
  cinematic: {
    name: 'Cinematic',
    stiffness: 0.1,
    damping: 0.9,
    description: 'Smooth, stabilized camera movement for professional blocking',
    anticipation: 0.2
  },
  fast: {
    name: 'Fast',
    stiffness: 0.4,
    damping: 0.7,
    description: 'Responsive, quick movement for high-paced content',
    anticipation: 0.1
  },
  manual: {
    name: 'Manual',
    stiffness: 0.8,
    damping: 0.5,
    description: 'Gentle, manual control for precise positioning',
    anticipation: 0
  }
};

// 🎯 Adaptive Camera Learning System
class AdaptiveCameraLearner {
  private userPreferences = {
    preferredZoomRange: { min: 1.0, max: 2.0 },
    responsivenessLevel: 0.5, // 0 = very smooth, 1 = very responsive
    anticipationStrength: 0.3,
    dampingPreference: 0.8,
    zoomFrequency: 0, // How often user triggers zoom
    gestureUsage: 0, // How often user uses gestures
    avgSessionDuration: 0,
    learningRate: 0.1
  };

  private sessionStats = {
    zoomsTriggered: 0,
    gesturesUsed: 0,
    avgZoomLevel: 1.0,
    movementSmoothness: 0.5,
    startTime: Date.now(),
    lastUpdateTime: Date.now()
  };

  // Update learning based on user actions
  recordZoomAction(zoomLevel: number, triggerReason: string): void {
    this.sessionStats.zoomsTriggered++;
    this.sessionStats.avgZoomLevel = (this.sessionStats.avgZoomLevel + zoomLevel) / 2;

    // Learn from zoom patterns
    if (triggerReason === 'reading') {
      this.userPreferences.preferredZoomRange.max = Math.max(
        this.userPreferences.preferredZoomRange.max,
        zoomLevel * 1.1
      );
    } else if (triggerReason === 'targeting') {
      this.userPreferences.responsivenessLevel = Math.min(
        this.userPreferences.responsivenessLevel + 0.1, 1.0
      );
    }
  }

  recordGestureUsage(gestureType: string): void {
    this.sessionStats.gesturesUsed++;

    // Learn gesture preferences
    if (gestureType === 'circle' || gestureType === 'swipe') {
      this.userPreferences.gestureUsage = Math.min(this.userPreferences.gestureUsage + 0.2, 1.0);
    }
  }

  recordMovementPattern(smoothness: number, avgVelocity: number): void {
    this.sessionStats.movementSmoothness = smoothness;

    // Adapt to user movement style
    if (smoothness > 0.7) {
      // Precise user - increase anticipation and damping
      this.userPreferences.anticipationStrength = Math.min(
        this.userPreferences.anticipationStrength + 0.05, 0.5
      );
      this.userPreferences.dampingPreference = Math.min(
        this.userPreferences.dampingPreference + 0.05, 0.95
      );
    } else if (smoothness < 0.3) {
      // Erratic user - decrease anticipation, increase responsiveness
      this.userPreferences.anticipationStrength = Math.max(
        this.userPreferences.anticipationStrength - 0.05, 0.1
      );
      this.userPreferences.responsivenessLevel = Math.min(
        this.userPreferences.responsivenessLevel + 0.1, 1.0
      );
    }
  }

  // Get adaptive camera parameters
  getAdaptiveParameters(): {
    stiffnessMultiplier: number;
    dampingMultiplier: number;
    anticipationMultiplier: number;
    zoomBias: number;
  } {
    return {
      stiffnessMultiplier: 0.5 + this.userPreferences.responsivenessLevel * 0.5,
      dampingMultiplier: 0.5 + this.userPreferences.dampingPreference * 0.5,
      anticipationMultiplier: this.userPreferences.anticipationStrength,
      zoomBias: (this.sessionStats.avgZoomLevel - 1.0) * 0.2 // Slight bias toward user's preferred zoom range
    };
  }

  // Get session insights
  getSessionInsights(): {
    userType: string;
    recommendations: string[];
    confidence: number;
  } {
    const insights = {
      userType: 'balanced',
      recommendations: [] as string[],
      confidence: 0.5
    };

    if (this.userPreferences.responsivenessLevel > 0.7) {
      insights.userType = 'fast_interactor';
      insights.recommendations.push('Consider fast camera mode for quicker responses');
    } else if (this.userPreferences.dampingPreference > 0.8) {
      insights.userType = 'methodical_user';
      insights.recommendations.push('Cinematic mode works well for your style');
    }

    if (this.userPreferences.gestureUsage > 0.5) {
      insights.recommendations.push('You use gestures frequently - gesture controls are optimized for you');
    }

    if (this.sessionStats.zoomsTriggered > 10) {
      insights.recommendations.push('You zoom frequently - zoom sensitivity has been increased');
    }

    return insights;
  }

  // Save/load preferences (could be extended to localStorage)
  savePreferences(): void {
    try {
      localStorage.setItem('cameraLearnings', JSON.stringify(this.userPreferences));
    } catch (e) {
      console.warn('Could not save camera preferences');
    }
  }

  loadPreferences(): void {
    try {
      const saved = localStorage.getItem('cameraLearnings');
      if (saved) {
        this.userPreferences = { ...this.userPreferences, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Could not load camera preferences');
    }
  }
}

// 🎯 AI-Powered Intent Detection System
class CursorIntentAnalyzer {
  private movementHistory: Array<{
    x: number;
    y: number;
    timestamp: number;
    velocity: { x: number; y: number };
    acceleration: { x: number; y: number };
  }> = [];

  private intentPatterns = {
    reading: { velocityThreshold: 0.1, accelerationThreshold: 0.05, dwellTime: 2000 },
    scanning: { velocityThreshold: 0.3, accelerationThreshold: 0.2, dwellTime: 500 },
    targeting: { velocityThreshold: 0.5, accelerationThreshold: 1.0, dwellTime: 100 },
    gesturing: { velocityThreshold: 0.8, accelerationThreshold: 2.0, dwellTime: 50 }
  };

  private gestureBuffer: Array<{ x: number; y: number; timestamp: number }> = [];
  private lastIntent = 'neutral';
  private confidence = 0;

  // Add cursor movement data for analysis
  addMovement(x: number, y: number, timestamp: number): void {
    // Calculate velocity and acceleration
    const prev = this.movementHistory[this.movementHistory.length - 1];
    const velocity = prev ? {
      x: (x - prev.x) / (timestamp - prev.timestamp) * 1000,
      y: (y - prev.y) / (timestamp - prev.timestamp) * 1000
    } : { x: 0, y: 0 };

    const acceleration = prev && prev.velocity ? {
      x: (velocity.x - prev.velocity.x) / (timestamp - prev.timestamp) * 1000,
      y: (velocity.y - prev.velocity.y) / (timestamp - prev.timestamp) * 1000
    } : { x: 0, y: 0 };

    this.movementHistory.push({ x, y, timestamp, velocity, acceleration });

    // Maintain history window
    const cutoff = timestamp - CAMERA_CONFIG.INTENT_ANALYSIS_WINDOW_MS;
    this.movementHistory = this.movementHistory.filter(m => m.timestamp > cutoff);

    // Add to gesture buffer
    this.gestureBuffer.push({ x, y, timestamp });
    const gestureCutoff = timestamp - CAMERA_CONFIG.GESTURE_RECOGNITION_TIME_MS;
    this.gestureBuffer = this.gestureBuffer.filter(g => g.timestamp > gestureCutoff);
  }

  // Get recommended camera preset based on current intent
  getRecommendedPreset(): keyof typeof CAMERA_PRESETS {
    const intent = this.analyzeIntent();

    // Map intents to camera presets
    switch (intent.intent) {
      case 'reading':
        return 'cinematic'; // Smooth, stable for reading
      case 'targeting':
        return 'fast'; // Quick and responsive for targeting
      case 'gesturing':
        return 'manual'; // Precise control for gestures
      case 'scanning':
        return 'cinematic'; // Balanced for scanning
      default:
        // Adaptive based on movement statistics
        const stats = this.getMovementStats();
        if (stats.movementSmoothness > 0.7 && stats.avgVelocity < 0.2) {
          return 'cinematic'; // Smooth, slow movements
        } else if (stats.avgVelocity > 0.4) {
          return 'fast'; // Fast movements
        } else {
          return 'cinematic'; // Default to cinematic
        }
    }
  }

  // Analyze current intent based on movement patterns
  analyzeIntent(): {
    intent: string;
    confidence: number;
    predictedPosition?: { x: number; y: number };
    zoomSuggestion?: number;
    cameraMode?: 'cinematic' | 'fast' | 'manual';
  } {
    if (this.movementHistory.length < 3) {
      return { intent: 'neutral', confidence: 0 };
    }

    const recent = this.movementHistory.slice(-10);
    const avgVelocity = {
      x: recent.reduce((sum, m) => sum + Math.abs(m.velocity.x), 0) / recent.length,
      y: recent.reduce((sum, m) => sum + Math.abs(m.velocity.y), 0) / recent.length
    };

    const avgAcceleration = {
      x: recent.reduce((sum, m) => sum + Math.abs(m.acceleration.x), 0) / recent.length,
      y: recent.reduce((sum, m) => sum + Math.abs(m.acceleration.y), 0) / recent.length
    };

    const totalVelocity = Math.sqrt(avgVelocity.x ** 2 + avgVelocity.y ** 2);
    const totalAcceleration = Math.sqrt(avgAcceleration.x ** 2 + avgAcceleration.y ** 2);

    // Determine intent based on velocity and acceleration patterns
    let intent = 'neutral';
    let confidence = 0;
    let zoomSuggestion = 1.0;
    let cameraMode: 'cinematic' | 'fast' | 'manual' = 'cinematic';

    if (totalVelocity < this.intentPatterns.reading.velocityThreshold) {
      // Reading/Examining - slow, deliberate movement
      intent = 'reading';
      confidence = Math.min(1, 1 - totalVelocity / this.intentPatterns.reading.velocityThreshold);
      zoomSuggestion = 1.4 + (confidence * 0.3); // 1.4x to 1.7x zoom
      cameraMode = 'cinematic';
    } else if (totalVelocity < this.intentPatterns.scanning.velocityThreshold) {
      // Scanning/Navigation - moderate movement
      intent = 'scanning';
      confidence = Math.min(1, totalVelocity / this.intentPatterns.scanning.velocityThreshold);
      zoomSuggestion = 1.2 + (confidence * 0.2); // 1.2x to 1.4x zoom
      cameraMode = 'cinematic';
    } else if (totalAcceleration > this.intentPatterns.targeting.accelerationThreshold) {
      // Targeting/Clicking - high acceleration toward target
      intent = 'targeting';
      confidence = Math.min(1, totalAcceleration / this.intentPatterns.targeting.accelerationThreshold);
      zoomSuggestion = 1.6 + (confidence * 0.4); // 1.6x to 2.0x zoom
      cameraMode = 'fast';
    } else if (totalVelocity > this.intentPatterns.gesturing.velocityThreshold) {
      // Gesturing - complex movement patterns
      intent = 'gesturing';
      confidence = Math.min(1, totalVelocity / this.intentPatterns.gesturing.velocityThreshold);
      zoomSuggestion = 1.1; // Slight zoom out for gesture overview
      cameraMode = 'manual';

      // Analyze gesture pattern
      if (this.gestureBuffer.length > 5) {
        const gesture = this.analyzeGesture();
        if (gesture.type === 'circle') {
          intent = 'circular_gesture';
          zoomSuggestion = 1.3;
        } else if (gesture.type === 'zigzag') {
          intent = 'selection_gesture';
          zoomSuggestion = 1.5;
        }
      }
    }

    // Predict next position based on velocity and acceleration
    const latest = this.movementHistory[this.movementHistory.length - 1];
    const predictedPosition = this.predictPosition(CAMERA_CONFIG.PREDICTION_HORIZON_MS);

    // Smooth confidence transitions
    this.confidence = this.confidence * 0.9 + confidence * 0.1;
    this.lastIntent = intent;

    return {
      intent,
      confidence: this.confidence,
      predictedPosition,
      zoomSuggestion: Math.min(CAMERA_CONFIG.ZOOM_MAX, Math.max(CAMERA_CONFIG.ZOOM_MIN, zoomSuggestion)),
      cameraMode
    };
  }

  // Predict where cursor will be in the future
  private predictPosition(horizonMs: number): { x: number; y: number } {
    if (this.movementHistory.length < 2) return { x: 0, y: 0 };

    const latest = this.movementHistory[this.movementHistory.length - 1];
    const prev = this.movementHistory[this.movementHistory.length - 2];

    const dt = (latest.timestamp - prev.timestamp) / 1000;
    if (dt === 0) return latest;

    // Use velocity and acceleration for prediction
    const velocity = latest.velocity;
    const acceleration = latest.acceleration;

    const predictionTime = horizonMs / 1000;
    const predictedX = latest.x + velocity.x * predictionTime + 0.5 * acceleration.x * predictionTime ** 2;
    const predictedY = latest.y + velocity.y * predictionTime + 0.5 * acceleration.y * predictionTime ** 2;

    // Clamp to valid range
    return {
      x: Math.max(0, Math.min(1, predictedX)),
      y: Math.max(0, Math.min(1, predictedY))
    };
  }

  // Analyze gesture patterns with camera control commands
  analyzeGesture(): { type: string; confidence: number; command?: string } {
    if (this.gestureBuffer.length < 5) return { type: 'unknown', confidence: 0 };

    // 🎯 Camera Control Gestures

    // 1. Circle gesture (clockwise = zoom in, counter-clockwise = zoom out)
    const circleResult = this.detectCircleGesture();
    if (circleResult.confidence > 0.7) {
      return {
        type: 'circle',
        confidence: circleResult.confidence,
        command: circleResult.clockwise ? 'zoom_in' : 'zoom_out'
      };
    }

    // 2. Figure-8 gesture (switch camera modes)
    const figure8Result = this.detectFigure8Gesture();
    if (figure8Result.confidence > 0.6) {
      return {
        type: 'figure8',
        confidence: figure8Result.confidence,
        command: 'switch_mode'
      };
    }

    // 3. Swipe gestures (pan camera)
    const swipeResult = this.detectSwipeGesture();
    if (swipeResult.confidence > 0.7) {
      return {
        type: 'swipe',
        confidence: swipeResult.confidence,
        command: `pan_${swipeResult.direction}`
      };
    }

    // 4. Double tap gesture (reset camera)
    const tapResult = this.detectDoubleTapGesture();
    if (tapResult.confidence > 0.8) {
      return {
        type: 'double_tap',
        confidence: tapResult.confidence,
        command: 'reset_camera'
      };
    }

    // 5. Zigzag gesture (selection/emphasis)
    const zigzagResult = this.detectZigzagGesture();
    if (zigzagResult.confidence > 0.6) {
      return {
        type: 'zigzag',
        confidence: zigzagResult.confidence,
        command: 'emphasize_selection'
      };
    }

    return { type: 'unknown', confidence: 0 };
  }

  private detectCircleGesture(): { confidence: number; clockwise: boolean } {
    if (this.gestureBuffer.length < 8) return { confidence: 0, clockwise: false };

    const center = {
      x: this.gestureBuffer.reduce((sum, p) => sum + p.x, 0) / this.gestureBuffer.length,
      y: this.gestureBuffer.reduce((sum, p) => sum + p.y, 0) / this.gestureBuffer.length
    };

    const avgRadius = this.gestureBuffer.reduce((sum, p) => {
      const dx = p.x - center.x;
      const dy = p.y - center.y;
      return sum + Math.sqrt(dx * dx + dy * dy);
    }, 0) / this.gestureBuffer.length;

    // Check circularity
    const circularity = this.gestureBuffer.reduce((score, p) => {
      const dx = p.x - center.x;
      const dy = p.y - center.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return score + Math.abs(distance - avgRadius) / avgRadius;
    }, 0) / this.gestureBuffer.length;

    if (circularity > 0.4) return { confidence: 0, clockwise: false };

    // Determine direction (clockwise vs counter-clockwise)
    let totalAngle = 0;
    for (let i = 1; i < this.gestureBuffer.length; i++) {
      const prev = this.gestureBuffer[i - 1];
      const curr = this.gestureBuffer[i];

      const angle1 = Math.atan2(prev.y - center.y, prev.x - center.x);
      const angle2 = Math.atan2(curr.y - center.y, curr.x - center.x);

      let deltaAngle = angle2 - angle1;
      // Normalize to [-π, π]
      while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
      while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

      totalAngle += deltaAngle;
    }

    const clockwise = totalAngle > 0;
    return { confidence: Math.max(0, 1 - circularity), clockwise };
  }

  private detectFigure8Gesture(): { confidence: number } {
    // Simplified figure-8 detection - two loops crossing each other
    if (this.gestureBuffer.length < 12) return { confidence: 0 };

    // Check for crossing pattern
    const mid = Math.floor(this.gestureBuffer.length / 2);
    const firstHalf = this.gestureBuffer.slice(0, mid);
    const secondHalf = this.gestureBuffer.slice(mid);

    const firstCenter = {
      x: firstHalf.reduce((sum, p) => sum + p.x, 0) / firstHalf.length,
      y: firstHalf.reduce((sum, p) => sum + p.y, 0) / firstHalf.length
    };

    const secondCenter = {
      x: secondHalf.reduce((sum, p) => sum + p.x, 0) / secondHalf.length,
      y: secondHalf.reduce((sum, p) => sum + p.y, 0) / secondHalf.length
    };

    // Check if centers are close (crossing pattern)
    const dx = secondCenter.x - firstCenter.x;
    const dy = secondCenter.y - firstCenter.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return { confidence: Math.max(0, 1 - distance * 2) }; // Closer centers = higher confidence
  }

  private detectSwipeGesture(): { confidence: number; direction: string } {
    if (this.gestureBuffer.length < 6) return { confidence: 0, direction: 'none' };

    const start = this.gestureBuffer[0];
    const end = this.gestureBuffer[this.gestureBuffer.length - 1];

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 0.2) return { confidence: 0, direction: 'none' };

    // Determine direction
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    let direction = 'none';

    if (Math.abs(dx) > Math.abs(dy)) {
      direction = dx > 0 ? 'right' : 'left';
    } else {
      direction = dy > 0 ? 'down' : 'up';
    }

    // Check if path is reasonably straight
    const straightness = this.gestureBuffer.reduce((score, point, index) => {
      if (index === 0 || index === this.gestureBuffer.length - 1) return score;

      const expectedX = start.x + (dx * index) / (this.gestureBuffer.length - 1);
      const expectedY = start.y + (dy * index) / (this.gestureBuffer.length - 1);

      const actualDx = point.x - expectedX;
      const actualDy = point.y - expectedY;
      const deviation = Math.sqrt(actualDx * actualDx + actualDy * actualDy);

      return score + deviation;
    }, 0) / this.gestureBuffer.length;

    const straightnessScore = Math.max(0, 1 - straightness * 3);

    return {
      confidence: Math.min(straightnessScore, distance / 0.5),
      direction
    };
  }

  private detectDoubleTapGesture(): { confidence: number } {
    // Look for two quick taps in sequence
    if (this.gestureBuffer.length < 8) return { confidence: 0 };

    // Find stationary periods (taps)
    const stationaryThreshold = 0.02;
    const minTapDuration = 100; // ms
    const taps: { start: number; end: number }[] = [];

    let currentTapStart = -1;
    for (let i = 1; i < this.gestureBuffer.length; i++) {
      const prev = this.gestureBuffer[i - 1];
      const curr = this.gestureBuffer[i];

      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const movement = Math.sqrt(dx * dx + dy * dy);

      if (movement < stationaryThreshold) {
        if (currentTapStart === -1) {
          currentTapStart = i - 1;
        }
      } else {
        if (currentTapStart !== -1) {
          const tapDuration = (curr.timestamp - this.gestureBuffer[currentTapStart].timestamp);
          if (tapDuration >= minTapDuration) {
            taps.push({ start: currentTapStart, end: i - 1 });
          }
          currentTapStart = -1;
        }
      }
    }

    // Check for two taps close together
    if (taps.length >= 2) {
      const firstTap = taps[taps.length - 2];
      const secondTap = taps[taps.length - 1];

      const timeBetweenTaps = this.gestureBuffer[secondTap.start].timestamp -
        this.gestureBuffer[firstTap.end].timestamp;

      if (timeBetweenTaps < 500) { // Less than 500ms between taps
        return { confidence: Math.min(1, 1 - timeBetweenTaps / 500) };
      }
    }

    return { confidence: 0 };
  }

  private detectZigzagGesture(): { confidence: number } {
    if (this.gestureBuffer.length < 6) return { confidence: 0 };

    // Count direction changes
    let directionChanges = 0;
    let lastDirection = 0;

    for (let i = 2; i < this.gestureBuffer.length; i++) {
      const prev = this.gestureBuffer[i - 2];
      const mid = this.gestureBuffer[i - 1];
      const curr = this.gestureBuffer[i];

      const dir1 = Math.atan2(mid.y - prev.y, mid.x - prev.x);
      const dir2 = Math.atan2(curr.y - mid.y, curr.x - mid.x);
      const angleDiff = Math.abs(dir2 - dir1);

      if (angleDiff > Math.PI / 2) { // 90 degree change
        directionChanges++;
      }
    }

    return { confidence: Math.min(1, directionChanges / 3) };
  }

  // Get movement statistics for adaptive behavior
  getMovementStats(): {
    avgVelocity: number;
    avgAcceleration: number;
    movementSmoothness: number;
    predictability: number;
  } {
    if (this.movementHistory.length < 5) {
      return { avgVelocity: 0, avgAcceleration: 0, movementSmoothness: 0, predictability: 0 };
    }

    const recent = this.movementHistory.slice(-20);
    const avgVelocity = recent.reduce((sum, m) =>
      sum + Math.sqrt(m.velocity.x ** 2 + m.velocity.y ** 2), 0) / recent.length;

    const avgAcceleration = recent.reduce((sum, m) =>
      sum + Math.sqrt(m.acceleration.x ** 2 + m.acceleration.y ** 2), 0) / recent.length;

    // Calculate movement smoothness (lower variance = smoother)
    const velocities = recent.map(m => Math.sqrt(m.velocity.x ** 2 + m.velocity.y ** 2));
    const velocityVariance = velocities.reduce((sum, v) => sum + (v - avgVelocity) ** 2, 0) / velocities.length;
    const movementSmoothness = Math.max(0, 1 - velocityVariance / (avgVelocity ** 2 || 1));

    // Calculate predictability (how consistent direction changes are)
    let directionChanges = 0;
    for (let i = 1; i < recent.length - 1; i++) {
      const prev = recent[i - 1];
      const curr = recent[i];
      const next = recent[i + 1];

      const dir1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
      const dir2 = Math.atan2(next.y - curr.y, next.x - curr.x);
      const angleDiff = Math.abs(dir2 - dir1);

      if (angleDiff > Math.PI / 6) { // 30 degree change
        directionChanges++;
      }
    }
    const predictability = Math.max(0, 1 - directionChanges / (recent.length - 2));

    return { avgVelocity, avgAcceleration, movementSmoothness, predictability };
  }
}

export interface ClickData {
  x: number;
  y: number;
  timestamp: number;
  screenWidth: number;
  screenHeight: number;
  type: "click" | "doubleClick" | "rightClick";
  elementInfo?: {
    tagName?: string;
    text?: string;
    className?: string;
    rect?: { // Normalized 0-1
      left: number;
      top: number;
      width: number;
      height: number;
    };
    semanticType?: "primary" | "secondary" | "danger" | "neutral";
  };
}

export interface MoveData {
  x: number;
  y: number;
  timestamp: number;
  screenWidth: number;
  screenHeight: number;
}

export interface EffectEvent {
  id: string;
  type: 'spotlight' | 'zoom' | string;
  /**
   * Start time of the effect on the timeline (seconds).
   */
  start: number;
  /**
   * End time of the effect on the timeline (seconds).
   */
  end: number;
  /**
   * Optional zoom level/intensity for spotlight/zoom effects.
   */
  zoom?: number;
  /**
   * Horizontal pan offset (-1 to 1, where 0 is center, -1 is left, 1 is right)
   */
  panX?: number;
  /**
   * Vertical pan offset (-1 to 1, where 0 is center, -1 is up, 1 is down)
   */
  panY?: number;
  /**
   * Transition easing type
   */
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bounce';
  /**
   * Transition speed multiplier (0.5 = slow, 2.0 = fast)
   */
  transitionSpeed?: number;
  /**
   * Optional user-facing label.
   */
  label?: string;
  /**
   * Backwards compatibility: keep timestamp/payload if coming from older recordings.
   */
  timestamp?: number;
  metadata?: Record<string, any>;
}

interface RecordingMarker {
  timestamp: number;
  label: string;
}

// 🎯 PRODUCTION CONSTANTS - Centralized configuration for maintainability
// 🎥 Redesigned Camera System - Clean, Simple, Effective
const CAMERA_CONFIG = {
  // Zoom levels
  ZOOM_MIN: 1.0,
  ZOOM_MAX: 3.0,
  ZOOM_DEFAULT: 1.0,

  // Smooth zoom presets
  ZOOM_LEVELS: {
    DEFAULT: 1.0,
    SUBTLE: 1.3,    // Subtle zoom for reading
    MEDIUM: 1.6,    // Medium zoom for interactions
    FOCUS: 2.0,     // Strong zoom for detailed work
    MAX: 3.0,       // Maximum zoom
  },

  // Animation timing
  ZOOM_TRANSITION_MS: 300,      // Smooth zoom transitions
  PAN_TRANSITION_MS: 100,       // Quick pan movements
  EASE_FUNCTION: 'cubic-bezier(0.4, 0, 0.2, 1)', // Smooth ease

  // Auto-zoom behavior
  AUTO_ZOOM: {
    ENABLED: true,
    CLICK_DELAY_MS: 150,        // Delay before zoom on click
    HOVER_DELAY_MS: 800,        // Delay before zoom on hover
    IDLE_TIMEOUT_MS: 3000,      // Return to normal after idle
    MIN_MOVEMENT_PX: 50,        // Minimum movement to break idle
  },

  // Smart detection
  ACTIVITY_ZONES: {
    CENTER: { radius: 0.6, zoom: 1.0 },      // Center zone - no zoom
    MIDDLE: { radius: 1.0, zoom: 1.6 },      // Middle zone - slight zoom
    EDGE: { radius: 1.0, zoom: 1.6 },        // Edge zone - more zoom
  },

  // Viewport behavior
  VIEWPORT: {
    CURSOR_LEAD: 0.15,          // How much cursor leads viewport (0-1)
    EDGE_MARGIN: 0.1,           // Margin from edges (10%)
    SMOOTH_FACTOR: 0.85,        // Smoothing for movements
  },

  // Performance
  UPDATE_INTERVAL_MS: 16,       // ~60fps
  POSITION_THRESHOLD: 2,        // Minimum pixels to trigger update
} as const;


export default function Recorder() {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [timer, setTimer] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [user, setUser] = useState<{ name: string; email: string } | undefined>(undefined);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Recording settings
  const [countdownDuration, setCountdownDuration] = useState(5);
  const [audioSource, setAudioSource] = useState<AudioSource>("both");
  const [recordingQuality, setRecordingQuality] = useState<RecordingQuality>("high");
  const [rawRecording, setRawRecording] = useState(() => {
    const saved = localStorage.getItem("recorder_rawRecording");
    return saved !== null ? saved === "true" : false; // Default to false (canvas with effects)
  });
  const [showSettings, setShowSettings] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [markers, setMarkers] = useState<RecordingMarker[]>([]);
  const [micLevel, setMicLevel] = useState(0);
  const [estimatedSize, setEstimatedSize] = useState(0);
  const [showSmartTips, setShowSmartTips] = useState(true);
  const [activeTip, setActiveTip] = useState<string | null>(null);
  const [interactionCount, setInteractionCount] = useState(0);
  const [avgClickInterval, setAvgClickInterval] = useState<number | null>(null);
  const [recordingQualityScore, setRecordingQualityScore] = useState<number>(100);

  // Visual effects settings
  const [cursorEffects, setCursorEffects] = useState(true);
  const [clickRipple, setClickRipple] = useState(true);
  const [cursorGlow, setCursorGlow] = useState(true);
  const [cursorTrail, setCursorTrail] = useState(false);
  const [showClickIndicator, setShowClickIndicator] = useState(true);
  const [completePathCapture, setCompletePathCapture] = useState(true);

  // Simplified viewport and cursor following settings
  const [viewportZoom, setViewportZoom] = useState(1);
  const zoomLevel = viewportZoom; // Alias for compatibility
  const [viewportPan, setViewportPan] = useState({ x: 0, y: 0 });
  const [followCursor, setFollowCursor] = useState(() => {
    const saved = localStorage.getItem("recorder_followCursor");
    return saved !== null ? saved === "true" : true; // Default to true
  });
  const [currentCursorPos, setCurrentCursorPos] = useState<{ x: number; y: number } | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const viewportManagerRef = useRef<SimpleViewportManager | null>(null);
  const [autoZoomEnabled, setAutoZoomEnabled] = useState(true);
  const [zoomState, setZoomState] = useState<ZoomState>("NEUTRAL");
  const [cursorIndicatorPos, setCursorIndicatorPos] = useState<{ x: number, y: number } | null>(null);

  // Simplified tracking refs
  const lastActivityTimeRef = useRef<number>(Date.now());
  const lastClickPositionRef = useRef<{ x: number; y: number } | null>(null);
  const autoZoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cursorVelocityRef = useRef({ x: 0, y: 0 });
  const lastCursorUpdateRef = useRef<number>(0);

  // Performance optimization refs for camera system
  const currentZoomRef = useRef<number>(1);
  const zoomTargetRef = useRef<number>(1); // For smooth damping
  const zoomStateRef = useRef<ZoomState>("NEUTRAL");
  const containerDimensionsRef = useRef<{ width: number; height: number } | null>(null);
  const videoDimensionsRef = useRef<{ width: number; height: number; aspect: number } | null>(null);
  const lastDimensionsUpdateRef = useRef<number>(0);
  const transformCacheRef = useRef<{ x: number; y: number; scale: number }>({ x: 0, y: 0, scale: 1 });
  const transitionStateRef = useRef<string | null>(null);
  const focusPointRef = useRef<{ x: number; y: number } | null>(null);
  const cursorDwellStartRef = useRef<number | null>(null);
  const cursorDwellPositionRef = useRef<{ x: number; y: number } | null>(null);
  const holdStartTimeRef = useRef<number | null>(null);
  const neutralCameraRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastScrollTimeRef = useRef<number>(0);
  const isScrollingRef = useRef<boolean>(false);

  // Spring-damper velocity tracking for smooth camera motion
  const cameraVelocityRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const zoomVelocityRef = useRef<number>(0);

  // Cursor indicator smoothing refs (for cursor to lead camera)
  const cursorIndicatorSmoothPosRef = useRef<{ x: number; y: number } | null>(null);
  const cursorIndicatorVelocityRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Deduplication: Track last processed event to prevent duplicate processing
  const lastProcessedEventRef = useRef<{ timestamp: number; clientX: number; clientY: number; eventType: string } | null>(null);

  // Helper function: linear interpolation
  const lerp = (a: number, b: number, t: number): number => {
    return a + (b - a) * t;
  };

  // Helper function: clamp value between min and max
  const clamp = (value: number, min: number, max: number): number => {
    return Math.min(max, Math.max(min, value));
  };

  // Universal spring-damper smoothing function
  // Uses velocity + damping instead of basic easing for natural, responsive motion
  // 🛡️ PRODUCTION: Added validation and NaN protection
  const smoothSpring = (
    current: number,
    velocity: number,
    target: number,
    stiffness: number = 0.15,
    damping: number = 0.75
  ): { current: number; velocity: number } => {
    // Validate inputs to prevent NaN/Infinity
    if (!Number.isFinite(current) || !Number.isFinite(velocity) || !Number.isFinite(target) || !Number.isFinite(stiffness) || !Number.isFinite(damping)) {
      // Only log if it's not a common case (e.g. initial load)
      if (Number.isFinite(current) || Number.isFinite(target)) {
        // console.warn('smoothSpring: Invalid input detected', { current, velocity, target, stiffness, damping });
      }
      return { current: Number.isFinite(current) ? current : (Number.isFinite(target) ? target : 0), velocity: 0 };
    }

    // Clamp stiffness and damping to valid ranges
    const safeStiffness = Math.max(0, Math.min(1, stiffness));
    const safeDamping = Math.max(0, Math.min(1, damping));

    const force = (target - current) * safeStiffness;
    const newVelocity = velocity * safeDamping + force;
    const newCurrent = current + newVelocity;

    // Validate output
    if (!Number.isFinite(newCurrent) || !Number.isFinite(newVelocity)) {
      console.warn('smoothSpring: Invalid output detected', { newCurrent, newVelocity });
      return { current: target, velocity: 0 };
    }

    return { current: newCurrent, velocity: newVelocity };
  };

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const chunksRef = useRef<Blob[]>([]);
  const clicksRef = useRef<ClickData[]>([]);
  const movesRef = useRef<MoveData[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const lastClickTimeRef = useRef<number>(0);
  const lastMoveTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  // Canvas recording refs - for recording the preview container
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const canvasAnimationFrameRef = useRef<number | null>(null);

  // Refs for canvas drawing to access current values
  const zoomLevelRef = useRef(zoomLevel);
  const followCursorRef = useRef(followCursor);
  const currentCursorPosRef = useRef(currentCursorPos);
  const cursorIndicatorPosRef = useRef(cursorIndicatorPos);

  // Advanced particle system for cursor trails
  const particleSystemRef = useRef<ParticleSystem | null>(null);
  const lastParticleUpdateRef = useRef<number>(0);
  const lastCursorPosForParticlesRef = useRef<{ x: number; y: number } | null>(null);
  const lastCursorMoveTimeRef = useRef<number>(0); // Track cursor movement timing for speed calculation
  const cursorSpeedRef = useRef<number>(0); // Normalized cursor speed (0-1)

  // 🎯 AI-Powered Intent Detection & Adaptive Learning
  const intentAnalyzerRef = useRef(new CursorIntentAnalyzer());
  const adaptiveLearnerRef = useRef(new AdaptiveCameraLearner());
  const lastIntentAnalysisRef = useRef<{
    intent: string;
    confidence: number;
    timestamp: number;
  }>({ intent: 'neutral', confidence: 0, timestamp: 0 });

  const cameraOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastIntentTimeRef = useRef<number>(0);
  const lastClickClusterTimeRef = useRef<number>(0);
  const clickClusterRef = useRef<{ x: number; y: number; timestamp: number }[]>([]);
  const lastZoomTimeRef = useRef<number>(0);
  const zoomDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize adaptive learning system
  useEffect(() => {
    adaptiveLearnerRef.current.loadPreferences();
    console.log('🧠 Adaptive camera learning system initialized');
  }, []);

  // 🎯 Content Analyzer for Smart Zoom
  const analyzeContentForZoom = useCallback((elementInfo: any, clusterInfo: any) => {
    if (!elementInfo) {
      // No element info - use cluster-based zoom
      return {
        zoom: Math.max(1.2, Math.min(1.8, 0.3 / Math.max(clusterInfo.radius, 0.05))),
        confidence: 0.5,
        reason: 'Cluster-based zoom'
      };
    }

    // Element-based zoom rules
    let zoomSuggestion = 1.4; // Default
    let confidence = 0.8;
    let reason = 'Default element zoom';

    // Tag-based rules
    if (CONTENT_ZOOM_RULES[elementInfo.tagName?.toLowerCase()]) {
      const rule = CONTENT_ZOOM_RULES[elementInfo.tagName.toLowerCase()];
      zoomSuggestion = rule.zoom;
      confidence = 0.9;
      reason = rule.reason;
    }

    // Semantic-based rules (higher priority)
    if (elementInfo.semanticType && CONTENT_ZOOM_RULES[elementInfo.semanticType]) {
      const rule = CONTENT_ZOOM_RULES[elementInfo.semanticType];
      zoomSuggestion = rule.zoom;
      confidence = 0.95;
      reason = rule.reason;
    }

    // Content analysis based on element text/size
    if (elementInfo.text) {
      const textLength = elementInfo.text.length;
      if (textLength > 50) {
        // Long text content
        zoomSuggestion = Math.max(zoomSuggestion, CONTENT_ZOOM_RULES.text.zoom);
        reason = 'Long text content detected';
      } else if (textLength < 10) {
        // Short text (likely buttons/labels)
        zoomSuggestion = Math.max(zoomSuggestion, 1.6);
        reason = 'Short text element';
      }
    }

    // Element size consideration
    if (elementInfo.rect) {
      const area = elementInfo.rect.width * elementInfo.rect.height;
      if (area < 1000) {
        // Small element - needs more zoom
        zoomSuggestion *= 1.1;
        reason += ' (small element)';
      } else if (area > 10000) {
        // Large element - can use less zoom
        zoomSuggestion *= 0.9;
        reason += ' (large element)';
      }
    }

    // Context density analysis
    const density = estimateContentDensity(elementInfo);
    if (CONTENT_ZOOM_RULES[density]) {
      const densityRule = CONTENT_ZOOM_RULES[density];
      zoomSuggestion = (zoomSuggestion + densityRule.zoom) / 2; // Blend with density
      reason += ` (${density} content density)`;
    }

    return {
      zoom: Math.max(CAMERA_CONFIG.ZOOM_MIN, Math.min(CAMERA_CONFIG.ZOOM_MAX, zoomSuggestion)),
      confidence,
      reason
    };
  }, []);

  // Estimate content density around the element
  const estimateContentDensity = useCallback((elementInfo: any): 'dense' | 'sparse' => {
    // Simple heuristic based on element properties
    if (elementInfo.rect) {
      const area = elementInfo.rect.width * elementInfo.rect.height;
      const aspectRatio = elementInfo.rect.width / elementInfo.rect.height;

      // Small, square elements tend to be in dense layouts
      if (area < 2000 && aspectRatio > 0.5 && aspectRatio < 2.0) {
        return 'dense';
      }
    }

    // Text length can indicate density
    if (elementInfo.text && elementInfo.text.length > 100) {
      return 'dense';
    }

    return 'sparse';
  }, []);

  // 🎭 Gesture Command Handler
  const handleGestureCommand = useCallback((command: string, x: number, y: number) => {
    console.log(`🎭 Executing gesture command: ${command}`);

    switch (command) {
      case 'zoom_in':
        // Smooth zoom in gesture
        zoomTargetRef.current = Math.min(zoomLevel + 0.5, CAMERA_CONFIG.ZOOM_MAX);
        zoomVelocityRef.current = 0;
        setZoomState("FOCUSED");
        focusPointRef.current = { x, y };
        lastIntentTimeRef.current = Date.now();
        break;

      case 'zoom_out':
        // Smooth zoom out gesture
        zoomTargetRef.current = Math.max(zoomLevel - 0.5, CAMERA_CONFIG.ZOOM_MIN);
        zoomVelocityRef.current = 0;
        if (zoomTargetRef.current <= CAMERA_CONFIG.ZOOM_MIN + 0.01) {
          setZoomState("NEUTRAL");
        } else {
          setZoomState("FOCUSED");
        }
        break;

      case 'switch_mode':
        // Cycle through camera presets
        const currentPreset = intentAnalyzerRef.current.getRecommendedPreset();
        const presets: (keyof typeof CAMERA_PRESETS)[] = ['cinematic', 'fast', 'manual'];
        const currentIndex = presets.indexOf(currentPreset);
        const nextIndex = (currentIndex + 1) % presets.length;
        // Force a different preset for visual feedback
        console.log(`📹 Switched to ${presets[nextIndex]} camera mode`);
        break;

      case 'pan_left':
      case 'pan_right':
      case 'pan_up':
      case 'pan_down':
        // Pan camera in gesture direction
        const panAmount = 0.2; // Normalized units
        let panX = 0, panY = 0;

        switch (command) {
          case 'pan_left': panX = -panAmount; break;
          case 'pan_right': panX = panAmount; break;
          case 'pan_up': panY = -panAmount; break;
          case 'pan_down': panY = panAmount; break;
        }

        // Set focus point to trigger pan
        focusPointRef.current = {
          x: Math.max(0, Math.min(1, x + panX)),
          y: Math.max(0, Math.min(1, y + panY))
        };
        setZoomState("FOCUSED");
        lastIntentTimeRef.current = Date.now();
        break;

      case 'reset_camera':
        // Reset camera to neutral position
        setZoomState("NEUTRAL");
        zoomTargetRef.current = CAMERA_CONFIG.ZOOM_MIN;
        focusPointRef.current = undefined;
        cameraVelocityRef.current = { x: 0, y: 0 };
        zoomVelocityRef.current = 0;
        console.log('📹 Camera reset to neutral position');
        break;

      case 'emphasize_selection':
        // Create emphasis effect (rapid zoom in and out)
        const originalZoom = zoomLevel;
        zoomTargetRef.current = Math.min(originalZoom * 1.3, CAMERA_CONFIG.ZOOM_MAX);
        zoomVelocityRef.current = 0;
        setZoomState("FOCUSED");
        focusPointRef.current = { x, y };

        // Return to original zoom after emphasis
        setTimeout(() => {
          zoomTargetRef.current = originalZoom;
        }, 300);
        break;

      default:
        console.log(`⚠️ Unknown gesture command: ${command}`);
    }
  }, [zoomLevel]);

  // Canvas performance optimization refs
  const canvasVideoDimensionsRef = useRef<{ width: number; height: number; aspect: number } | null>(null);
  const canvasGradientRef = useRef<CanvasGradient | null>(null);
  const lastCanvasResizeRef = useRef<number>(0);
  const canvasFrameTimeRef = useRef<number>(0);

  // Update refs when state changes
  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
    currentZoomRef.current = zoomLevel;
  }, [zoomLevel]);

  useEffect(() => {
    followCursorRef.current = followCursor;
  }, [followCursor]);

  useEffect(() => {
    currentCursorPosRef.current = currentCursorPos;
  }, [currentCursorPos]);

  useEffect(() => {
    cursorIndicatorPosRef.current = cursorIndicatorPos;
  }, [cursorIndicatorPos]);

  useEffect(() => {
    zoomStateRef.current = zoomState;
  }, [zoomState]);

  // Connect WebSocket for extension communication
  useEffect(() => {
    extensionWS.connect();

    return () => {
      extensionWS.disconnect();
    };
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        if (token) {
          const response = await fetch("http://localhost:8000/api/auth/profile/", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            const data = await response.json();
            setUser({ name: data.username, email: data.email });
          }
        }
      } catch (error) {
        console.error("Failed to fetch profile", error);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recordingState === "recording") {
      interval = setInterval(() => {
        setTimer((t) => {
          const newTime = t + 1;
          // Estimate file size (rough calculation: ~1MB per minute for high quality)
          const sizeMultiplier = recordingQuality === "high" ? 1 : recordingQuality === "medium" ? 0.6 : 0.3;
          setEstimatedSize(Math.round(newTime * sizeMultiplier));

          // Calculate recording quality score based on interactions
          const clicksPerMinute = clicksRef.current.length / (newTime / 60);
          const movesPerMinute = movesRef.current.length / (newTime / 60);
          const hasMarkers = markers.length > 0;
          const hasGoodPacing = clicksPerMinute > 2 && clicksPerMinute < 15; // Good pacing
          const hasMovement = movesPerMinute > 30; // Active movement

          let score = 100;
          if (!hasGoodPacing) score -= 20;
          if (!hasMovement) score -= 15;
          if (!hasMarkers && newTime > 30) score -= 10; // Suggest markers for longer recordings
          if (micLevel < 5 && audioSource !== "none") score -= 10; // Low mic level

          setRecordingQualityScore(Math.max(0, Math.min(100, score)));

          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [recordingState, recordingQuality, markers.length, micLevel, audioSource]);

  // Countdown Logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recordingState === "countdown" && countdown !== null && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => (prev !== null ? prev - 1 : null));
      }, 1000);
    } else if (recordingState === "countdown" && countdown === 0) {
      startRecordingActual();
    }
    return () => clearInterval(interval);
  }, [recordingState, countdown]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle shortcuts when recording
      if (recordingState !== "recording" && recordingState !== "paused") return;

      // Spacebar to pause/resume
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        if (recordingState === "recording") {
          handlePauseRecording();
        } else if (recordingState === "paused") {
          handleResumeRecording();
        }
      }

      // Escape to stop
      if (e.code === "Escape" && recordingState === "recording") {
        handleStopRecording();
      }

      // M key to add marker
      if (e.code === "KeyM" && recordingState === "recording" && e.target === document.body) {
        e.preventDefault();
        handleAddMarker();
      }

      // Zoom controls (only when recording)
      if (recordingState === "recording" && e.target === document.body) {
        // Plus/Equal for zoom in
        if ((e.code === "Equal" || e.code === "NumpadAdd") && (e.shiftKey || e.code === "NumpadAdd")) {
          e.preventDefault();
          handleZoomIn();
        }
        // Minus for zoom out
        if (e.code === "Minus" || e.code === "NumpadSubtract") {
          e.preventDefault();
          handleZoomOut();
        }
        // 0 for reset zoom
        if (e.code === "Digit0" || e.code === "Numpad0") {
          e.preventDefault();
          handleResetZoom();
        }
        // F key to toggle follow cursor
        if (e.code === "KeyF" && e.target === document.body) {
          e.preventDefault();
          setFollowCursor((prev) => !prev);
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [recordingState]);

  // Microphone level monitoring
  useEffect(() => {
    if (recordingState === "recording" && audioSource !== "system" && audioSource !== "none" && micStreamRef.current) {
      const updateMicLevel = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setMicLevel(Math.min(100, (average / 255) * 100));
        }
        animationFrameRef.current = requestAnimationFrame(updateMicLevel);
      };
      updateMicLevel();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [recordingState, audioSource]);

  // Update video preview
  useEffect(() => {
    if (mediaStreamRef.current && videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = mediaStreamRef.current;
    }
  }, [mediaStreamRef.current]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Listen for messages from extension content script
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data?.type) return;

      if (event.data.type === 'DEMOFORGE_REQUEST_SCREEN_SELECTION') {
        console.log('[Frontend] Extension requested screen selection via window message');
        handleSelectScreen();
      }
      else if (event.data.type === 'DEMOFORGE_EXTENSION_INVALID') {
        // Extension was reloaded, page needs refresh
        toast({
          title: "Extension needs refresh",
          description: "The extension was reloaded. Please refresh this page.",
          variant: "destructive",
          duration: 10000
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [toast]);

  const getStreamIdFromExtension = (): Promise<string | null | 'cancelled'> => {
    return new Promise((resolve) => {
      // Check if extension is available first
      // @ts-expect-error - chrome is a global from Chrome extension API
      if (!chrome?.runtime?.id) {
        console.log('Extension not available, skipping extension path');
        resolve(null); // null = extension not available, can fall back
        return;
      }

      const timeoutId = setTimeout(() => {
        console.warn('Timeout waiting for stream ID from extension');
        window.removeEventListener('message', handleMessage);
        resolve(null); // null = timeout, can fall back
      }, 5000); // 5 second timeout for user to select

      const handleMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'DEMOFORGE_STREAM_ID_SUCCESS') {
          console.log('Got stream ID from extension:', event.data.streamId);
          clearTimeout(timeoutId);
          window.removeEventListener('message', handleMessage);
          resolve(event.data.streamId);
        } else if (event.data && event.data.type === 'DEMOFORGE_STREAM_ID_ERROR') {
          const error = event.data.error || 'Unknown error';
          console.warn('Error getting stream ID from extension:', error);
          clearTimeout(timeoutId);
          window.removeEventListener('message', handleMessage);
          // If user cancelled, don't fall back to getDisplayMedia
          if (error.includes('cancelled') || error.includes('Permission denied')) {
            resolve('cancelled'); // 'cancelled' = user cancelled, don't fall back
          } else {
            resolve(null); // null = other error, can fall back
          }
        }
      };

      window.addEventListener('message', handleMessage);
      window.postMessage({ type: 'DEMOFORGE_GET_STREAM_ID' }, '*');
    });
  };

  const handleSelectScreen = async () => {
    try {
      let displayStream: MediaStream;

      // Try to get stream ID from extension first (for better "extension power" recording)
      const streamIdResult = await getStreamIdFromExtension();

      // If user cancelled extension dialog, don't proceed
      if (streamIdResult === 'cancelled') {
        console.log('User cancelled extension screen selection');
        return; // Stop here, don't show second prompt
      }

      if (streamIdResult) {
        console.log('Using extension stream ID for recording:', streamIdResult);
        // Use the stream ID from extension
        // @ts-ignore - chromeMediaSourceId and mandatory are Chrome-specific API extensions
        displayStream = await navigator.mediaDevices.getUserMedia({
          audio: audioSource === "system" || audioSource === "both" ? {
            // @ts-ignore - Chrome-specific mandatory constraints
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: streamIdResult
            }
          } : false,
          video: {
            // @ts-ignore - Chrome-specific mandatory constraints
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: streamIdResult,
              // Don't limit width/height for entire screen capture - let it use native resolution
              // maxWidth and maxHeight can cause cropping or limiting of screen capture
              maxFrameRate: recordingQuality === "high" ? 60 : 30 // Higher max for desktop capture
            }
          }
        } as any);

        // Log actual video track settings to verify what's being captured
        const videoTrack = displayStream.getVideoTracks()[0];
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          const capabilities = videoTrack.getCapabilities();
          console.log('📹 Video track settings:', {
            width: settings.width,
            height: settings.height,
            frameRate: settings.frameRate,
            deviceId: settings.deviceId,
            displaySurface: settings.displaySurface, // Should be 'monitor' for entire screen
            capabilities: capabilities
          });

          // Warn if displaySurface is not 'monitor' (entire screen)
          if (settings.displaySurface && settings.displaySurface !== 'monitor') {
            console.warn('⚠️ Warning: Not capturing entire screen! displaySurface:', settings.displaySurface);
            toast({
              title: "Screen capture warning",
              description: `Capturing ${settings.displaySurface} instead of entire screen. Please select "Entire Screen" in the dialog.`,
              variant: "default",
              duration: 5000
            });
          }
        }
      } else {
        // Only fall back if extension is not available or timed out (not if user cancelled)
        console.log('Extension not available or timed out, using standard getDisplayMedia');
        // Fallback to standard getDisplayMedia
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            // Request entire screen capture explicitly
            displaySurface: 'monitor', // Prefer entire screen
            width: { ideal: recordingQuality === "high" ? 1920 : recordingQuality === "medium" ? 1280 : 854 },
            height: { ideal: recordingQuality === "high" ? 1080 : recordingQuality === "medium" ? 720 : 480 },
            frameRate: { ideal: recordingQuality === "high" ? 30 : recordingQuality === "medium" ? 24 : 15 },
          },
          audio: audioSource === "system" || audioSource === "both"
        });

        // Log actual video track settings to verify what's being captured
        const videoTrack = displayStream.getVideoTracks()[0];
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          console.log('📹 Video track settings (getDisplayMedia):', {
            width: settings.width,
            height: settings.height,
            frameRate: settings.frameRate,
            displaySurface: settings.displaySurface, // Should be 'monitor' for entire screen
          });

          // Warn if displaySurface is not 'monitor' (entire screen)
          if (settings.displaySurface && settings.displaySurface !== 'monitor') {
            console.warn('⚠️ Warning: Not capturing entire screen! displaySurface:', settings.displaySurface);
            toast({
              title: "Screen capture warning",
              description: `Capturing ${settings.displaySurface} instead of entire screen. Please select "Entire Screen" in the dialog.`,
              variant: "default",
              duration: 5000
            });
          }
        }
      }

      mediaStreamRef.current = displayStream;

      // Handle microphone if needed
      if (audioSource === "microphone" || audioSource === "both") {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micStreamRef.current = micStream;

          // Set up audio analysis for mic level
          audioContextRef.current = new AudioContext();
          const source = audioContextRef.current.createMediaStreamSource(micStream);
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 256;
          source.connect(analyserRef.current);

          // Add microphone tracks to display stream
          micStream.getAudioTracks().forEach(track => {
            displayStream.addTrack(track);
          });
        } catch (micError) {
          console.error("Microphone access denied:", micError);
          toast({
            title: "Microphone access denied",
            description: "Recording will continue without microphone audio.",
            variant: "destructive"
          });
        }
      }

      setRecordingState("selecting");

      // Handle stream ending (e.g. user clicks "Stop sharing" in browser UI)
      displayStream.getVideoTracks()[0].onended = () => {
        handleStopRecording();
      };

    } catch (err) {
      console.error("Error selecting screen:", err);
      toast({
        title: "Permission denied",
        description: "Could not access screen recording. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Setup canvas for recording the preview container (sync version)
  const setupCanvasRecordingSync = useCallback(() => {
    if (!previewContainerRef.current || !videoPreviewRef.current || !mediaStreamRef.current) {
      return null;
    }

    const container = previewContainerRef.current;
    const video = videoPreviewRef.current;

    // Wait for video metadata to get actual resolution
    if (video.readyState < 2) {
      console.warn("Video metadata not ready, using container dimensions as fallback");
    }

    // Use ACTUAL video resolution for high quality recording (not container size)
    const videoWidth = video.videoWidth || 1920; // Fallback to 1920p
    const videoHeight = video.videoHeight || 1080; // Fallback to 1080p

    // Create canvas with actual video resolution for best quality
    const canvas = document.createElement('canvas');
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    canvasRef.current = canvas;

    console.log(`Canvas created with video resolution: ${videoWidth}x${videoHeight} (actual video: ${video.videoWidth}x${video.videoHeight})`);

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;



    // Start capturing the preview container to canvas (OPTIMIZED)
    const drawFrame = (timestamp: number) => {
      // Check if we should continue drawing (recording state will be set before MediaRecorder starts)
      // Use a ref to track if we should continue drawing
      if (!ctx || !video || !container) {
        // Stop the loop if essential elements are missing
        if (canvasAnimationFrameRef.current) {
          cancelAnimationFrame(canvasAnimationFrameRef.current);
          canvasAnimationFrameRef.current = null;
        }
        return;
      }

      // Check recording state - but allow drawing during countdown/ready states too
      // The actual recording state check happens in startRecordingActual
      const shouldDraw = recordingState === "recording" || recordingState === "countdown" || recordingState === "ready";
      if (!shouldDraw) {
        // Stop the loop if not in a recording-related state
        if (canvasAnimationFrameRef.current) {
          cancelAnimationFrame(canvasAnimationFrameRef.current);
          canvasAnimationFrameRef.current = null;
        }
        return;
      }

      // Throttle canvas updates for better performance (target 30fps for canvas)
      const deltaTime = timestamp - canvasFrameTimeRef.current;
      const targetFrameTime = 1000 / 30; // 30fps for canvas recording
      if (deltaTime < targetFrameTime) {
        canvasAnimationFrameRef.current = requestAnimationFrame(drawFrame);
        return;
      }
      canvasFrameTimeRef.current = timestamp;

      // Canvas size should match video resolution (not container size)
      // Only resize if video resolution changed
      const videoWidth = video.videoWidth || canvas.width;
      const videoHeight = video.videoHeight || canvas.height;
      const needsResize = canvas.width !== videoWidth || canvas.height !== videoHeight;

      if (needsResize && videoWidth > 0 && videoHeight > 0) {
        canvas.width = videoWidth;
        canvas.height = videoHeight;
        canvasGradientRef.current = null; // Invalidate gradient cache
        lastCanvasResizeRef.current = Date.now();
        console.log(`Canvas resized to match video: ${videoWidth}x${videoHeight}`);
      }

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw background gradient (cached for performance)
      if (!canvasGradientRef.current || needsResize) {
        canvasGradientRef.current = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        canvasGradientRef.current.addColorStop(0, '#f8f9fa');
        canvasGradientRef.current.addColorStop(1, '#e9ecef');
      }
      ctx.fillStyle = canvasGradientRef.current;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Ensure video has valid dimensions
      if (!video.videoWidth || !video.videoHeight || video.videoWidth === 0 || video.videoHeight === 0) {
        // Video not ready yet, skip this frame
        canvasAnimationFrameRef.current = requestAnimationFrame(drawFrame);
        return;
      }

      // Use full canvas size (which matches video resolution) - no padding needed for recording
      // Canvas is already at video resolution, so draw video at full size
      const videoAspect = video.videoWidth / video.videoHeight || 16 / 9;
      const canvasAspect = canvas.width / canvas.height;

      // Cache video dimensions (only recalculate if video size changed or canvas resized)
      if (!canvasVideoDimensionsRef.current ||
        canvasVideoDimensionsRef.current.aspect !== videoAspect ||
        needsResize) {
        // For recording, use full canvas/video resolution
        let videoDisplayWidth: number;
        let videoDisplayHeight: number;

        // Maintain aspect ratio while filling canvas
        if (videoAspect > canvasAspect) {
          // Video is wider - fit to width
          videoDisplayWidth = canvas.width;
          videoDisplayHeight = canvas.width / videoAspect;
        } else {
          // Video is taller - fit to height
          videoDisplayHeight = canvas.height;
          videoDisplayWidth = canvas.height * videoAspect;
        }

        canvasVideoDimensionsRef.current = {
          width: videoDisplayWidth,
          height: videoDisplayHeight,
          aspect: videoAspect
        };
      }

      const videoDisplayWidth = canvasVideoDimensionsRef.current.width;
      const videoDisplayHeight = canvasVideoDimensionsRef.current.height;

      // Apply the same transform as the video element (zoom, pan)
      // Read from refs to get current values
      const currentZoom = zoomLevelRef.current;
      const scaledWidth = videoDisplayWidth * currentZoom;
      const scaledHeight = videoDisplayHeight * currentZoom;

      // Calculate offset for cursor following (using canvas/video resolution)
      let offsetX = 0;
      let offsetY = 0;

      if (followCursorRef.current && currentCursorPosRef.current) {
        // Use canvas dimensions (which match video resolution)
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;

        // Convert normalized cursor position (0-1 relative to window) to canvas coordinates
        const cursorX = currentCursorPosRef.current.x * canvasWidth;
        const cursorY = currentCursorPosRef.current.y * canvasHeight;

        // Calculate offset to center cursor (accounting for zoom)
        offsetX = (canvasWidth / 2) - (cursorX * currentZoom);
        offsetY = (canvasHeight / 2) - (cursorY * currentZoom);

        // Clamp offsets to prevent panning beyond video bounds
        const maxOffsetX = Math.max(0, (scaledWidth - canvasWidth) / 2);
        const maxOffsetY = Math.max(0, (scaledHeight - canvasHeight) / 2);
        offsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, offsetX));
        offsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, offsetY));
      }

      // Save context and apply transform
      ctx.save();
      ctx.translate(canvas.width / 2 + offsetX, canvas.height / 2 + offsetY);
      ctx.scale(currentZoom, currentZoom);

      // Draw video frame
      const videoX = -videoDisplayWidth / 2;
      const videoY = -videoDisplayHeight / 2;

      // Draw rounded rectangle background for video
      const radius = 8;
      ctx.beginPath();
      ctx.moveTo(videoX + radius, videoY);
      ctx.lineTo(videoX + videoDisplayWidth - radius, videoY);
      ctx.quadraticCurveTo(videoX + videoDisplayWidth, videoY, videoX + videoDisplayWidth, videoY + radius);
      ctx.lineTo(videoX + videoDisplayWidth, videoY + videoDisplayHeight - radius);
      ctx.quadraticCurveTo(videoX + videoDisplayWidth, videoY + videoDisplayHeight, videoX + videoDisplayWidth - radius, videoY + videoDisplayHeight);
      ctx.lineTo(videoX + radius, videoY + videoDisplayHeight);
      ctx.quadraticCurveTo(videoX, videoY + videoDisplayHeight, videoX, videoY + videoDisplayHeight - radius);
      ctx.lineTo(videoX, videoY + radius);
      ctx.quadraticCurveTo(videoX, videoY, videoX + radius, videoY);
      ctx.closePath();
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.clip();

      ctx.drawImage(video, videoX, videoY, videoDisplayWidth, videoDisplayHeight);
      ctx.restore();


      canvasAnimationFrameRef.current = requestAnimationFrame(drawFrame);
    };

    // Get stream from canvas FIRST (before starting draw loop)
    // This ensures the stream is ready to receive frames
    // Use higher FPS for better quality recording
    const fps = recordingQuality === "high" ? 60 : recordingQuality === "medium" ? 30 : 24;
    const stream = canvas.captureStream(fps);
    canvasStreamRef.current = stream;

    // Verify stream has tracks
    if (stream.getVideoTracks().length === 0) {
      console.error("Canvas stream has no video tracks");
      return null;
    }

    // Start drawing loop AFTER stream is created
    // This ensures frames are immediately available to the stream
    // Use requestAnimationFrame to start the loop
    canvasAnimationFrameRef.current = requestAnimationFrame(drawFrame);

    console.log("Canvas recording setup complete:", {
      canvasSize: `${canvas.width}x${canvas.height}`,
      videoSize: `${video.videoWidth}x${video.videoHeight}`,
      streamTracks: stream.getVideoTracks().length,
      fps: fps,
      quality: recordingQuality
    });

    return stream;
  }, [recordingState, zoomLevel, followCursor, currentCursorPos, cursorIndicatorPos, recordingQuality]);

  // Setup canvas for recording the preview container (async wrapper)
  const setupCanvasRecording = useCallback(() => {
    if (!previewContainerRef.current || !videoPreviewRef.current || !mediaStreamRef.current) {
      return null;
    }

    const container = previewContainerRef.current;
    const video = videoPreviewRef.current;

    // Ensure video is ready
    if (video.readyState < 2) {
      // Video metadata not loaded yet, wait for it
      return new Promise<MediaStream | null>((resolve) => {
        const onLoadedMetadata = () => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          const stream = setupCanvasRecordingSync();
          resolve(stream);
        };
        video.addEventListener('loadedmetadata', onLoadedMetadata);
        // Timeout after 5 seconds
        setTimeout(() => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          console.error('Video metadata loading timeout');
          resolve(null);
        }, 5000);
      });
    }

    return setupCanvasRecordingSync();
  }, [setupCanvasRecordingSync, cursorTrail]);

  const handleConfirmHide = () => {
    setRecordingState("ready");
  };

  const handleStartCountdown = () => {
    if (!mediaStreamRef.current) return;
    setCountdown(countdownDuration);
    setRecordingState("countdown");
  };

  const handleAddMarker = () => {
    const timestamp = timer;
    const newMarker: RecordingMarker = {
      timestamp,
      label: `Marker ${markers.length + 1}`,
    };
    setMarkers([...markers, newMarker]);
    toast({
      title: "Marker added",
      description: `Marked at ${formatTime(timestamp)}`,
    });
  };

  // 🎯 Click cluster detection: Detects 2+ clicks within 3 seconds

  // Get element information for visual highlights
  const getElementInfo = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target) return undefined;

    try {
      const rect = target.getBoundingClientRect();
      const clientWidth = window.innerWidth;
      const clientHeight = window.innerHeight;

      // Determine semantic type based on text content and element attributes
      const text = target.textContent?.toLowerCase() || "";
      const primaryKeywords = ["submit", "save", "create", "confirm", "login", "sign up", "continue", "next", "send"];
      const dangerKeywords = ["delete", "remove", "cancel", "destroy", "stop"];

      let semanticType: "primary" | "secondary" | "danger" | "neutral" = "neutral";
      if (primaryKeywords.some(k => text.includes(k))) semanticType = "primary";
      else if (dangerKeywords.some(k => text.includes(k))) semanticType = "danger";
      else if (target.tagName === "BUTTON" || target.tagName === "A" || target.getAttribute("role") === "button") semanticType = "secondary";

      // Safe processing of className which can be non-string for SVG elements
      const safeClassName = typeof target.className === 'string'
        ? target.className.slice(0, 50)
        : (target.getAttribute('class') || '').slice(0, 50);

      return {
        tagName: target.tagName.toLowerCase(),
        text: target.textContent?.slice(0, 50) || undefined,
        className: safeClassName || undefined,
        rect: {
          left: rect.left / clientWidth,
          top: rect.top / clientHeight,
          width: rect.width / clientWidth,
          height: rect.height / clientHeight
        },
        semanticType
      };
    } catch (e) {
      return undefined;
    }
  };

  // Pointer down handler - captures intentional clicks
  const handlePointerDown = useCallback((event: PointerEvent) => {
    if (recordingState !== "recording") return;

    // Filter validation: Primary button only, Mouse only
    if (event.button !== 0 || event.pointerType !== "mouse") return;

    // Hard debounce (180ms)
    const now = Date.now();
    if (now - lastClickTimeRef.current < 180) return;

    // Track interaction for smart insights
    setInteractionCount((prev) => prev + 1);
    if (lastClickTimeRef.current > 0) {
      const interval = now - lastClickTimeRef.current;
      setAvgClickInterval((prev) => prev === null ? interval : (prev + interval) / 2);
    }

    lastClickTimeRef.current = now;

    // Normalize coordinates relative to client viewport (video bounding box)
    const clientWidth = window.innerWidth;
    const clientHeight = window.innerHeight;

    const normalizedX = Math.max(0, Math.min(1, event.clientX / clientWidth));
    const normalizedY = Math.max(0, Math.min(1, event.clientY / clientHeight));

    const timestamp = (now - recordingStartTimeRef.current) / 1000;
    const elementInfo = getElementInfo(event);

    clicksRef.current.push({
      x: normalizedX,
      y: normalizedY,
      timestamp,
      screenWidth: clientWidth,
      screenHeight: clientHeight,
      type: "click",
      elementInfo,
    });

  }, [recordingState, followCursor, completePathCapture]);

  // Helper to notify extension of recording state
  // Uses window.postMessage (handled by content script) - no WebSocket needed
  const sendExtensionRecordingState = (isRecording: boolean) => {
    // Window postMessage is already sent in startRecordingActual/handleStopRecording
    // This function is kept for compatibility but window.postMessage is the primary method
    console.log(`[Frontend] 📢 Recording state: ${isRecording ? 'STARTED' : 'STOPPED'} (handled via window.postMessage)`);
  };

  // Extension event handler - processes mouse events from Chrome extension (direct messaging)
  const handleExtensionMouseEvent = useCallback((event: ExtensionMouseEvent) => {
    // Deduplication: Skip if this exact event was already processed
    const eventKey = `${event.t}-${event.clientX}-${event.clientY}-${event.eventType}`;
    const lastEvent = lastProcessedEventRef.current;
    if (lastEvent &&
      Math.abs(lastEvent.timestamp - event.t) < 0.1 && // Same timestamp (within 0.1ms)
      lastEvent.clientX === event.clientX &&
      lastEvent.clientY === event.clientY &&
      lastEvent.eventType === event.eventType) {
      // Duplicate event - skip processing
      return;
    }

    // Mark as processed
    lastProcessedEventRef.current = {
      timestamp: event.t,
      clientX: event.clientX,
      clientY: event.clientY,
      eventType: event.eventType
    };

    // Throttled logging - only log clicks or periodically for moves
    if (event.eventType !== 'move') {
      console.log(`[Frontend] 🖱️ ${event.eventType.toUpperCase()} at ${event.clientX},${event.clientY}`);
    }

    if (recordingState !== "recording") {
      console.log('[Frontend] ⚠️ Ignoring extension event - not recording:', recordingState);
      return;
    }

    // Use video element if available, otherwise use window dimensions as fallback
    let videoRect: DOMRect;
    const videoElement = videoPreviewRef.current;

    if (videoElement) {
      videoRect = videoElement.getBoundingClientRect();
      if (videoRect.width === 0 || videoRect.height === 0) {
        console.warn('[Frontend] Video rect is zero, using window fallback');
        videoRect = new DOMRect(0, 0, window.innerWidth, window.innerHeight);
      }
    } else {
      console.warn('[Frontend] No video element, using window dimensions as fallback');
      videoRect = new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    }

    const now = Date.now();

    if (event.eventType === "move") {
      const moveData = extensionEventToMoveData(event, videoRect, recordingStartTimeRef.current);
      const normalizedX = moveData.x;
      const normalizedY = moveData.y;

      // Complete path capture mode: No throttling, minimal filtering
      if (completePathCapture) {
        // Only minimal throttling to prevent overwhelming (~120fps max)
        if (now - lastMoveTimeRef.current < 8) return; // ~120fps
        lastMoveTimeRef.current = now;

        // Store ALL movements for complete path
        movesRef.current.push(moveData);

        // Less frequent logging for complete path mode
        if (movesRef.current.length % 100 === 0) {
          console.log('[Frontend] ✅ Complete path: Recorded', movesRef.current.length, 'move events');
        }
      } else {
        // Standard mode: Throttling to ~30fps with jitter filtering
        if (now - lastMoveTimeRef.current < 33) return;
        lastMoveTimeRef.current = now;

        // [POLISH] Micro Jitter Removal
        let shouldRecord = true;
        if (movesRef.current.length > 0) {
          const lastMove = movesRef.current[movesRef.current.length - 1];
          const dist = Math.sqrt(
            Math.pow(normalizedX - lastMove.x, 2) +
            Math.pow(normalizedY - lastMove.y, 2)
          );
          if (dist < 0.005) {
            shouldRecord = false;
          }
        }

        if (shouldRecord) {
          movesRef.current.push(moveData);
          if (movesRef.current.length === 1 || movesRef.current.length % 50 === 0) {
            console.log('[Frontend] ✅ Recorded', movesRef.current.length, 'move events');
          }
        }
        // Jitter filter: small movements are ignored (no log needed)
      }

      // 🎯 AI Intent Analysis - feed cursor data to analyzer
      intentAnalyzerRef.current.addMovement(normalizedX, normalizedY, now);

      // Analyze intent periodically (every 100ms to avoid excessive computation)
      if (now - lastIntentAnalysisRef.current.timestamp > 100) {
        const intentResult = intentAnalyzerRef.current.analyzeIntent();
        lastIntentAnalysisRef.current = {
          intent: intentResult.intent,
          confidence: intentResult.confidence,
          timestamp: now
        };

        // 🎯 Adaptive Learning: Update movement pattern analysis
        const movementStats = intentAnalyzerRef.current.getMovementStats();
        adaptiveLearnerRef.current.recordMovementPattern(
          movementStats.movementSmoothness,
          movementStats.avgVelocity
        );

        // 🎯 Gesture Command Processing with Learning
        const gesture = intentAnalyzerRef.current.analyzeGesture();
        if (gesture.confidence > 0.7 && gesture.command) {
          handleGestureCommand(gesture.command, normalizedX, normalizedY);

          // Record gesture usage for adaptive learning
          adaptiveLearnerRef.current.recordGestureUsage(gesture.type);

          console.log(`🎭 Gesture: ${gesture.type} -> ${gesture.command} (${Math.round(gesture.confidence * 100)}% confidence)`);
        }

        // Log significant intent changes
        if (intentResult.confidence > 0.7) {
          console.log(`🎯 Intent: ${intentResult.intent} (${Math.round(intentResult.confidence * 100)}% confidence)`);
        }
      }

      // Update current cursor position and viewport
      setCurrentCursorPos({ x: normalizedX, y: normalizedY });
      currentCursorPosRef.current = { x: normalizedX, y: normalizedY };

      // Update viewport manager
      if (viewportManagerRef.current && followCursor) {
        viewportManagerRef.current.updateCursor({ x: normalizedX, y: normalizedY });
      }

      // Track cursor speed for conditional zoom boost
      if (lastCursorPosForParticlesRef.current && lastCursorMoveTimeRef.current > 0) {
        const dt = Math.max(1, now - lastCursorMoveTimeRef.current) / 1000;
        const dx = normalizedX - lastCursorPosForParticlesRef.current.x;
        const dy = normalizedY - lastCursorPosForParticlesRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const speed = distance / dt;
        cursorSpeedRef.current = Math.min(1, speed / 10);
      }
      lastCursorMoveTimeRef.current = now;

      // 🧠 Intent tracking: Detect focused movement and cursor dwell
      if (followCursor) {
        const currentPos = { x: normalizedX, y: normalizedY };
        const movementThreshold = 0.01;
        if (cursorDwellPositionRef.current) {
          const dx = Math.abs(currentPos.x - cursorDwellPositionRef.current.x);
          const dy = Math.abs(currentPos.y - cursorDwellPositionRef.current.y);
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > movementThreshold) {
            lastIntentTimeRef.current = now;
            cursorDwellStartRef.current = null;
            cursorDwellPositionRef.current = currentPos;
          } else {
            if (cursorDwellStartRef.current === null) {
              cursorDwellStartRef.current = now;
            }
            cursorDwellPositionRef.current = currentPos;
          }
        } else {
          cursorDwellStartRef.current = now;
          cursorDwellPositionRef.current = currentPos;
          lastIntentTimeRef.current = now;
        }
      }
    } else if (event.eventType === "down") {
      // Handle click from extension
      const clickData = extensionEventToClickData(
        event,
        videoRect,
        recordingStartTimeRef.current,
        "click"
      );
      const normalizedX = clickData.x;
      const normalizedY = clickData.y;

      // Hard debounce (180ms)
      if (now - lastClickTimeRef.current < 180) return;
      lastClickTimeRef.current = now;

      setInteractionCount((prev) => prev + 1);
      if (lastClickTimeRef.current > 0) {
        const interval = now - lastClickTimeRef.current;
        setAvgClickInterval((prev) => prev === null ? interval : (prev + interval) / 2);
      }

      clicksRef.current.push(clickData);
      console.log('[Frontend] ✅ Recorded click #' + clicksRef.current.length + ':', {
        x: normalizedX,
        y: normalizedY,
        timestamp: clickData.timestamp,
        totalClicks: clicksRef.current.length
      });

      // Handle click with viewport manager
      if (viewportManagerRef.current && followCursor) {
        viewportManagerRef.current.handleClick({ x: normalizedX, y: normalizedY });
        lastActivityTimeRef.current = now;
        lastClickPositionRef.current = { x: normalizedX, y: normalizedY };
      }
    }
  }, [recordingState, followCursor, completePathCapture, viewportManagerRef]);

  // Store handler in ref to avoid effect re-running on every render
  const handleExtensionMouseEventRef = useRef(handleExtensionMouseEvent);
  useEffect(() => {
    handleExtensionMouseEventRef.current = handleExtensionMouseEvent;
  }, [handleExtensionMouseEvent]);

  // Set up extension event receiver via window messages AND WebSocket (for cross-tab events)
  // Only runs when recordingState changes to "recording" or stops
  useEffect(() => {
    if (recordingState !== "recording") {
      return;
    }

    console.log('[Frontend] 🎬 Setting up extension event receivers');

    // Listen for custom events from injected script (same-tab events)
    const handleWindowMessage = (event: MessageEvent) => {
      if (event.data?.type === 'DEMOFORGE_MOUSE_EVENT') {
        handleExtensionMouseEventRef.current(event.data.event as ExtensionMouseEvent);
      }
    };

    // Listen for custom DOM events from injected script (same-tab events)
    const handleCustomEvent = (event: CustomEvent) => {
      handleExtensionMouseEventRef.current(event.detail as ExtensionMouseEvent);
    };

    window.addEventListener('message', handleWindowMessage);
    window.addEventListener('demoforge-mouse-event', handleCustomEvent as EventListener);

    // ✅ Listen to WebSocket for cross-tab events (events from YouTube, other tabs, etc.)
    const unsubscribeWS = extensionWS.onEvent((mouseEvent: ExtensionMouseEvent) => {
      handleExtensionMouseEventRef.current(mouseEvent);
    });

    console.log('[Frontend] ✅ Event listeners registered');

    return () => {
      window.removeEventListener('message', handleWindowMessage);
      window.removeEventListener('demoforge-mouse-event', handleCustomEvent as EventListener);
      unsubscribeWS();
    };
  }, [recordingState]); // Only depends on recordingState now

  // Set up scroll/wheel tracking (still needed for zoom-out on scroll)
  useEffect(() => {
    if (recordingState === "recording") {

      // 🧠 Scroll detection - hard intent reset
      let scrollTimeout: NodeJS.Timeout | null = null;
      const handleScroll = () => {
        if (!followCursor) return;

        const now = Date.now();
        lastScrollTimeRef.current = now;
        isScrollingRef.current = true;

        // Cancel zoom-in immediately
        if (zoomState === "FOCUSED" || zoomState === "HOLD" || zoomState === "DECAY") {
          setZoomState("NEUTRAL");
          zoomTargetRef.current = 1;
        }

        // Clear scroll timeout
        if (scrollTimeout) clearTimeout(scrollTimeout);

        // Mark scroll as settled after 400ms
        scrollTimeout = setTimeout(() => {
          isScrollingRef.current = false;
          // Start zoom-out after scroll settles
          if (zoomLevel > 1) {
            setZoomState("HOLD");
            holdStartTimeRef.current = Date.now();
          }
        }, 400);
      };

      window.addEventListener("scroll", handleScroll, true);
      window.addEventListener("wheel", handleScroll, { passive: true });

      // Periodic cursor position update to ensure we always have a position
      const cursorUpdateInterval = setInterval(() => {
        if (recordingState === "recording" && !currentCursorPos) {
          // Try to get last known position from moves array
          if (movesRef.current.length > 0) {
            const lastMove = movesRef.current[movesRef.current.length - 1];
            setCurrentCursorPos({ x: lastMove.x, y: lastMove.y });
          }
        }
      }, 500); // Check every 500ms

      return () => {
        window.removeEventListener("scroll", handleScroll, true);
        window.removeEventListener("wheel", handleScroll);
        if (scrollTimeout) clearTimeout(scrollTimeout);
        clearInterval(cursorUpdateInterval);
      };
    }
  }, [recordingState, currentCursorPos, followCursor, zoomState, zoomLevel]);

  // 🧠 ZOOM-OUT STATE MACHINE: Intent-driven zoom-out logic
  useEffect(() => {
    if (!followCursor || recordingState !== "recording") {
      // Reset zoom state when not following or not recording
      if (zoomState !== "NEUTRAL") {
        setZoomState("NEUTRAL");
        setViewportZoom(1);
        zoomTargetRef.current = 1;
      }
      return;
    }

    const checkInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastIntent = now - lastIntentTimeRef.current;
      const timeSinceLastClick = now - lastClickTimeRef.current;
      const timeSinceLastScroll = now - lastScrollTimeRef.current;

      // Don't process if scrolling
      if (isScrollingRef.current) return;

      // ✅ TRIGGER 1: Intent Idle (Primary Trigger)
      const T_idle = CAMERA_CONFIG.INTENT_IDLE_MS;

      // Check if cursor is actively dwelling (reading) - this is valid intent
      const isCursorDwelling = cursorDwellStartRef.current !== null &&
        cursorDwellPositionRef.current !== null;
      const dwellDuration = isCursorDwelling && cursorDwellStartRef.current
        ? now - cursorDwellStartRef.current
        : Infinity;

      // Intent is idle if: no recent clicks, no recent movement, and not dwelling
      const isIntentIdle = timeSinceLastIntent > T_idle &&
        timeSinceLastClick > T_idle &&
        !isCursorDwelling; // Cursor dwell (reading) is valid intent

      // ✅ TRIGGER 2: Cursor Leaves Focus Area (long distance travel)
      let cursorLeftFocus = false;
      if (focusPointRef.current && currentCursorPos) {
        const dx = Math.abs(currentCursorPos.x - focusPointRef.current.x);
        const dy = Math.abs(currentCursorPos.y - focusPointRef.current.y);
        const viewportDistance = Math.sqrt(dx * dx + dy * dy); // Use actual distance

        // Cursor traveled long distance from focus point
        if (viewportDistance > CAMERA_CONFIG.CURSOR_LEAVE_DISTANCE) {
          // Check if sustained for configured threshold
          const cursorLeaveStart = now - (timeSinceLastIntent);
          if (cursorLeaveStart > CAMERA_CONFIG.CURSOR_LEAVE_FOCUS_MS) {
            cursorLeftFocus = true;
          }
        }
      }

      // ✅ TRIGGER 3: Click Cluster Ends (no clicks for 1.5-2s)
      const T_cluster = CAMERA_CONFIG.CLICK_CLUSTER_MS;
      const ZOOM_OUT_IDLE_MS = 1800; // 1.8 seconds - zoom out when idle
      const clickClusterEnded = timeSinceLastClick > ZOOM_OUT_IDLE_MS &&
        clicksRef.current.length > 0 &&
        zoomState === "FOCUSED";

      // State machine transitions
      if (zoomState === "FOCUSED") {
        // Only enter HOLD state if zoom has reached its target and settled
        const targetZoom = zoomTargetRef.current;
        const currentZoom = Number.isFinite(zoomLevel) ? zoomLevel : CAMERA_CONFIG.ZOOM_MIN;
        const zoomError = Math.abs(currentZoom - targetZoom);
        const zoomVelocity = Number.isFinite(zoomVelocityRef.current) ? Math.abs(zoomVelocityRef.current) : 0;

        // Check if zoom has settled at target
        const zoomHasSettled = zoomError < CAMERA_CONFIG.ZOOM_UPDATE_THRESHOLD &&
          zoomVelocity < CAMERA_CONFIG.SPRING_SETTLE_THRESHOLD;

        // Check if we should enter HOLD state (only when zoom has settled)
        if (zoomHasSettled && (isIntentIdle || cursorLeftFocus || clickClusterEnded)) {
          setZoomState("HOLD");
          holdStartTimeRef.current = now;
          console.log(`🎯 Zoom reached target ${targetZoom.toFixed(2)}x, entering HOLD phase`);
        }
      } else if (zoomState === "HOLD") {
        // Hold for configured duration before decay (ScreenStudio-style: let brain finish processing)
        const holdStartTime = holdStartTimeRef.current;
        const holdDuration = holdStartTime && Number.isFinite(holdStartTime)
          ? now - holdStartTime
          : 0;

        // 🛡️ PRODUCTION: Validate hold duration
        if (holdDuration > CAMERA_CONFIG.HOLD_DURATION_MS && Number.isFinite(holdDuration)) {
          // Check if new intent occurred during hold
          if (timeSinceLastIntent < T_idle && timeSinceLastClick < T_idle) {
            // New intent - cancel zoom-out
            setZoomState("FOCUSED");
            holdStartTimeRef.current = null;
          } else {
            // Proceed to decay
            try {
              setZoomState("DECAY");
              // Set partial zoom target (don't always return to 1.0)
              const currentZoom = Number.isFinite(zoomLevel) ? zoomLevel : CAMERA_CONFIG.ZOOM_MIN;
              if (currentZoom > 1.3) {
                zoomTargetRef.current = Math.max(
                  CAMERA_CONFIG.ZOOM_MIN,
                  Math.min(CAMERA_CONFIG.ZOOM_MAX, Math.max(1.15, currentZoom * 0.8))
                ); // Partial zoom-out
              } else {
                zoomTargetRef.current = CAMERA_CONFIG.ZOOM_MIN; // Full zoom-out for smaller zooms
              }
            } catch (error) {
              console.error('Zoom state transition: Error in HOLD -> DECAY', error);
              // Fail safe: reset to neutral
              setZoomState("NEUTRAL");
              zoomTargetRef.current = CAMERA_CONFIG.ZOOM_MIN;
            }
          }
        }
      } else if (zoomState === "DECAY") {
        // Decay is handled in the cursor following effect
        // But check if we should cancel decay due to new intent
        if (timeSinceLastIntent < T_idle && timeSinceLastClick < T_idle) {
          // New intent detected - cancel zoom-out, re-enter FOCUSED
          setZoomState("FOCUSED");
          lastIntentTimeRef.current = now;
          zoomTargetRef.current = 1.4; // Re-zoom to click target
        }
      } else if (zoomState === "NEUTRAL") {
        // In neutral state, check if we've reached target
        if (Math.abs(zoomLevel - zoomTargetRef.current) < 0.01) {
          zoomTargetRef.current = 1.0;
        }
      }
    }, 100); // Check every 100ms

    return () => clearInterval(checkInterval);
  }, [followCursor, recordingState, zoomState, zoomLevel, currentCursorPos]);

  // Track cursor position - sync indicator with actual cursor tracking (FIXED)
  // Convert currentCursorPos (window-normalized) to container-relative position
  // 🎯 SCREENSTUDIO-STYLE: Cursor smoothing happens in camera animation loop for 60fps updates
  // This effect just initializes/resets the cursor indicator when needed
  useEffect(() => {
    if (!followCursor || recordingState !== "recording" || !previewContainerRef.current || !currentCursorPos) {
      setCursorIndicatorPos(null);
      cursorIndicatorSmoothPosRef.current = null;
      cursorIndicatorVelocityRef.current = { x: 0, y: 0 };
      return;
    }
    // Cursor smoothing is handled in the camera animation loop for smooth 60fps updates
  }, [followCursor, recordingState, currentCursorPos]);

  // Cursor following effect - smooth pan/zoom to follow cursor (OPTIMIZED)
  useEffect(() => {
    if (!followCursor || recordingState !== "recording" || !previewContainerRef.current || rawRecording) {
      // Reset transform when not following - apply to container, not video
      if (previewContainerRef.current) {
        // Force scale to 1 in raw mode, otherwise use current zoom level
        const targetScale = rawRecording ? 1 : zoomLevel;
        previewContainerRef.current.style.transform = `scale3d(${targetScale}, ${targetScale}, 1)`;
        previewContainerRef.current.style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
        previewContainerRef.current.style.willChange = "auto";
      }
      containerDimensionsRef.current = null;
      videoDimensionsRef.current = null;
      return;
    }

    const container = previewContainerRef.current;
    const video = videoPreviewRef.current;
    if (!container || !video) return;

    // Enable GPU acceleration - apply to container, not video
    container.style.willChange = "transform";
    container.style.backfaceVisibility = "hidden";
    container.style.perspective = "1000px";

    let animationFrameId: number | null = null;
    let lastUpdateTime = 0;
    const TARGET_FPS = CAMERA_CONFIG.TARGET_FPS;
    const FRAME_TIME = CAMERA_CONFIG.FRAME_TIME_MS;

    // 🛡️ PRODUCTION: Track if component is mounted to prevent state updates after unmount
    let isMounted = true;

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

    // Cache container dimensions (only update every configured duration or on resize)
    const updateContainerDimensions = () => {
      try {
        const now = Date.now();
        if (!containerDimensionsRef.current ||
          now - lastDimensionsUpdateRef.current > CAMERA_CONFIG.DIMENSIONS_CACHE_MS) {
          const rect = container.getBoundingClientRect();
          if (rect && Number.isFinite(rect.width) && Number.isFinite(rect.height) &&
            rect.width > 0 && rect.height > 0) {
            containerDimensionsRef.current = {
              width: rect.width,
              height: rect.height
            };
            lastDimensionsUpdateRef.current = now;
          }
        }
        return containerDimensionsRef.current;
      } catch (error) {
        console.error('updateContainerDimensions: Error', error);
        return containerDimensionsRef.current;
      }
    };

    // Cache video dimensions (only update when video size changes)
    const updateVideoDimensions = () => {
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      if (!videoDimensionsRef.current ||
        videoDimensionsRef.current.width !== videoWidth ||
        videoDimensionsRef.current.height !== videoHeight) {
        const videoAspect = videoWidth / videoHeight || 16 / 9;
        const containerDims = updateContainerDimensions();
        const containerAspect = containerDims.width / containerDims.height;

        let videoDisplayWidth: number;
        let videoDisplayHeight: number;

        if (videoAspect > containerAspect) {
          videoDisplayWidth = containerDims.width;
          videoDisplayHeight = containerDims.width / videoAspect;
        } else {
          videoDisplayHeight = containerDims.height;
          videoDisplayWidth = containerDims.height * videoAspect;
        }

        videoDimensionsRef.current = {
          width: videoDisplayWidth,
          height: videoDisplayHeight,
          aspect: videoAspect
        };
      }
      return videoDimensionsRef.current;
    };

    const updateFollow = (timestamp: number) => {
      // 🛡️ PRODUCTION: Safety check - don't update if unmounted
      if (!isMounted) {
        return;
      }

      try {
        // Optimized frame throttling
        const deltaTime = timestamp - lastUpdateTime;
        if (!Number.isFinite(deltaTime) || deltaTime < FRAME_TIME) {
          animationFrameId = requestAnimationFrame(updateFollow);
          return;
        }
        lastUpdateTime = timestamp;

        // Early exit checks using refs (no state reads)
        if (!followCursorRef.current || !currentCursorPosRef.current || recordingState !== "recording") {
          animationFrameId = requestAnimationFrame(updateFollow);
          return;
        }

        // 🛡️ PRODUCTION: Validate cursor position
        const cursorPos = currentCursorPosRef.current;
        if (!cursorPos ||
          !Number.isFinite(cursorPos.x) ||
          !Number.isFinite(cursorPos.y) ||
          cursorPos.x < 0 || cursorPos.x > 1 ||
          cursorPos.y < 0 || cursorPos.y > 1) {
          animationFrameId = requestAnimationFrame(updateFollow);
          return;
        }

        // Use cached dimensions
        const containerDims = updateContainerDimensions();
        const videoDims = updateVideoDimensions();

        // 🛡️ PRODUCTION: Validate dimensions
        if (!containerDims || !videoDims ||
          !Number.isFinite(containerDims.width) ||
          !Number.isFinite(containerDims.height) ||
          !Number.isFinite(videoDims.width) ||
          !Number.isFinite(videoDims.height) ||
          containerDims.width <= 0 || containerDims.height <= 0 ||
          videoDims.width <= 0 || videoDims.height <= 0) {
          animationFrameId = requestAnimationFrame(updateFollow);
          return;
        }

        const containerWidth = containerDims.width;
        const containerHeight = containerDims.height;
        const videoDisplayWidth = videoDims.width;
        const videoDisplayHeight = videoDims.height;

        // Zoom calculations using refs (avoid setState in loop)
        const currentZoom = Number.isFinite(currentZoomRef.current)
          ? currentZoomRef.current
          : CAMERA_CONFIG.ZOOM_MIN;
        const currentZoomState = zoomStateRef.current;
        let newZoom = currentZoom;

        // 🟢 ZOOM-IN: Event-driven with spring-damper smoothing
        if (currentZoomState === "FOCUSED") {
          const targetZoom = Number.isFinite(zoomTargetRef.current)
            ? Math.max(CAMERA_CONFIG.ZOOM_MIN, Math.min(CAMERA_CONFIG.ZOOM_MAX, zoomTargetRef.current))
            : CAMERA_CONFIG.ZOOM_MIN;

          // Spring smoothing with configured values
          const { current: smoothedZoom, velocity: zoomVel } = smoothSpring(
            currentZoom,
            Number.isFinite(zoomVelocityRef.current) ? zoomVelocityRef.current : 0,
            targetZoom,
            CAMERA_CONFIG.ZOOM_STIFFNESS,
            CAMERA_CONFIG.ZOOM_DAMPING
          );
          newZoom = clamp(smoothedZoom, CAMERA_CONFIG.ZOOM_MIN, CAMERA_CONFIG.ZOOM_MAX);

          // 🛡️ PRODUCTION: Validate zoom value before updating
          if (Number.isFinite(newZoom)) {
            currentZoomRef.current = newZoom;
            zoomVelocityRef.current = Number.isFinite(zoomVel) ? zoomVel : 0;

            // Only update state if change is significant (reduce re-renders)
            if (Math.abs(newZoom - zoomLevelRef.current) > CAMERA_CONFIG.ZOOM_UPDATE_THRESHOLD) {
              if (isMounted) {
                setViewportZoom(newZoom);
              }
            }
          }
        }

        // 🟢 ZOOM-OUT: State-driven with spring-damper smoothing
        // ScreenStudio-style: Zoom-out is slower/more gentle than zoom-in
        if (currentZoomState === "DECAY") {
          const targetZoom = Number.isFinite(zoomTargetRef.current)
            ? Math.max(CAMERA_CONFIG.ZOOM_MIN, Math.min(CAMERA_CONFIG.ZOOM_MAX, zoomTargetRef.current))
            : CAMERA_CONFIG.ZOOM_MIN;

          // Use slower stiffness for zoom-out (50% of zoom-in) - makes zoom-out nearly invisible
          const zoomOutStiffness = CAMERA_CONFIG.ZOOM_STIFFNESS * 0.5;

          // Spring smoothing with slower zoom-out values
          const { current: smoothedZoom, velocity: zoomVel } = smoothSpring(
            currentZoom,
            Number.isFinite(zoomVelocityRef.current) ? zoomVelocityRef.current : 0,
            targetZoom,
            zoomOutStiffness,
            CAMERA_CONFIG.ZOOM_DAMPING
          );
          newZoom = clamp(smoothedZoom, CAMERA_CONFIG.ZOOM_MIN, CAMERA_CONFIG.ZOOM_MAX);

          // 🛡️ PRODUCTION: Validate zoom value before updating
          if (Number.isFinite(newZoom)) {
            currentZoomRef.current = newZoom;
            zoomVelocityRef.current = Number.isFinite(zoomVel) ? zoomVel : 0;

            // Only update state if change is significant
            if (Math.abs(newZoom - zoomLevelRef.current) > CAMERA_CONFIG.ZOOM_UPDATE_THRESHOLD) {
              if (isMounted) {
                setViewportZoom(newZoom);
              }
            }

            // Check if we've reached target (with threshold for spring settling)
            if (Math.abs(newZoom - targetZoom) < CAMERA_CONFIG.ZOOM_UPDATE_THRESHOLD &&
              Math.abs(zoomVel) < CAMERA_CONFIG.SPRING_SETTLE_THRESHOLD) {
              if (targetZoom <= CAMERA_CONFIG.ZOOM_MIN + 0.01) {
                if (isMounted) {
                  setZoomState("NEUTRAL");
                }
                zoomTargetRef.current = CAMERA_CONFIG.ZOOM_MIN;
                zoomVelocityRef.current = 0; // Reset velocity when reaching neutral
              } else {
                zoomTargetRef.current = CAMERA_CONFIG.ZOOM_MIN;
              }
            }
          }
        }

        // Use the latest zoom value
        const effectiveZoom = Number.isFinite(currentZoomRef.current)
          ? currentZoomRef.current
          : CAMERA_CONFIG.ZOOM_MIN;
        const scaledWidth = videoDisplayWidth * effectiveZoom;
        const scaledHeight = videoDisplayHeight * effectiveZoom;

        // 🛡️ PRODUCTION: Validate scaled dimensions
        if (!Number.isFinite(scaledWidth) || !Number.isFinite(scaledHeight) ||
          scaledWidth <= 0 || scaledHeight <= 0) {
          animationFrameId = requestAnimationFrame(updateFollow);
          return;
        }

        // Calculate cursor position (already validated above)
        const cursorX = Math.max(0, Math.min(1, cursorPos.x));
        const cursorY = Math.max(0, Math.min(1, cursorPos.y));

        // 🎯 CAMERA ANTICIPATION: Predict where cursor will go
        const currentIntent = intentAnalyzerRef.current.analyzeIntent();
        let anticipatedX = cursorX;
        let anticipatedY = cursorY;

        // Use predicted position if confidence is high enough
        if (currentIntent.confidence > 0.6 && currentIntent.predictedPosition) {
          const predicted = currentIntent.predictedPosition;
          const anticipationStrength = CAMERA_CONFIG.ANTICIPATION_STRENGTH;

          // Different anticipation strength based on intent
          let effectiveAnticipation = anticipationStrength;
          if (currentIntent.intent === 'targeting') {
            effectiveAnticipation *= 1.5; // Strong anticipation for targeting
          } else if (currentIntent.intent === 'reading') {
            effectiveAnticipation *= 0.8; // Moderate anticipation for reading
          } else if (currentIntent.intent === 'gesturing') {
            effectiveAnticipation *= 0.3; // Light anticipation for gesturing
          }

          // Blend current position with predicted position
          anticipatedX = cursorX * (1 - effectiveAnticipation) + predicted.x * effectiveAnticipation;
          anticipatedY = cursorY * (1 - effectiveAnticipation) + predicted.y * effectiveAnticipation;

          // Clamp to valid range
          anticipatedX = Math.max(0, Math.min(1, anticipatedX));
          anticipatedY = Math.max(0, Math.min(1, anticipatedY));
        }

        // 🎯 CURSOR CENTERING: Always center on current cursor position when following
        // The camera should keep the cursor perfectly centered at all times
        let targetX = anticipatedX;
        let targetY = anticipatedY;

        // Always center on cursor position - focus points are for initial zoom targeting only
        // This ensures the cursor stays perfectly centered during recording

        // 🎯 CURSOR CENTERING: Always center cursor when following is enabled
        // The camera should keep the cursor perfectly centered at all times for predictable behavior
        const currentCameraX = Number.isFinite(transformCacheRef.current.x) ? transformCacheRef.current.x : 0;
        const currentCameraY = Number.isFinite(transformCacheRef.current.y) ? transformCacheRef.current.y : 0;

        // Calculate the target offset needed to center the cursor perfectly
        let targetOffsetX = (containerWidth / 2) - (targetX * scaledWidth);
        let targetOffsetY = (containerHeight / 2) - (targetY * scaledHeight);

        // Always center the cursor - no safe box logic that prevents centering
        // The camera should follow the cursor continuously for smooth, predictable behavior

        // 🧠 Gentle camera re-centering during zoom-out (80-90% instead of perfect)
        if (currentZoomState === "DECAY") {
          const blendFactor = CAMERA_CONFIG.DECAY_BLEND_FACTOR;
          const neutralX = Number.isFinite(neutralCameraRef.current.x) ? neutralCameraRef.current.x : 0;
          const neutralY = Number.isFinite(neutralCameraRef.current.y) ? neutralCameraRef.current.y : 0;

          // 🛡️ PRODUCTION: Validate offsets before blending
          if (Number.isFinite(targetOffsetX) && Number.isFinite(targetOffsetY) &&
            Number.isFinite(neutralX) && Number.isFinite(neutralY)) {
            // Blend towards neutral with natural drift
            targetOffsetX = lerp(neutralX, targetOffsetX, 1 - blendFactor);
            targetOffsetY = lerp(neutralY, targetOffsetY, 1 - blendFactor);

            // Update neutral reference slowly (adds organic imperfection)
            neutralCameraRef.current.x = lerp(neutralCameraRef.current.x, targetOffsetX, 0.1);
            neutralCameraRef.current.y = lerp(neutralCameraRef.current.y, targetOffsetY, 0.1);
          }
        } else {
          // Update neutral reference when not zooming out
          if (Number.isFinite(targetOffsetX) && Number.isFinite(targetOffsetY)) {
            neutralCameraRef.current.x = targetOffsetX;
            neutralCameraRef.current.y = targetOffsetY;
          }
        }

        // 🎯 Distance-based stiffness: confident when far, gentle when near
        // (currentCameraX/Y already defined above)

        // 🛡️ PRODUCTION: Validate offsets before calculating distance
        if (!Number.isFinite(targetOffsetX) || !Number.isFinite(targetOffsetY)) {
          animationFrameId = requestAnimationFrame(updateFollow);
          return;
        }

        const distanceX = Math.abs(targetOffsetX - currentCameraX);
        const distanceY = Math.abs(targetOffsetY - currentCameraY);
        const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

        // 🎯 ADAPTIVE CAMERA BEHAVIOR: Learn from user patterns
        const adaptiveParams = adaptiveLearnerRef.current.getAdaptiveParameters();
        const recommendedPreset = intentAnalyzerRef.current.getRecommendedPreset();
        const activePreset = CAMERA_PRESETS[recommendedPreset];

        // Base stiffness calculation
        const distanceNormalized = Math.min(1, Math.max(0, distance / CAMERA_CONFIG.DISTANCE_STIFFNESS_THRESHOLD));

        // 🎬 Use preset values as base, then apply adaptive learning adjustments
        let effectiveStiffness = lerp(
          activePreset.stiffness * 0.8, // Min variation
          activePreset.stiffness * 1.4, // Max variation
          distanceNormalized
        ) * adaptiveParams.stiffnessMultiplier;

        let effectiveDamping = activePreset.damping * adaptiveParams.dampingMultiplier;
        let effectiveAnticipation = activePreset.anticipation * adaptiveParams.anticipationMultiplier;

        // 🎯 Intent-specific fine-tuning within preset
        if (currentIntent.intent === 'targeting' && currentIntent.confidence > 0.7) {
          // Always boost responsiveness for targeting, regardless of preset
          effectiveStiffness *= 1.3;
          effectiveDamping *= 0.85;
          effectiveAnticipation *= 0.8; // Less anticipation for immediate response
        } else if (currentIntent.intent === 'reading' && recommendedPreset === 'cinematic') {
          // Enhance cinematic feel for reading in cinematic mode
          effectiveDamping = Math.min(effectiveDamping * 1.2, 0.98);
          effectiveAnticipation *= 1.2;
        }

        // 🎯 Adaptive behavior learning: Adjust based on movement statistics
        const movementStats = intentAnalyzerRef.current.getMovementStats();
        if (movementStats.movementSmoothness > 0.8) {
          // User moves smoothly: Use more cinematic settings
          effectiveDamping = Math.min(effectiveDamping * 1.1, CAMERA_CONFIG.CINEMATIC_DAMPING);
        } else if (movementStats.movementSmoothness < 0.3) {
          // User moves erratically: Use more responsive settings
          effectiveStiffness *= 1.2;
          effectiveDamping *= 0.9;
        }

        // 🟢 Apply spring-damper smoothing to camera pan (X/Y)
        // Uses velocity-based physics for responsive, natural motion
        const currentVelX = Number.isFinite(cameraVelocityRef.current.x) ? cameraVelocityRef.current.x : 0;
        const currentVelY = Number.isFinite(cameraVelocityRef.current.y) ? cameraVelocityRef.current.y : 0;

        const { current: smoothedX, velocity: velX } = smoothSpring(
          currentCameraX,
          currentVelX,
          targetOffsetX,
          effectiveStiffness,
          effectiveDamping
        );

        const { current: smoothedY, velocity: velY } = smoothSpring(
          currentCameraY,
          currentVelY,
          targetOffsetY,
          effectiveStiffness,
          CAMERA_CONFIG.CAMERA_DAMPING
        );

        // 🛡️ PRODUCTION: Validate smoothed values before updating
        if (Number.isFinite(smoothedX) && Number.isFinite(smoothedY) &&
          Number.isFinite(velX) && Number.isFinite(velY)) {
          // Update velocity refs for next frame
          cameraVelocityRef.current = { x: velX, y: velY };
        } else {
          // Fallback: use target directly if smoothing fails
          animationFrameId = requestAnimationFrame(updateFollow);
          return;
        }

        // 🎯 SCREENSTUDIO-STYLE: Cursor indicator smoothing (cursor leads camera)
        // Update cursor indicator position with faster smoothing than camera
        // This makes cursor arrive before camera, creating the "cursor leads" effect
        if (currentCursorPosRef.current && previewContainerRef.current) {
          try {
            const container = previewContainerRef.current;
            const rect = container.getBoundingClientRect();

            // 🛡️ PRODUCTION: Validate container dimensions
            if (!rect || rect.width <= 0 || rect.height <= 0 ||
              !Number.isFinite(window.innerWidth) || !Number.isFinite(window.innerHeight)) {
              animationFrameId = requestAnimationFrame(updateFollow);
              return;
            }

            // Convert window-normalized coordinates to container-relative coordinates
            const windowX = currentCursorPosRef.current.x * window.innerWidth;
            const windowY = currentCursorPosRef.current.y * window.innerHeight;
            const containerX = (windowX - rect.left) / rect.width;
            const containerY = (windowY - rect.top) / rect.height;

            // Clamp to container bounds (0-1) and only show if cursor is over container
            if (containerX >= 0 && containerX <= 1 && containerY >= 0 && containerY <= 1 &&
              Number.isFinite(containerX) && Number.isFinite(containerY)) {
              const targetX = Math.max(0, Math.min(1, containerX));
              const targetY = Math.max(0, Math.min(1, containerY));

              // Initialize smoothed position if needed
              if (!cursorIndicatorSmoothPosRef.current) {
                cursorIndicatorSmoothPosRef.current = { x: targetX, y: targetY };
              }

              const currentPos = cursorIndicatorSmoothPosRef.current;
              const currentVelX = Number.isFinite(cursorIndicatorVelocityRef.current.x)
                ? cursorIndicatorVelocityRef.current.x
                : 0;
              const currentVelY = Number.isFinite(cursorIndicatorVelocityRef.current.y)
                ? cursorIndicatorVelocityRef.current.y
                : 0;

              // Apply faster smoothing to cursor indicator (higher stiffness than camera)
              // Higher stiffness = faster response = cursor arrives before camera
              const { current: smoothedX, velocity: velX } = smoothSpring(
                Number.isFinite(currentPos.x) ? currentPos.x : targetX,
                currentVelX,
                targetX,
                CAMERA_CONFIG.CURSOR_STIFFNESS,
                CAMERA_CONFIG.CURSOR_DAMPING
              );

              const { current: smoothedY, velocity: velY } = smoothSpring(
                Number.isFinite(currentPos.y) ? currentPos.y : targetY,
                currentVelY,
                targetY,
                CAMERA_CONFIG.CURSOR_STIFFNESS,
                CAMERA_CONFIG.CURSOR_DAMPING
              );

              // 🛡️ PRODUCTION: Validate smoothed values before updating
              if (Number.isFinite(smoothedX) && Number.isFinite(smoothedY) &&
                Number.isFinite(velX) && Number.isFinite(velY)) {
                // Update smoothed position and velocity
                cursorIndicatorSmoothPosRef.current = { x: smoothedX, y: smoothedY };
                cursorIndicatorVelocityRef.current = { x: velX, y: velY };

                // Update cursor indicator position (only if changed significantly)
                const currentIndicatorPos = cursorIndicatorPosRef.current;
                if (!currentIndicatorPos ||
                  Math.abs(currentIndicatorPos.x - smoothedX) > CAMERA_CONFIG.CURSOR_UPDATE_THRESHOLD ||
                  Math.abs(currentIndicatorPos.y - smoothedY) > CAMERA_CONFIG.CURSOR_UPDATE_THRESHOLD) {
                  if (isMounted) {
                    setCursorIndicatorPos({ x: smoothedX, y: smoothedY });
                  }
                }
              }
            } else {
              // Cursor outside container - hide indicator
              if (cursorIndicatorPosRef.current && isMounted) {
                setCursorIndicatorPos(null);
              }
              cursorIndicatorSmoothPosRef.current = null;
              cursorIndicatorVelocityRef.current = { x: 0, y: 0 };
            }
          } catch (error) {
            console.error('Cursor indicator smoothing: Error', error);
            // Continue animation loop even if cursor smoothing fails
          }
        }

        // 🎨 Elliptical falloff for edge behavior (smoothstep instead of linear)
        const maxOffsetX = Math.max(0, (scaledWidth - containerWidth) / 2);
        const maxOffsetY = Math.max(0, (scaledHeight - containerHeight) / 2);

        // Smoothstep falloff for invisible boundaries
        const smoothstep = (t: number) => t * t * (3 - 2 * t);
        const edgePadding = CAMERA_CONFIG.EDGE_PADDING;

        // 🛡️ PRODUCTION: Validate smoothed values before clamping
        if (!Number.isFinite(smoothedX) || !Number.isFinite(smoothedY)) {
          animationFrameId = requestAnimationFrame(updateFollow);
          return;
        }

        let clampedOffsetX = smoothedX;
        let clampedOffsetY = smoothedY;

        if (maxOffsetX > 0 && Number.isFinite(maxOffsetX)) {
          const distFromEdgeX = maxOffsetX - Math.abs(smoothedX);
          if (distFromEdgeX < edgePadding) {
            const strength = smoothstep(Math.max(0, distFromEdgeX / edgePadding));
            clampedOffsetX = Math.sign(smoothedX) * lerp(Math.abs(smoothedX), maxOffsetX, 1 - strength);
          }
          clampedOffsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, clampedOffsetX));
        }

        if (maxOffsetY > 0 && Number.isFinite(maxOffsetY)) {
          const distFromEdgeY = maxOffsetY - Math.abs(smoothedY);
          if (distFromEdgeY < edgePadding) {
            const strength = smoothstep(Math.max(0, distFromEdgeY / edgePadding));
            clampedOffsetY = Math.sign(smoothedY) * lerp(Math.abs(smoothedY), maxOffsetY, 1 - strength);
          }
          clampedOffsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, clampedOffsetY));
        }

        // Only update transform if it changed significantly (reduce DOM writes)
        const cache = transformCacheRef.current;
        const transformChanged =
          Math.abs(cache.x - clampedOffsetX) > CAMERA_CONFIG.CAMERA_UPDATE_THRESHOLD ||
          Math.abs(cache.y - clampedOffsetY) > CAMERA_CONFIG.CAMERA_UPDATE_THRESHOLD ||
          Math.abs(cache.scale - effectiveZoom) > CAMERA_CONFIG.ZOOM_UPDATE_THRESHOLD;

        if (transformChanged && container) {
          try {
            // Use transform3d for GPU acceleration - apply to container, not video
            const transform = `translate3d(${clampedOffsetX}px, ${clampedOffsetY}px, 0) scale3d(${effectiveZoom}, ${effectiveZoom}, 1)`;
            container.style.transform = transform;

            // Cache the transform
            transformCacheRef.current = {
              x: clampedOffsetX,
              y: clampedOffsetY,
              scale: effectiveZoom
            };
          } catch (error) {
            console.error('Transform update: Error applying transform', error);
            // Continue animation loop even if transform fails
          }
        }

        // Only update transition when state changes (not every frame)
        const newTransitionState = currentZoomState === "FOCUSED"
          ? "zoom-in"
          : currentZoomState === "DECAY"
            ? "zoom-out"
            : "default";

        if (transitionStateRef.current !== newTransitionState && video) {
          transitionStateRef.current = newTransitionState;
          try {
            if (currentZoomState === "FOCUSED") {
              container.style.transition = "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)";
            } else if (currentZoomState === "DECAY") {
              container.style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
            } else {
              container.style.transition = "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)";
            }
          } catch (error) {
            console.error('Transition update: Error setting transition', error);
          }
        }

        animationFrameId = requestAnimationFrame(updateFollow);
      } catch (error) {
        console.error('updateFollow: Error in animation loop', error);
        // Continue animation loop even on error
        animationFrameId = requestAnimationFrame(updateFollow);
      }
    };

    // Handle window resize to invalidate cache
    const handleResize = () => {
      try {
        containerDimensionsRef.current = null;
        lastDimensionsUpdateRef.current = 0;
      } catch (error) {
        console.error('handleResize: Error invalidating cache', error);
      }
    };
    window.addEventListener("resize", handleResize);

    animationFrameId = requestAnimationFrame(updateFollow);

    return () => {
      // 🛡️ PRODUCTION: Proper cleanup to prevent memory leaks and state updates after unmount
      isMounted = false;

      try {
        window.removeEventListener("resize", handleResize);
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
        if (video) {
          video.style.willChange = "auto";
          video.style.backfaceVisibility = "";
          video.style.perspective = "";
        }
        // Reset cursor smoothing state
        cursorIndicatorSmoothPosRef.current = null;
        cursorIndicatorVelocityRef.current = { x: 0, y: 0 };
      } catch (error) {
        console.error('Cleanup: Error during cleanup', error);
      }
    };
  }, [followCursor, currentCursorPos, zoomLevel, recordingState, zoomState, rawRecording]);

  // Reset zoom and transform when not recording
  useEffect(() => {
    if (recordingState !== "recording" && previewContainerRef.current) {
      previewContainerRef.current.style.transform = "scale(1)";
      previewContainerRef.current.style.transition = "transform 0.3s ease";
      setViewportZoom(1);
      setCurrentCursorPos(null);
      setCursorIndicatorPos(null);
      setZoomState("NEUTRAL");
      zoomTargetRef.current = 1;
      focusPointRef.current = null;
      cursorDwellStartRef.current = null;
      cursorDwellPositionRef.current = null;
      holdStartTimeRef.current = null;

      // Save adaptive learning preferences when stopping recording
      adaptiveLearnerRef.current.savePreferences();
      cameraOffsetRef.current = { x: 0, y: 0 };
      lastIntentTimeRef.current = 0;
      lastClickClusterTimeRef.current = 0;
      // Clean up click cluster tracking
      clickClusterRef.current = [];
      lastZoomTimeRef.current = 0;
      if (zoomDebounceTimeoutRef.current) {
        clearTimeout(zoomDebounceTimeoutRef.current);
        zoomDebounceTimeoutRef.current = null;
      }
      // Reset spring-damper velocities
      cameraVelocityRef.current = { x: 0, y: 0 };
      zoomVelocityRef.current = 0;
      transformCacheRef.current = { x: 0, y: 0, scale: 1 };
      // Reset smart insights
      setInteractionCount(0);
      setAvgClickInterval(null);
      setRecordingQualityScore(100);

      // Cleanup canvas recording
      if (canvasAnimationFrameRef.current) {
        cancelAnimationFrame(canvasAnimationFrameRef.current);
        canvasAnimationFrameRef.current = null;
      }
      if (canvasStreamRef.current) {
        canvasStreamRef.current.getTracks().forEach(track => track.stop());
        canvasStreamRef.current = null;
      }
      if (canvasRef.current) {
        canvasRef.current = null;
      }
      // Cleanup particle system
      if (particleSystemRef.current) {
        particleSystemRef.current.clear();
        particleSystemRef.current = null;
      }
      lastParticleUpdateRef.current = 0;
      lastCursorPosForParticlesRef.current = null;
    }
  }, [recordingState]);

  // Persist cursor following preference
  useEffect(() => {
    localStorage.setItem("recorder_followCursor", followCursor.toString());
  }, [followCursor]);

  // Zoom controls (manual - overrides automatic system)
  const handleZoomIn = () => {
    const newZoom = Math.min(viewportZoom + 0.3, CAMERA_CONFIG.ZOOM_MAX);
    viewportManagerRef.current?.setZoom(newZoom);
    lastActivityTimeRef.current = Date.now();
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(viewportZoom - 0.3, CAMERA_CONFIG.ZOOM_MIN);
    viewportManagerRef.current?.setZoom(newZoom);
    lastActivityTimeRef.current = Date.now();
  };

  const handleResetZoom = () => {
    viewportManagerRef.current?.setZoom(CAMERA_CONFIG.ZOOM_DEFAULT);
    lastActivityTimeRef.current = Date.now();
  };

  const startRecordingActual = async () => {
    if (!mediaStreamRef.current) return;

    chunksRef.current = [];
    clicksRef.current = [];
    movesRef.current = [];
    setMarkers([]); // Reset markers
    recordingStartTimeRef.current = Date.now();

    console.log('[Frontend] 🎬🎬🎬 Recording started at:', new Date(recordingStartTimeRef.current).toISOString());
    console.log('[Frontend] Video element exists:', !!videoPreviewRef.current);

    // Signal extension via BOTH window message AND WebSocket for reliable cross-tab sync
    // 1. Window message → content script on DemoForge tab → broadcasts to all tabs
    window.postMessage({
      type: 'DEMOFORGE_START_RECORDING',
      recordingStartTime: recordingStartTimeRef.current
    }, '*');
    console.log('[Frontend] 📤 Signaled extension to start recording via window message');

    // 2. WebSocket → background script → sets storage + broadcasts to all tabs
    // This is the PRIMARY path for cross-tab recording
    extensionWS.startRecording(recordingStartTimeRef.current);
    console.log('[Frontend] 📤 Signaled extension to start recording via WebSocket. Screen: ${window.screen.width}x${window.screen.height}, DPR: ${window.devicePixelRatio}');

    // Setup recording stream based on mode
    let canvasStream: MediaStream | null = null;

    // If raw recording is enabled, use screen stream directly (no effects)
    // Otherwise, use canvas stream with effects
    if (!rawRecording) {
      try {
        const streamResult = setupCanvasRecording();
        if (streamResult instanceof Promise) {
          canvasStream = await streamResult;
        } else {
          canvasStream = streamResult;
        }

        // If we got a canvas stream, wait a bit to ensure frames are being produced
        if (canvasStream) {
          // Wait for at least one frame to be drawn before starting MediaRecorder
          await new Promise(resolve => setTimeout(resolve, 100));

          // Verify the stream has video tracks
          if (canvasStream.getVideoTracks().length === 0) {
            console.warn("Canvas stream has no video tracks, falling back to screen recording");
            canvasStream = null;
          }
        }
      } catch (error) {
        console.error("Error setting up canvas recording:", error);
        toast({
          title: "Recording warning",
          description: "Could not setup canvas recording. Using screen recording instead.",
          variant: "default"
        });
      }
    }

    // Use canvas stream if available and not in raw mode, otherwise use screen stream (raw)
    const recordingStream = (!rawRecording && canvasStream) ? canvasStream : mediaStreamRef.current;

    // Add audio tracks from original stream if using canvas stream
    if (canvasStream && mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach(track => {
        if (!canvasStream!.getAudioTracks().some(t => t.id === track.id)) {
          canvasStream!.addTrack(track);
        }
      });
    }

    // Determine mime type based on browser support
    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];

    let selectedMimeType = mimeTypes[0];
    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        selectedMimeType = mimeType;
        break;
      }
    }

    // Verify the stream has tracks before creating MediaRecorder
    if (recordingStream.getVideoTracks().length === 0) {
      toast({
        title: "Recording error",
        description: "No video track available. Please try selecting your screen again.",
        variant: "destructive"
      });
      setRecordingState("idle");
      return;
    }

    // Use higher bitrates for better quality
    const bitrates = {
      high: 12000000,   // 12 Mbps for high quality
      medium: 6000000,  // 6 Mbps for medium quality
      low: 3000000      // 3 Mbps for low quality
    };

    const mediaRecorder = new MediaRecorder(recordingStream, {
      mimeType: selectedMimeType,
      videoBitsPerSecond: bitrates[recordingQuality],
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
        console.log(`Received chunk: ${event.data.size} bytes, total chunks: ${chunksRef.current.length}`);
      }
    };

    mediaRecorder.onerror = (event) => {
      console.error("MediaRecorder error:", event);
      toast({
        title: "Recording error",
        description: "An error occurred while recording. Please try again.",
        variant: "destructive"
      });
    };

    mediaRecorder.onstop = () => {
      // Ensure we have chunks before creating blob
      if (chunksRef.current.length === 0) {
        toast({
          title: "Recording error",
          description: "No video data was recorded. Please try again.",
          variant: "destructive"
        });
        setRecordingState("idle");
        return;
      }

      const blob = new Blob(chunksRef.current, { type: selectedMimeType });

      // Verify blob size
      if (blob.size === 0) {
        toast({
          title: "Recording error",
          description: "Recorded video is empty. Please try again.",
          variant: "destructive"
        });
        setRecordingState("idle");
        return;
      }

      const videoUrl = URL.createObjectURL(blob);

      // Cleanup canvas recording
      if (canvasAnimationFrameRef.current) {
        cancelAnimationFrame(canvasAnimationFrameRef.current);
        canvasAnimationFrameRef.current = null;
      }
      if (canvasStreamRef.current) {
        canvasStreamRef.current.getTracks().forEach(track => track.stop());
        canvasStreamRef.current = null;
      }
      if (canvasRef.current) {
        canvasRef.current = null;
      }
      // Cleanup particle system
      if (particleSystemRef.current) {
        particleSystemRef.current.clear();
        particleSystemRef.current = null;
      }
      lastParticleUpdateRef.current = 0;
      lastCursorPosForParticlesRef.current = null;

      // Cleanup audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
      }

      setRecordingState("stopped");
      toast({
        title: "Recording saved",
        description: "Redirecting to editor...",
      });

      // Download cursor data as JSON file
      const cursorData = {
        clicks: clicksRef.current,
        moves: movesRef.current,
        markers: markers,
        metadata: {
          recordingStartTime: recordingStartTimeRef.current,
          duration: timer,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        }
      };

      const dataStr = JSON.stringify(cursorData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const dataUrl = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `cursor-data-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(dataUrl);

      console.log('[Frontend] Downloaded cursor data:', {
        clicks: clicksRef.current.length,
        moves: movesRef.current.length,
        markers: markers.length
      });

      setTimeout(() => {
        navigate("/editor/new", {
          state: {
            videoUrl,
            clickData: clicksRef.current,
            moveData: movesRef.current,
            markers: markers,
            rawRecording, // Pass raw recording flag for layered rendering
            visualEffects: {
              cursorEffects,
              clickRipple,
              cursorGlow,
              cursorTrail,
              showClickIndicator,
            },
          }
        });
      }, 1500);
    };

    // Set recording state BEFORE starting MediaRecorder
    // This ensures the canvas drawing loop continues
    setRecordingState("recording");

    // Request data more frequently for better reliability
    mediaRecorder.start(500); // Collect 500ms chunks for better reliability
    mediaRecorderRef.current = mediaRecorder;

    toast({
      title: "Recording started",
      description: "Recording preview container with all effects! Press M for markers, Space to pause, Esc to stop",
    });
  };

  const handlePauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingState("paused");
    }
  };

  const handleResumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingState("recording");
    }
  };

  const handleStopRecording = () => {
    // Signal extension to stop recording via BOTH window message AND WebSocket
    // 1. Window message → content script on DemoForge tab
    window.postMessage({ type: 'DEMOFORGE_STOP_RECORDING' }, '*');
    console.log('[Frontend] 📤 Signaled extension to stop recording via window message');

    // 2. WebSocket → background script → broadcasts to all tabs
    extensionWS.stopRecording();
    console.log('[Frontend] 📤 Signaled extension to stop recording via WebSocket');

    // 🎬 End-of-video settle: Settle camera before stopping
    // Immediately settle to neutral zoom and center camera for final frames
    if (followCursor) {
      setZoomState("NEUTRAL");
      zoomTargetRef.current = 1.0;
      zoomVelocityRef.current = 0;
      // Camera will settle naturally through the update loop
    }

    // Request final data chunk before stopping
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused') {
        // Request any remaining data
        mediaRecorderRef.current.requestData();
        // Small delay to ensure data is collected and camera settles
        setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
        }, 100);
      }
    }

    // Cleanup canvas recording after a short delay to ensure final frame is captured
    setTimeout(() => {
      if (canvasAnimationFrameRef.current) {
        cancelAnimationFrame(canvasAnimationFrameRef.current);
        canvasAnimationFrameRef.current = null;
      }
      if (canvasStreamRef.current) {
        canvasStreamRef.current.getTracks().forEach(track => track.stop());
        canvasStreamRef.current = null;
      }
      if (canvasRef.current) {
        canvasRef.current = null;
      }
    }, 200);

    // Stop all tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden selection:bg-primary/20">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-3xl animate-float" style={{ animationDuration: '15s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/5 blur-3xl animate-float" style={{ animationDuration: '20s', animationDelay: '2s' }} />
      </div>

      <Header isAuthenticated user={user} />

      <main className="container grid gap-12 py-16 px-6 lg:grid-cols-12 lg:gap-16 lg:items-start relative z-10">
        {/* Left Column: Instructions & Tips */}
        <div className="space-y-10 lg:col-span-6 self-start sticky top-24">
          <div className="space-y-4">
            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight pb-1">
              Record Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600">Flow</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Create engaging, professional demos with automatic zoom, smooth cursor tracking, and beautiful click effects.
            </p>
          </div>

          {/* Steps Timeline */}
          <div className="relative space-y-6 before:absolute before:top-4 before:h-full before:w-px before:bg-gradient-to-b before:from-border before:via-border/50 before:to-transparent before:-z-10 bg-background/50 backdrop-blur-sm rounded-3xl">
            <div className={`group relative flex gap-5 rounded-2xl border p-4 transition-all duration-300 ${recordingState === 'idle' ? 'bg-primary/5 border-primary/50 shadow-glow' : 'bg-card/40 hover:bg-card border-border/50 hover:border-border'}`}>
              <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold transition-all duration-300 ${recordingState === 'idle' ? 'bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/25' : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'}`}>
                1
              </div>
              <div>
                <h3 className={`font-semibold text-lg ${recordingState === 'idle' ? 'text-primary' : 'text-foreground'}`}>Choose source</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Select your entire screen, a window, or a specific browser tab to share.</p>
              </div>
            </div>

            <div className={`group relative flex gap-5 rounded-2xl border p-4 transition-all duration-300 ${recordingState === 'selecting' ? 'bg-primary/5 border-primary/50 shadow-glow' : 'bg-card/40 hover:bg-card border-border/50 hover:border-border'}`}>
              <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold transition-all duration-300 ${recordingState === 'selecting' ? 'bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/25' : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'}`}>
                2
              </div>
              <div>
                <h3 className={`font-semibold text-lg ${recordingState === 'selecting' ? 'text-primary' : 'text-foreground'}`}>Hide Controls</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Click "Hide" on the browser's screen sharing bar to keep your recording clean.</p>
              </div>
            </div>

            <div className={`group relative flex gap-5 rounded-2xl border p-4 transition-all duration-300 ${['ready', 'countdown', 'recording'].includes(recordingState) ? 'bg-primary/5 border-primary/50 shadow-glow' : 'bg-card/40 hover:bg-card border-border/50 hover:border-border'}`}>
              <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold transition-all duration-300 ${['ready', 'countdown', 'recording'].includes(recordingState) ? 'bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/25' : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'}`}>
                3
              </div>
              <div>
                <h3 className={`font-semibold text-lg ${['ready', 'countdown', 'recording'].includes(recordingState) ? 'text-primary' : 'text-foreground'}`}>Record & Polish</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Navigate naturally. We'll handle the zooms, clicks, and polish automatically.</p>
              </div>
            </div>
          </div>

          {/* Tips Panel */}

          {/* Tips Panel */}
          <Collapsible>
            <CollapsibleTrigger className="w-full rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-colors">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3 font-semibold text-base">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  Demo Creator Checklist
                </div>
                <ChevronDown className="h-4 w-4" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5 text-sm">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2 text-blue-700 dark:text-blue-300">Before Recording:</h4>
                  <ul className="list-none space-y-2 ml-1">
                    {['Clean up your desktop', 'Turn off notifications', 'Close extra tabs', 'Check mic levels'].map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-muted-foreground">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="pt-2 border-t border-blue-500/10">
                  <h4 className="font-semibold mb-2 text-blue-700 dark:text-blue-300 mt-2">Pro Tips:</h4>
                  <ul className="list-none space-y-2 ml-1">
                    <li className="flex items-start gap-2 text-muted-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                      Move mouse smoothly - viewers follow your cursor
                    </li>
                    <li className="flex items-start gap-2 text-muted-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                      Press <kbd className="px-1.5 py-0.5 bg-background/50 rounded text-xs font-mono mx-1">M</kbd> to add markers
                    </li>
                  </ul>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Smart Tips Panel */}
          {showSmartTips && recordingState === "recording" && (
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="w-full rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-4 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors my-4">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3 font-semibold text-base">
                    <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                      <Zap className="h-5 w-5" />
                    </div>
                    Smart Insights
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-4 text-sm">
                <div className="space-y-3">
                  {recordingQualityScore < 80 && timer > 10 && (
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-background/60 border border-amber-500/10">
                      <Lightbulb className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-foreground">Tip: {recordingQualityScore < 60 ? 'Consider adding more markers (M key) to highlight important moments' : 'Try varying your click pace for better engagement'}</p>
                      </div>
                    </div>
                  )}
                  {/* ... specific conditional tips ... */}
                  {avgClickInterval && avgClickInterval < 500 && (
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-background/60 border border-blue-500/10">
                      <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-foreground">You're clicking rapidly. Slow down for clarity.</p>
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Feature Highlights - Grid Layout */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-4 hover:shadow-lg transition-all cursor-pointer group hover:-translate-y-1">
              <div className="flex flex-col gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 group-hover:bg-primary/30 transition-colors shadow-sm">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="mb-1 font-semibold text-foreground">Visual Effects</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Beautiful ripple animations and clear click indicators.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 hover:shadow-lg transition-all cursor-pointer group hover:-translate-y-1">
              <div className="flex flex-col gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 group-hover:bg-purple-500/30 transition-colors shadow-sm">
                  <Video className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="mb-1 font-semibold text-foreground">Smart Zoom</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Auto-zoom on important areas while keeping context.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-4 hover:shadow-lg transition-all cursor-pointer group hover:-translate-y-1">
              <div className="flex flex-col gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500/20 group-hover:bg-green-500/30 transition-colors shadow-sm">
                  <Move className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="mb-1 font-semibold text-foreground">Cursor Follow</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Smooth camera movement tracking your mouse.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 hover:shadow-lg transition-all cursor-pointer group hover:-translate-y-1">
              <div className="flex flex-col gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors shadow-sm">
                  <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="mb-1 font-semibold text-foreground">AI Insights</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Real-time quality scoring and suggestions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* Right Column: Recorder Interface */}
        <div className="lg:col-span-6 lg:sticky lg:top-24">
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-card ring-1 ring-border/50">
            {/* Browser Chrome visual - Enhanced */}
            <div className="flex items-center gap-4 border-b border-border/50 bg-muted/30 px-4 py-3 backdrop-blur-sm">
              <div className="flex gap-2">
                <div className="h-3 w-3 rounded-full bg-red-400/90 shadow-sm" />
                <div className="h-3 w-3 rounded-full bg-yellow-400/90 shadow-sm" />
                <div className="h-3 w-3 rounded-full bg-green-400/90 shadow-sm" />
              </div>

              {/* Fake URL Bar */}
              <div className="flex-1 flex items-center justify-center">
                <div className="flex w-full max-w-md items-center gap-2 rounded-lg bg-background/50 border border-border/50 px-3 py-1.5 shadow-inner text-xs text-muted-foreground">
                  <div className="flex gap-2 items-center">
                    <span className="text-muted-foreground/50">https://</span>
                    <span className="text-foreground font-medium">recording.new</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                  <Monitor className="h-3 w-3" />
                  REC
                </div>
              </div>
            </div>

            {/* Preview Area - Redesigned with proper zoom layers */}
            <div
              className={`relative aspect-video bg-gradient-subtle transition-all duration-300 overflow-hidden ${recordingState === "recording"
                ? "ring-2 ring-primary/20 shadow-[0_0_50px_-12px_rgba(var(--primary),0.3)]"
                : recordingState === "paused"
                  ? "ring-2 ring-warning/20 shadow-lg"
                  : ""
                }`}
            >
              {/* Viewport Container - This handles the zoom and pan */}
              <div
                ref={previewContainerRef}
                className="absolute inset-0 w-full h-full"
                style={{
                  transformOrigin: 'center center',
                }}
              >
                {/* Video Container - Fixed size, centered */}
                <div className="absolute inset-4 flex items-center justify-center">
                  {/* Video Preview */}
                  {showPreview && mediaStreamRef.current && recordingState !== "idle" && (
                    <video
                      ref={videoPreviewRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-contain rounded-lg shadow-2xl border border-border/50"
                    />
                  )}
                </div>


                {/* Cursor Position Indicator (when following) - FIXED alignment */}
                {followCursor && cursorIndicatorPos && recordingState === "recording" && showPreview && (
                  <div
                    className="absolute z-30 pointer-events-none"
                    style={{
                      // cursorIndicatorPos is already in container-relative coordinates (0-1)
                      left: `${cursorIndicatorPos.x * 100}%`,
                      top: `${cursorIndicatorPos.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <div className="relative">
                      {/* Outer ring */}
                      <div className="absolute inset-0 w-8 h-8 border-2 border-primary/60 rounded-full animate-ping" />
                      {/* Inner dot */}
                      <div className="w-3 h-3 bg-primary rounded-full shadow-lg shadow-primary/50" />
                      {/* Crosshair lines */}
                      <div className="absolute top-1/2 left-1/2 w-16 h-px bg-primary/30 -translate-x-1/2 -translate-y-1/2" />
                      <div className="absolute top-1/2 left-1/2 w-px h-16 bg-primary/30 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                )}

                {/* Overlay content */}
                <div className={`relative z-10 flex flex-col items-center justify-center p-8 ${showPreview && mediaStreamRef.current && recordingState !== "idle" ? 'bg-background/20 backdrop-blur-sm rounded-xl border border-white/10' : ''}`} style={{ minHeight: '300px' }}>
                  {/* Idle State */}
                  {recordingState === "idle" && (
                    <div className="text-center animate-scale-in">
                      <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-inner animate-float">
                        <Video className="h-12 w-12 text-primary drop-shadow-md" />
                      </div>
                      <h3 className="text-2xl font-bold tracking-tight mb-2">Ready to record?</h3>
                      <p className="text-base text-muted-foreground max-w-[250px] mx-auto mb-6">
                        Click the button below to start capturing.
                      </p>
                      <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
                        <Zap className="h-3 w-3" />
                        <span>AI-Powered Mode Active</span>
                      </div>
                    </div>
                  )}

                  {/* Selecting / Hide Prompt State */}
                  {recordingState === "selecting" && (
                    <div className="text-center animate-fade-in max-w-sm">
                      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 animate-pulse">
                        <Monitor className="h-10 w-10 text-primary" />
                      </div>
                      <h3 className="text-xl font-bold mb-3">Screen Selected!</h3>
                      <div className="rounded-xl border border-border bg-card/50 p-4 backdrop-blur-sm">
                        <p className="text-sm text-muted-foreground">
                          Please click <span className="font-bold text-foreground bg-secondary px-1 py-0.5 rounded">Hide</span> on the browser sharing bar at the bottom of your screen.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Ready State */}
                  {recordingState === "ready" && (
                    <div className="text-center animate-fade-in">
                      <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-destructive/10 ring-4 ring-destructive/5">
                        <div className="h-20 w-20 rounded-full bg-destructive shadow-lg shadow-destructive/30 flex items-center justify-center animate-pulse">
                          <Circle className="h-10 w-10 fill-white text-white" />
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-foreground">Ready to Capture</h3>
                      <p className="text-sm text-muted-foreground mt-2">
                        Press "Start Recording" or Spacebar
                      </p>
                    </div>
                  )}

                  {/* Countdown State */}
                  {recordingState === "countdown" && (
                    <div className="text-center animate-scale-in flex flex-col items-center justify-center absolute inset-0 bg-background/90 backdrop-blur-md z-50">
                      <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                        <div className="text-9xl font-black text-primary animate-pulse tabular-nums relative z-10 drop-shadow-2xl">
                          {countdown}
                        </div>
                      </div>
                      <p className="mt-8 text-2xl font-medium text-muted-foreground tracking-widest uppercase">Get ready</p>
                    </div>
                  )}

                  {/* Recording / Paused State */}
                  {(recordingState === "recording" || recordingState === "paused") && (
                    <div className="text-center animate-fade-in relative z-20 w-full max-w-lg">
                      {/* HUD Stats Bar */}
                      <div className="flex items-center justify-center gap-6 mb-8">
                        <div className="text-center">
                          <div className={`text-5xl font-mono font-bold tracking-tight tabular-nums drop-shadow-lg ${recordingState === 'recording' ? 'text-white' : 'text-yellow-400'}`}>
                            {formatTime(timer)}
                          </div>
                          <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest ${recordingState === "recording" ? "bg-red-500/20 text-red-100 border border-red-500/30" : "bg-yellow-500/20 text-yellow-100 border border-yellow-500/30"
                            }`}>
                            <div className={`h-1.5 w-1.5 rounded-full ${recordingState === "recording" ? "bg-red-500 animate-pulse" : "bg-yellow-500"}`} />
                            {recordingState === "recording" ? "ON AIR" : "PAUSED"}
                          </div>
                        </div>
                      </div>

                      {/* Zoom and Follow Controls */}
                      {recordingState === "recording" && (
                        <div className="flex items-center justify-center gap-3">
                          <div className="flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 shadow-xl">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-white/20 text-white rounded-full"
                              onClick={handleZoomOut}
                              disabled={viewportZoom <= CAMERA_CONFIG.ZOOM_MIN}
                              title="Zoom Out (-)"
                            >
                              <ZoomOut className="h-4 w-4" />
                            </Button>
                            <span className="text-xs font-mono px-2 min-w-[3.5rem] text-center font-bold text-white">
                              {Math.round(viewportZoom * 100)}%
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-white/20 text-white rounded-full"
                              onClick={handleZoomIn}
                              disabled={viewportZoom >= CAMERA_CONFIG.ZOOM_MAX}
                              title="Zoom In (+)"
                            >
                              <ZoomIn className="h-4 w-4" />
                            </Button>
                          </div>

                          <Button
                            variant={followCursor ? "default" : "secondary"}
                            size="sm"
                            className={`h-11 px-4 gap-2 transition-all rounded-full border border-white/10 shadow-xl ${followCursor
                              ? "bg-primary hover:bg-primary/90 text-white"
                              : "bg-black/60 hover:bg-black/70 text-white backdrop-blur-md"
                              }`}
                            onClick={() => setFollowCursor(!followCursor)}
                            title="Toggle Cursor Following (F)"
                          >
                            <Move className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase tracking-wide">Follow</span>
                            {followCursor && (
                              <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                            )}
                          </Button>
                        </div>
                      )}


                      {/* Stats Grid */}
                      <div className="mt-8 grid grid-cols-3 gap-2">
                        <div className="flex flex-col items-center p-2 rounded-xl bg-black/40 backdrop-blur-sm border border-white/5">
                          <div className="text-xs text-white/60 mb-1">Interactions</div>
                          <div className="text-lg font-bold text-white">{interactionCount}</div>
                        </div>
                        <div className="flex flex-col items-center p-2 rounded-xl bg-black/40 backdrop-blur-sm border border-white/5">
                          <div className="text-xs text-white/60 mb-1">Speed</div>
                          <div className="text-lg font-bold text-white">{avgClickInterval ? Math.round(1000 / avgClickInterval * 10) / 10 : 0} <span className="text-[10px] opacity-50">cps</span></div>
                        </div>
                        <div className="flex flex-col items-center p-2 rounded-xl bg-black/40 backdrop-blur-sm border border-white/5">
                          <div className="text-xs text-white/60 mb-1">Quality</div>
                          <div className={`text-lg font-bold ${recordingQualityScore >= 80 ? 'text-green-400' : recordingQualityScore >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {Math.round(recordingQualityScore)}%
                          </div>
                        </div>
                      </div>

                      {/* Microphone Level Indicator */}
                      {(audioSource === "microphone" || audioSource === "both") && recordingState === "recording" && (
                        <div className="mt-6 w-full max-w-xs mx-auto">
                          <div className="flex items-center gap-3">
                            <Mic className="h-3 w-3 text-white/60" />
                            <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)] transition-all duration-75"
                                style={{ width: `${micLevel}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stopped State */}
                  {recordingState === "stopped" && (
                    <div className="text-center animate-scale-in">
                      <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-success text-success-foreground shadow-lg">
                        <CheckCircle2 className="h-10 w-10" />
                      </div>
                      <h3 className="text-lg font-semibold">Saved!</h3>
                      <p className="text-sm text-muted-foreground">Redirecting to editor...</p>
                    </div>
                  )}
                </div>

              </div>

            </div>
            {/* Divider */}
            <div className="h-px w-full bg-border/50" />

            {/* Settings Panel */}
            <Collapsible open={showSettings} onOpenChange={setShowSettings}>
              <CollapsibleTrigger className="w-full px-6 py-4 bg-muted/20 hover:bg-muted/40 transition-colors flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-background border border-border/50 shadow-sm text-muted-foreground group-hover:text-primary transition-colors">
                    <Settings className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-medium block">Recording Preferences</span>
                    <span className="text-[10px] text-muted-foreground">Quality, Audio & Timers</span>
                  </div>
                </div>
                {showSettings ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="p-6 space-y-6 bg-muted/20 border-t border-border/50 shadow-inner">
                <div className="grid gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="countdown" className="text-sm font-medium">Countdown</Label>
                      <span className="text-xs font-mono bg-background px-2 py-0.5 rounded border border-border/50">{countdownDuration}s</span>
                    </div>
                    <Slider
                      id="countdown"
                      min={0}
                      max={10}
                      step={1}
                      value={[countdownDuration]}
                      onValueChange={(value) => setCountdownDuration(value[0])}
                      className="py-2 cursor-pointer"
                      disabled={recordingState !== "idle"}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="audio" className="text-sm font-medium">Audio Source</Label>
                    <Select
                      value={audioSource}
                      onValueChange={(value: any) => setAudioSource(value)}
                      disabled={recordingState !== "idle"}
                    >
                      <SelectTrigger className="w-full bg-background border-border/50">
                        <SelectValue placeholder="Select audio source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">System Audio Only</SelectItem>
                        <SelectItem value="microphone">Microphone Only</SelectItem>
                        <SelectItem value="both">System + Microphone</SelectItem>
                        <SelectItem value="none">No Audio (Muted)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-border/50">
                    <div className="space-y-0.5">
                      <Label htmlFor="rawrecording-mode" className="text-sm font-medium flex items-center gap-2">
                        Raw Recording
                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-[10px] font-bold text-primary uppercase">Pro</span>
                      </Label>
                      <p className="text-[10px] text-muted-foreground max-w-[200px] leading-tight">
                        Disable effects during recording for higher performance.
                      </p>
                    </div>
                    <Switch
                      id="rawrecording-mode"
                      checked={rawRecording}
                      onCheckedChange={(checked) => {
                        setRawRecording(checked);
                        localStorage.setItem("recorder_rawRecording", String(checked));
                      }}
                      disabled={recordingState !== "idle"}
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Controls Bar - Floating Action Bar style */}
            <div className="p-6 bg-card/50 backdrop-blur-sm">
              {recordingState === "idle" && (
                <Button
                  size="lg"
                  className="h-14 w-full text-lg font-bold shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-600/90"
                  onClick={handleSelectScreen}
                >
                  <Monitor className="h-6 w-6 mr-2" />
                  Select Screen to Record
                </Button>
              )}

              {recordingState === "selecting" && (
                <Button size="lg" className="h-14 w-full text-lg gap-2 animate-pulse" onClick={handleConfirmHide}>
                  <CheckCircle2 className="h-6 w-6" />
                  I've Hidden the Sharing Bar
                </Button>
              )}

              {recordingState === "ready" && (
                <Button
                  variant="destructive"
                  size="lg"
                  className="h-16 w-full text-xl font-bold gap-3 shadow-2xl shadow-red-500/30 hover:shadow-red-500/40 transition-all hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700"
                  onClick={handleStartCountdown}
                >
                  <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-20" />
                    <Circle className="h-6 w-6 fill-current" />
                  </div>
                  START RECORDING
                </Button>
              )}

              {recordingState === "countdown" && (
                <Button variant="outline" size="lg" disabled className="h-14 w-full text-base font-medium opacity-80 cursor-not-allowed">
                  <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                  Starting in {countdown}s...
                </Button>
              )}

              {(recordingState === "recording" || recordingState === "paused") && (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    {recordingState === "recording" ? (
                      <Button variant="secondary" size="lg" className="h-12 border border-border/50 hover:bg-secondary/80" onClick={handlePauseRecording}>
                        <Pause className="h-5 w-5 mr-2" />
                        Pause Can
                      </Button>
                    ) : (
                      <Button variant="default" size="lg" className="h-12 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20" onClick={handleResumeRecording}>
                        <Circle className="h-4 w-4 fill-current mr-2" />
                        Resume
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="lg"
                      className="h-12 border-dashed border-border hover:bg-accent hover:text-accent-foreground"
                      onClick={handleAddMarker}
                      disabled={recordingState === "paused"}
                      title="Add Marker (M)"
                    >
                      <Bookmark className="h-4 w-4 mr-2" />
                      Add Marker
                    </Button>
                  </div>

                  <Button variant="destructive" size="lg" className="h-14 w-full gap-2 shadow-lg shadow-destructive/20 hover:shadow-destructive/30 hover:scale-[1.01] active:scale-[0.99] transition-all bg-gradient-to-r from-red-600 to-red-700" onClick={handleStopRecording}>
                    <Square className="h-5 w-5 fill-current" />
                    <span className="font-bold tracking-wide">STOP RECORDING & SAVE</span>
                  </Button>

                  {/* Keyboard Shortcuts Hint */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground/60 mt-2 px-2">
                    <div className="flex items-center gap-1.5 justify-center">
                      <div className="px-1.5 py-0.5 rounded bg-muted/50 border border-border/50 font-mono">SPC</div>
                      <span>Pause/Resume</span>
                    </div>
                    <div className="flex items-center gap-1.5 justify-center">
                      <div className="px-1.5 py-0.5 rounded bg-muted/50 border border-border/50 font-mono">M</div>
                      <span>Add Marker</span>
                    </div>
                    <div className="flex items-center gap-1.5 justify-center">
                      <div className="px-1.5 py-0.5 rounded bg-muted/50 border border-border/50 font-mono">F</div>
                      <span>Toggle Follow</span>
                    </div>
                    <div className="flex items-center gap-1.5 justify-center">
                      <div className="px-1.5 py-0.5 rounded bg-muted/50 border border-border/50 font-mono">ESC</div>
                      <span>Stop</span>
                    </div>
                  </div>

                  {/* Markers List */}
                  {markers.length > 0 && (
                    <div className="bg-background/50 rounded-lg p-3 border border-border/50 text-center">
                      <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center justify-center gap-2">
                        <Bookmark className="h-3 w-3" />
                        Marked Moments
                      </div>
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {markers.map((marker, idx) => (
                          <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-mono border border-primary/10">
                            {formatTime(marker.timestamp)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      </main >
    </div >
  );
}
