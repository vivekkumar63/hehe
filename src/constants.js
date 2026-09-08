export const CANVAS_W = 1080;
export const CANVAS_H = 1920;

// Layout zones (px from top of canvas)
export const ZONE_HEADER_H    = Math.round(CANVAS_H * 0.11);  // 211
export const ZONE_BOARD_H     = Math.round(CANVAS_H * 0.14);  // 269
export const ZONE_GAME_Y      = ZONE_HEADER_H + ZONE_BOARD_H; // 480
export const ZONE_GAME_H      = Math.round(CANVAS_H * 0.57);  // 1094
export const ZONE_COMMENT_H   = Math.round(CANVAS_H * 0.09);  // 173
export const ZONE_REMAIN_H    = Math.round(CANVAS_H * 0.06);  // 115

export const RACER_RADIUS = 44;
export const GRAVITY_Y    = 2.5;
