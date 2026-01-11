import { useRef, useState, useEffect } from "react";
import {
    Play,
    Pause,
    Volume2,
    VolumeX,
    Maximize2,
    Minimize2,
    Settings,
    ChevronRight,
    ChevronLeft,
    SkipBack,
    SkipForward
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface VideoControlsProps {
    isPlaying: boolean;
    isMuted: boolean;
    volume: number;
    currentTime: number;
    duration: number;
    playbackSpeed: number;
    onPlayPause: () => void;
    onSeek: (time: number) => void;
    onVolumeChange: (volume: number) => void;
    onToggleMute: () => void;
    onSpeedChange: (speed: number) => void;
    onFrameStep: (direction: 'forward' | 'backward') => void;
    onFullscreen: () => void;
    className?: string;
}

export function VideoControls({
    isPlaying,
    isMuted,
    volume,
    currentTime,
    duration,
    playbackSpeed,
    onPlayPause,
    onSeek,
    onVolumeChange,
    onToggleMute,
    onSpeedChange,
    onFrameStep,
    onFullscreen,
    className
}: VideoControlsProps) {
    const [isScrubbing, setIsScrubbing] = useState(false);
    const progressBarRef = useRef<HTMLDivElement>(null);

    const [hoverTime, setHoverTime] = useState<number | null>(null);

    const formatTime = (time: number) => {
        if (!isFinite(time) || isNaN(time)) return "--:--";
        if (time < 0) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
        if (!progressBarRef.current) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = x / rect.width;
        const newTime = percentage * duration;
        onSeek(newTime);
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!progressBarRef.current) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = x / rect.width;
        setHoverTime(percentage * duration);
    };

    const handleMouseLeave = () => {
        setHoverTime(null);
    };

    useEffect(() => {
        const handleMouseUp = () => setIsScrubbing(false);
        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (isScrubbing) {
                handleSeek(e);
            }
        };

        if (isScrubbing) {
            document.addEventListener("mouseup", handleMouseUp);
            document.addEventListener("mousemove", handleGlobalMouseMove);
        }

        return () => {
            document.removeEventListener("mouseup", handleMouseUp);
            document.removeEventListener("mousemove", handleGlobalMouseMove);
        };
    }, [isScrubbing, duration, onSeek]);

    return (
        <div className={cn(
            "w-full bg-background/80 backdrop-blur-md border border-border/50 rounded-xl overflow-hidden shadow-lg transition-all duration-300",
            className
        )}>
            {/* Progress Bar */}
            <div
                className="relative h-2 bg-secondary/50 cursor-pointer group"
                ref={progressBarRef}
                onMouseDown={(e) => {
                    setIsScrubbing(true);
                    handleSeek(e);
                }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                <div
                    className="absolute inset-y-0 left-0 bg-primary/20 group-hover:bg-primary/30 transition-colors"
                    style={{ width: '100%' }}
                />

                {/* Hover Indicator (Ghost Bar) */}
                {hoverTime !== null && (
                    <div
                        className="absolute inset-y-0 left-0 bg-primary/20 transition-all duration-75"
                        style={{ width: `${(hoverTime / duration) * 100}%` }}
                    />
                )}

                {/* Main Progress Bar */}
                <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-purple-500 origin-left"
                    style={{ width: `${(currentTime / duration) * 100}%` }}
                />

                {/* Hover Playhead & Tooltip */}
                {hoverTime !== null && (
                    <div
                        className="absolute top-0 w-0.5 h-full bg-white/50 z-10 pointer-events-none"
                        style={{ left: `${(hoverTime / duration) * 100}%` }}
                    >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/80 text-white text-[10px] font-mono rounded border border-white/10 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                            {formatTime(hoverTime)}
                        </div>
                    </div>
                )}

                {/* Scrubber Knob */}
                <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-md scale-0 group-hover:scale-100 transition-transform cursor-grab active:cursor-grabbing z-20"
                    style={{ left: `${(currentTime / duration) * 100}%` }}
                />
            </div>

            <div className="flex items-center justify-between p-3 gap-4">
                {/* Left: Playback Controls */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onFrameStep('backward')}
                        className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors"
                        title="Previous Frame"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onPlayPause}
                        className="h-10 w-10 bg-primary/10 hover:bg-primary/20 text-primary hover:scale-105 transition-all rounded-full"
                    >
                        {isPlaying ? (
                            <Pause className="h-5 w-5 fill-current" />
                        ) : (
                            <Play className="h-5 w-5 fill-current ml-0.5" />
                        )}
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onFrameStep('forward')}
                        className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors"
                        title="Next Frame"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>

                    {/* Time Display */}
                    <div className="flex items-center gap-1.5 ml-2 font-mono text-xs text-muted-foreground select-none bg-secondary/30 px-2 py-1 rounded-md">
                        <span className="text-foreground font-medium">{formatTime(currentTime)}</span>
                        <span className="opacity-50">/</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Right: Volume, Speed, Fullscreen */}
                <div className="flex items-center gap-2">
                    {/* Volume Group */}
                    <div className="flex items-center mr-2 group/volume">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onToggleMute}
                            className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                        >
                            {isMuted || volume === 0 ? (
                                <VolumeX className="h-4 w-4" />
                            ) : (
                                <Volume2 className="h-4 w-4" />
                            )}
                        </Button>
                        <div className="w-0 overflow-hidden group-hover/volume:w-24 transition-all duration-300 ease-out">
                            <Slider
                                value={[isMuted ? 0 : volume]}
                                max={1}
                                step={0.01}
                                onValueChange={(vals) => onVolumeChange(vals[0])}
                                className="w-20"
                            />
                        </div>
                    </div>

                    <div className="w-px h-4 bg-border/50" />

                    {/* Fullscreen */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onFullscreen}
                        className="h-8 w-8 hover:bg-primary/10 hover:text-primary ml-1"
                        title="Full Preview Mode"
                    >
                        <Maximize2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
