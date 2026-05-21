export const PassDesignConfig = {
  strip: {
    // 2x canvas — Apple scales to 1x on standard screens, 3x on ProMotion
    width: 750,
    height: 288,
  },
  stamps: {
    circleRadius: 38,
    circleGap: 18,
    paddingTop: 48,
  },
} as const
