// Navigation Types
export type RootTabParamList = {
  Home: undefined;
  Social: undefined;
};

export type HomeStackParamList = {
  HomeMain: undefined;
  Board: { boardId: string };
  AddNote: undefined;
  AddAudio: undefined;
  ImportFile: undefined;
  AddMusic: { boardId?: string };
  AddMusicDetails: { track: any; boardId: string };
  PhotoPicker: undefined;
  AddPhotoDetails: { imageUri: string };
  SparkDetails: { sparkId: string; boardId: string };
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
