import { AspectRatioPreset, PresentationConfig, VideoConfig } from '@/lib/editor/types';

/**
 * Calculate output dimensions based on aspect ratio preset and source video dimensions
 */
export function calculateOutputDimensions(
    preset: AspectRatioPreset,
    sourceWidth: number,
    sourceHeight: number,
    customAspectRatio?: { width: number; height: number }
): { width: number; height: number } {
    if (preset === 'native') {
        return { width: sourceWidth, height: sourceHeight };
    }

    let targetAspectRatio: number;
    
    switch (preset) {
        case '16:9':
            targetAspectRatio = 16 / 9;
            break;
        case '9:16':
            targetAspectRatio = 9 / 16;
            break;
        case '1:1':
            targetAspectRatio = 1;
            break;
        case '4:3':
            targetAspectRatio = 4 / 3;
            break;
        case '21:9':
            targetAspectRatio = 21 / 9;
            break;
        case 'custom':
            if (customAspectRatio) {
                targetAspectRatio = customAspectRatio.width / customAspectRatio.height;
            } else {
                targetAspectRatio = sourceWidth / sourceHeight;
            }
            break;
        default:
            targetAspectRatio = sourceWidth / sourceHeight;
    }

    const sourceAspectRatio = sourceWidth / sourceHeight;

    // Letterboxing: fit source into target aspect ratio
    if (sourceAspectRatio > targetAspectRatio) {
        // Source is wider - fit to height
        return {
            width: sourceHeight * targetAspectRatio,
            height: sourceHeight,
        };
    } else {
        // Source is taller - fit to width
        return {
            width: sourceWidth,
            height: sourceWidth / targetAspectRatio,
        };
    }
}

/**
 * Calculate letterboxing/cropping for video within output canvas
 */
export function calculateVideoTransform(
    videoConfig: VideoConfig,
    presentationConfig: PresentationConfig
): {
    x: number;
    y: number;
    width: number;
    height: number;
    scale: number;
} {
    const { outputWidth, outputHeight, aspectRatio } = presentationConfig;
    const { width: videoWidth, height: videoHeight } = videoConfig;

    if (aspectRatio === 'native') {
        return {
            x: 0,
            y: 0,
            width: outputWidth,
            height: outputHeight,
            scale: 1,
        };
    }

    const outputAspectRatio = outputWidth / outputHeight;
    const videoAspectRatio = videoWidth / videoHeight;

    // Calculate scale to fit video within output (letterboxing)
    const scaleX = outputWidth / videoWidth;
    const scaleY = outputHeight / videoHeight;
    const scale = Math.min(scaleX, scaleY);

    const scaledWidth = videoWidth * scale;
    const scaledHeight = videoHeight * scale;

    // Center the video
    const x = (outputWidth - scaledWidth) / 2;
    const y = (outputHeight - scaledHeight) / 2;

    return {
        x,
        y,
        width: scaledWidth,
        height: scaledHeight,
        scale,
    };
}





