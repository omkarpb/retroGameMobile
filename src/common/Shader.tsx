import { Skia } from '@shopify/react-native-skia';

export const LCD_GHOSTING_SHADER = Skia.RuntimeEffect.Make(`
  uniform float2 u_resolution;
  uniform shader u_currentBoard;  // Current 20x20 tick texture
  uniform shader u_previousBoard; // Previous 20x20 tick texture
  uniform float  u_decayFactor;   // Ghost intensity (e.g. 0.25 - 0.40)
 
  // Game Boy DMG palette
  const vec4 LCD_SUBSTRATE = vec4(0.55, 0.67, 0.06, 1.0); // Base matrix tint
  const vec4 CELL_INACTIVE = vec4(0.51, 0.62, 0.05, 1.0); // Unlit pixel
  const vec4 CELL_ACTIVE   = vec4(0.06, 0.22, 0.06, 1.0); // Fully drawn pixel
  const vec4 PIXEL_BORDER  = vec4(0.48, 0.58, 0.05, 1.0); // Matrix gap border
 
  const float GRID_SIZE = 20.0;
  const float BORDER_RATIO = 0.08;
 
  vec4 main(vec2 fragCoord) {
    vec2 gridUV = (fragCoord / u_resolution) * GRID_SIZE;
    
    if (gridUV.x < 0.0 || gridUV.x >= GRID_SIZE || gridUV.y < 0.0 || gridUV.y >= GRID_SIZE) {
      return LCD_SUBSTRATE;
    }
 
    // Grid line / gap isolation
    vec2 cellCoord = fract(gridUV);
    bool isBorder = cellCoord.x < BORDER_RATIO || cellCoord.x > (1.0 - BORDER_RATIO) ||
                    cellCoord.y < BORDER_RATIO || cellCoord.y > (1.0 - BORDER_RATIO);
 
    if (isBorder) {
      return PIXEL_BORDER;
    }
 
    // Sample current and previous states (texture is 20x20, sample at center of cell pixel)
    vec2 sampleUV = floor(gridUV) + 0.5;
    float currentVal = max(u_currentBoard.eval(sampleUV).a, u_currentBoard.eval(sampleUV).r);
    float prevVal    = max(u_previousBoard.eval(sampleUV).a, u_previousBoard.eval(sampleUV).r);
 
    // 1. Fully active pixel on current tick
    if (currentVal > 0.001) {
      vec4 activeColor = CELL_ACTIVE;
      // Pixel inner bevel
      if (cellCoord.x < 0.18 || cellCoord.y < 0.18) {
        activeColor *= 0.85;
      }
      return activeColor;
    }
 
    // 2. Ghost pixel (cell was active last tick, now empty)
    if (prevVal > 0.001) {
      // Blend unlit substrate toward active pixel using the decay factor
      return mix(CELL_INACTIVE, CELL_ACTIVE, u_decayFactor);
    }
 
    // 3. Resting unlit cell
    return CELL_INACTIVE;
  }
`)!;
