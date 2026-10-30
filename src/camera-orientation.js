export const CAMERA_CONE_RANGE = 460;
export const CAMERA_CONE_HALF_ANGLE = 27;

export function normalizeAngle(angle) {
    return ((Number(angle) % 360) + 360) % 360;
}

// SVG coordinates: zero points right and positive angles turn clockwise.
export function cameraConePath(range = CAMERA_CONE_RANGE, halfAngle = CAMERA_CONE_HALF_ANGLE) {
    const radians = Math.PI / 180;
    const start = -halfAngle * radians;
    const end = halfAngle * radians;
    const x1 = range * Math.cos(start);
    const y1 = range * Math.sin(start);
    const x2 = range * Math.cos(end);
    const y2 = range * Math.sin(end);
    return `M0 0 L${x1} ${y1} A${range} ${range} 0 0 1 ${x2} ${y2} Z`;
}
