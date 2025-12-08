import axios from 'axios';
import { OPENAI_API_KEY } from '@env';

interface SparkInfo {
  id: string;
  type: string;
  title?: string;
  text_content?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OrganizedPosition {
  id: string;
  x: number;
  y: number;
}

/**
 * Simple organization methods (no AI required)
 */
export function organizeBoardSimple(
  sparks: SparkInfo[],
  method: 'grid' | 'spacing' | 'byType',
  boardWidth: number,
  boardHeight: number,
  viewportX: number = boardWidth / 2 - boardWidth / 2,
  viewportY: number = boardHeight / 2 - boardHeight / 2
): OrganizedPosition[] {
  if (sparks.length === 0) return [];

  const positions: OrganizedPosition[] = [];
  const padding = 30;
  
  // Start organizing from the top-left of the viewport
  const startX = viewportX + padding;
  const startY = viewportY + padding;
  
  // Calculate dynamic cell sizes based on actual spark dimensions
  const maxWidth = Math.max(...sparks.map(s => s.width), 200);
  const maxHeight = Math.max(...sparks.map(s => s.height), 200);
  const cellWidth = maxWidth + padding;
  const cellHeight = maxHeight + padding;
  
  // Calculate grid dimensions
  const cols = Math.ceil(Math.sqrt(sparks.length));
  
  // Calculate starting position (top-left of grid within viewport)
  const availableWidth = boardWidth - padding * 2;
  const gridWidth = Math.min(cols * cellWidth, availableWidth);
  const gridStartX = startX + Math.max(0, (availableWidth - gridWidth) / 2);
  const gridStartY = startY;

  if (method === 'grid') {
    // Arrange in a grid within the viewport, accounting for actual spark sizes
    sparks.forEach((spark, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      // Center spark within its cell, ensuring no overlap
      const x = gridStartX + col * cellWidth + (cellWidth - spark.width) / 2;
      const y = gridStartY + row * cellHeight + (cellHeight - spark.height) / 2;
      positions.push({
        id: spark.id,
        x,
        y,
      });
    });
  } else if (method === 'byType') {
    // Group by type within viewport, accounting for actual spark sizes
    const byType: { [key: string]: SparkInfo[] } = {};
    sparks.forEach(spark => {
      if (!byType[spark.type]) byType[spark.type] = [];
      byType[spark.type].push(spark);
    });

    let currentY = startY;
    Object.keys(byType).forEach(type => {
      const typeSparks = byType[type];
      // Calculate cell size for this type based on its sparks
      const typeMaxWidth = Math.max(...typeSparks.map(s => s.width), 200);
      const typeMaxHeight = Math.max(...typeSparks.map(s => s.height), 200);
      const typeCellWidth = typeMaxWidth + padding;
      const typeCellHeight = typeMaxHeight + padding;
      
      const typeCols = Math.ceil(Math.sqrt(typeSparks.length));
      const typeGridWidth = Math.min(typeCols * typeCellWidth, availableWidth);
      const typeStartX = startX + Math.max(0, (availableWidth - typeGridWidth) / 2);
      
      typeSparks.forEach((spark, index) => {
        const row = Math.floor(index / typeCols);
        const col = index % typeCols;
        // Center spark within its cell, ensuring no overlap
        const x = typeStartX + col * typeCellWidth + (typeCellWidth - spark.width) / 2;
        const y = currentY + row * typeCellHeight + (typeCellHeight - spark.height) / 2;
        positions.push({
          id: spark.id,
          x,
          y,
        });
      });
      // Move to next type group with proper spacing
      currentY += Math.ceil(typeSparks.length / typeCols) * typeCellHeight + padding;
    });
  } else {
    // Smart spacing - maintain relative positions but remove overlaps, within viewport
    // Account for actual spark sizes to prevent overlaps
    const sorted = [...sparks].sort((a, b) => a.x - b.x || a.y - b.y);
    const totalWidth = sorted.reduce((sum, s) => sum + s.width + padding, 0) - padding; // Subtract last padding
    const availableWidth = boardWidth - padding * 2;
    let currentX = startX + Math.max(0, (availableWidth - totalWidth) / 2);
    let currentY = startY;
    let maxHeightInRow = 0;

    sorted.forEach(spark => {
      // Check if spark would overflow viewport width
      if (currentX + spark.width > viewportX + boardWidth - padding) {
        currentX = startX;
        currentY += maxHeightInRow + padding;
        maxHeightInRow = 0;
      }
      positions.push({
        id: spark.id,
        x: currentX,
        y: currentY,
      });
      // Move to next position with padding based on actual spark width
      currentX += spark.width + padding;
      maxHeightInRow = Math.max(maxHeightInRow, spark.height);
    });
  }

  return positions;
}

/**
 * Uses AI to organize sparks on a board based on a user prompt
 */
export async function organizeBoardWithAI(
  sparks: SparkInfo[],
  prompt: string,
  boardWidth: number,
  boardHeight: number
): Promise<OrganizedPosition[]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured. Please add OPENAI_API_KEY to your .env file.');
  }

  // Prepare spark information for AI
  const sparkDescriptions = sparks.map((spark, index) => {
    let description = `Spark ${index + 1} (ID: ${spark.id}):\n`;
    description += `  - Type: ${spark.type}\n`;
    if (spark.title) description += `  - Title: ${spark.title}\n`;
    if (spark.text_content && spark.type === 'note') {
      // Truncate long notes
      const noteText = spark.text_content.length > 200 
        ? spark.text_content.substring(0, 200) + '...'
        : spark.text_content;
      description += `  - Content: ${noteText}\n`;
    }
    description += `  - Current position: (${Math.round(spark.x)}, ${Math.round(spark.y)})\n`;
    description += `  - Size: ${Math.round(spark.width)}x${Math.round(spark.height)}\n`;
    return description;
  }).join('\n');

  const systemPrompt = `You are an AI assistant that organizes visual elements on a canvas. 
You will receive a list of sparks (visual elements) and a user's organization request.
Your task is to return new x,y coordinates for each spark that best fulfills the user's request.

The canvas dimensions are: ${boardWidth} x ${boardHeight} pixels.
Each spark has a width and height - make sure sparks don't overlap significantly.
Return coordinates as a JSON object with a "positions" array with this exact format:
{
  "positions": [
    {"id": "spark-id-1", "x": 100, "y": 200},
    {"id": "spark-id-2", "x": 300, "y": 200}
  ]
}

Rules:
- All coordinates must be within the canvas bounds (0 to ${boardWidth} for x, 0 to ${boardHeight} for y)
- Maintain reasonable spacing between sparks (at least 20-30 pixels)
- Consider the spark's width and height when positioning
- Group related items together if the prompt suggests grouping
- Create logical arrangements based on the prompt`;

  const userPrompt = `Here are the sparks on the board:\n\n${sparkDescriptions}\n\nUser's organization request: "${prompt}"\n\nPlease return the new positions as a JSON object with a "positions" array containing all spark positions.`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini', // Using mini for cost efficiency, can upgrade to gpt-4 if needed
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const content = response.data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse the JSON response
    const parsed = JSON.parse(content);
    
    // Handle both array and object with array property
    let positions: OrganizedPosition[];
    if (Array.isArray(parsed)) {
      positions = parsed;
    } else if (parsed.positions && Array.isArray(parsed.positions)) {
      positions = parsed.positions;
    } else if (parsed.sparks && Array.isArray(parsed.sparks)) {
      positions = parsed.sparks;
    } else {
      // Try to extract any array from the response
      const keys = Object.keys(parsed);
      const arrayKey = keys.find(key => Array.isArray(parsed[key]));
      if (arrayKey) {
        positions = parsed[arrayKey];
      } else {
        throw new Error('Unexpected response format from AI');
      }
    }

    // Validate positions
    const validatedPositions: OrganizedPosition[] = positions.map((pos: any) => {
      const x = Math.max(0, Math.min(boardWidth - 200, pos.x || 0));
      const y = Math.max(0, Math.min(boardHeight - 200, pos.y || 0));
      return {
        id: pos.id,
        x: Math.round(x),
        y: Math.round(y),
      };
    });

    return validatedPositions;
  } catch (error: any) {
    console.error('AI organization error:', error);
    
    // Check if it's a quota/billing error
    const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown error';
    const isQuotaError = errorMessage.includes('quota') || 
                        errorMessage.includes('billing') || 
                        errorMessage.includes('insufficient') ||
                        error.response?.status === 429;
    
    if (isQuotaError) {
      // Fall back to simple grid organization
      console.log('⚠️ API quota exceeded, falling back to simple grid organization');
      return organizeBoardSimple(sparks, 'grid', boardWidth, boardHeight);
    }
    
    if (error.response) {
      throw new Error(`AI API error: ${errorMessage}`);
    }
    throw new Error(`Failed to organize board: ${errorMessage}`);
  }
}

