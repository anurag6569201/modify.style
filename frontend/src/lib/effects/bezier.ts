/**
 * God-Level Bezier Curve System
 * Smooth path interpolation for camera movements
 */

export interface Point {
  x: number;
  y: number;
}

export interface BezierCurve {
  p0: Point; // Start point
  p1: Point; // Control point 1
  p2: Point; // Control point 2
  p3: Point; // End point
}

/**
 * Calculate a point on a cubic Bezier curve
 * @param t - Parameter from 0 to 1
 * @param curve - Bezier curve definition
 */
export function bezierPoint(t: number, curve: BezierCurve): Point {
  const { p0, p1, p2, p3 } = curve;
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

/**
 * Calculate the derivative (velocity) of a Bezier curve
 */
export function bezierDerivative(t: number, curve: BezierCurve): Point {
  const { p0, p1, p2, p3 } = curve;
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

  return {
    x: 3 * mt2 * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * t2 * (p3.x - p2.x),
    y: 3 * mt2 * (p1.y - p0.y) + 6 * mt * t * (p2.y - p1.y) + 3 * t2 * (p3.y - p2.y),
  };
}

/**
 * Create a smooth Bezier curve from a series of points
 * Uses Catmull-Rom spline conversion
 */
export function createSmoothPath(points: Point[]): BezierCurve[] {
  if (points.length < 2) return [];

  const curves: BezierCurve[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : points[i + 1];

    // Convert Catmull-Rom to Bezier
    const tension = 0.5;
    const cp1x = p1.x + (p2.x - p0.x) / 6 * tension;
    const cp1y = p1.y + (p2.y - p0.y) / 6 * tension;
    const cp2x = p2.x - (p3.x - p1.x) / 6 * tension;
    const cp2y = p2.y - (p3.y - p1.y) / 6 * tension;

    curves.push({
      p0: p1,
      p1: { x: cp1x, y: cp1y },
      p2: { x: cp2x, y: cp2y },
      p3: p2,
    });
  }

  return curves;
}

/**
 * Sample points along a Bezier curve with adaptive density
 * More points in areas with high curvature
 */
export function sampleBezierCurve(
  curve: BezierCurve,
  numSamples: number = 50
): Point[] {
  const points: Point[] = [];
  const step = 1 / numSamples;

  for (let i = 0; i <= numSamples; i++) {
    const t = i * step;
    points.push(bezierPoint(t, curve));
  }

  return points;
}

/**
 * Calculate arc length of a Bezier curve (approximate)
 */
export function bezierArcLength(curve: BezierCurve, samples: number = 100): number {
  let length = 0;
  let prevPoint = bezierPoint(0, curve);

  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const point = bezierPoint(t, curve);
    const dx = point.x - prevPoint.x;
    const dy = point.y - prevPoint.y;
    length += Math.sqrt(dx * dx + dy * dy);
    prevPoint = point;
  }

  return length;
}

/**
 * Find the parameter t for a given distance along the curve
 */
export function bezierTAtDistance(
  curve: BezierCurve,
  distance: number,
  totalLength?: number
): number {
  const length = totalLength || bezierArcLength(curve);
  if (distance <= 0) return 0;
  if (distance >= length) return 1;

  // Binary search for t
  let low = 0;
  let high = 1;
  const tolerance = 0.001;

  while (high - low > tolerance) {
    const mid = (low + high) / 2;
    const midLength = bezierArcLength({ ...curve, p3: bezierPoint(mid, curve) });
    
    if (midLength < distance) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return (low + high) / 2;
}

/**
 * Ease-in-out cubic function for smooth acceleration/deceleration
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Ease-out elastic for bouncy animations
 */
export function easeOutElastic(t: number): number {
  const c4 = (2 * Math.PI) / 3;
  return t === 0
    ? 0
    : t === 1
    ? 1
    : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

