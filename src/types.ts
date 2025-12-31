export type Language = 'en' | 'pt';

export enum AppMode {
  Create = 'create',
  Edit = 'edit',
  Animate = 'animate',
  Architecture = 'architecture',
  PhotoBash = 'photobash',
}

export enum CreateFunction {
  Free = 'free',
  Sticker = 'sticker',
  Text = 'text',
  Comic = 'comic',
}

export enum EditFunction {
  AddRemove = 'add-remove',
  Retouch = 'retouch',
  Style = 'style',
  Compose = 'compose',
  DepthMap = 'depth-map',
  Upscale = 'upscale',
  Crop = 'crop',
  RemoveBackground = 'remove-background',
  FazoL = 'fazo-l',
}

export enum ArchitectureFunction {
  DrawingToBlueprint = 'drawing-to-blueprint',
  BlueprintToOrtho = 'blueprint-to-ortho',
  Remodel = 'remodel',
  InteriorDesign = 'interior-design',
  ExteriorDesign = 'exterior-design',
}

export type UploadedImage = {
  base64: string;
  mimeType: string;
};

export type DepthMapControlsState = {
  invert: boolean;
  contrast: number;
  brightness: number;
  nearClip: number; // 0-100
  farClip: number; // 0-100
};

export type EditHistoryStep = {
  id: string;
  prompt: string;
  editFunction: EditFunction;
  mask?: UploadedImage | null;
  resultImage: string;
  dpi?: number;
};

// Photo Bash Types
export type DrawingTool = 'brush' | 'eraser';
export type LayerType = 'image' | 'drawing';

export type BlendingMode = 'normal' | 'multiply' | 'screen' | 'overlay';

export interface LayerTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface LayerFilters {
  brightness: number; // 100 is default
  contrast: number; // 100 is default
  hue: number; // 0 is default
  saturate: number; // 100 is default
}

export interface BaseLayer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  transform: LayerTransform;
  filters: LayerFilters;
  zIndex: number;
  blendingMode: BlendingMode;
}

export interface ImageLayer extends BaseLayer {
  type: 'image';
  uploadedImage: UploadedImage;
}

export interface DrawingLayer extends BaseLayer {
  type: 'drawing';
  drawingDataUrl: string | null;
}

export interface PhotoBashViewport {
  pan: { x: number; y: number };
  zoom: number;
  rotation: number;
}

export type Layer = ImageLayer | DrawingLayer;