// Navigation Types
export type RootTabParamList = {
  Home: undefined;
  Social: undefined;
  Board: { boardId: string };
};

// Board Types
export interface Board {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  thumbnail_urls?: string[];
}

// Theme Types
export interface Theme {
  colors: typeof import('./styles/theme').colors;
  typography: typeof import('./styles/theme').typography;
  spacing: typeof import('./styles/theme').spacing;
  borderRadius: typeof import('./styles/theme').borderRadius;
  shadows: typeof import('./styles/theme').shadows;
  components: typeof import('./styles/theme').components;
}
