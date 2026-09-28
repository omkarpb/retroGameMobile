import { Skia } from '@shopify/react-native-skia';

export const LCD_GHOSTING_SHADER = Skia.RuntimeEffect.Make(`
  uniform float2 u_resolution;
  uniform shader u_currentBoard;  // Current 20x20 tick texture
  uniform shader u_previousBoard; // Previous 20x20 tick texture
  uniform float  u_decayFactor;   // Ghost intensity (e.g. 0.25 - 0.40)
 
  // Game Boy DMG palette with subtle head distinction
  const vec4 LCD_SUBSTRATE = vec4(0.55, 0.67, 0.06, 1.0); // Base matrix tint
  const vec4 CELL_INACTIVE = vec4(0.51, 0.62, 0.05, 1.0); // Unlit pixel
  const vec4 CELL_BODY     = vec4(0.06, 0.22, 0.06, 1.0); // Body segment (dark green)
  const vec4 CELL_HEAD     = vec4(0.10, 0.28, 0.10, 1.0); // Head (slightly lighter dark green)
  const vec4 CELL_FOOD     = vec4(0.06, 0.22, 0.06, 1.0); // Food (same dark green as body)
  const vec4 PIXEL_BORDER  = vec4(0.48, 0.58, 0.05, 1.0); // Matrix gap border
 
  const float GRID_SIZE = 20.0;
  const float BORDER_RATIO = 0.08;
 
  // Cell type encodings (CellType enum in SnakeEngine: 0=EMPTY, 1=BODY, 2=HEAD, 3=FOOD)
  // Byte values normalized: 1/255, 2/255, 3/255
  const float BODY_VAL = 1.0 / 255.0;   // ~0.00392
  const float HEAD_VAL = 2.0 / 255.0;   // ~0.00784
  const float FOOD_VAL = 3.0 / 255.0;   // ~0.01176
  const float HEAD_THRESHOLD = 1.5 / 255.0;  // Midpoint between BODY and HEAD
  const float FOOD_THRESHOLD = 2.5 / 255.0;  // Midpoint between HEAD and FOOD
 
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
    float currentVal = u_currentBoard.eval(sampleUV).a;
    float prevVal    = u_previousBoard.eval(sampleUV).a;
 
    // 1. Fully active pixel on current tick - determine type and apply color
    if (currentVal > 0.0001) {
      vec4 activeColor = CELL_BODY;
      
      // Determine cell type based on encoded value (check from highest to lowest)
      if (currentVal > FOOD_THRESHOLD) {
        activeColor = CELL_FOOD;
      } else if (currentVal > HEAD_THRESHOLD) {
        activeColor = CELL_HEAD;
      } else {
        activeColor = CELL_BODY;
      }
      
      // Pixel inner bevel
      if (cellCoord.x < 0.18 || cellCoord.y < 0.18) {
        activeColor *= 0.85;
      }
      return activeColor;
    }
 
    // 2. Ghost pixel (cell was active last tick, now empty)
    if (prevVal > 0.0001) {
      // Blend unlit substrate toward active pixel using the decay factor
      return mix(CELL_INACTIVE, CELL_BODY, u_decayFactor);
    }
 
    // 3. Resting unlit cell
    return CELL_INACTIVE;
  }
`)!;
