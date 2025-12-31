
import { ClickData, RecordingMarker } from "../../pages/Recorder";

const CHAPTER_THRESHOLD = 3.0; // Seconds between actions to consider a new chapter

/**
 * Groups clicks into logical chapters based on time clustering and generates markers.
 * @param clicks List of clicks
 * @returns List of recording markers representing chapters
 */
export const generateChapters = (clicks: ClickData[]): RecordingMarker[] => {
    if (!clicks || clicks.length === 0) return [];

    // Sort clicks by timestamp to be safe
    const sorted = [...clicks].sort((a, b) => a.timestamp - b.timestamp);

    const chapters: RecordingMarker[] = [];
    let currentGroup: ClickData[] = [];

    sorted.forEach((click) => {
        if (currentGroup.length === 0) {
            currentGroup.push(click);
        } else {
            const last = currentGroup[currentGroup.length - 1];
            // If significant time gap, force new chapter
            if (click.timestamp - last.timestamp > CHAPTER_THRESHOLD) {
                chapters.push(createMarkerFromGroup(currentGroup));
                currentGroup = [click];
            } else {
                currentGroup.push(click);
            }
        }
    });

    // Process final group
    if (currentGroup.length > 0) {
        chapters.push(createMarkerFromGroup(currentGroup));
    }

    return chapters;
};

const createMarkerFromGroup = (group: ClickData[]): RecordingMarker => {
    // Determine the most "significant" click in the group to use for the label
    // Significance: Danger > Primary > Secondary > Neutral

    const getSignificance = (c: ClickData): number => {
        const s = c.elementInfo?.semanticType;
        switch (s) {
            case 'danger': return 4;
            case 'primary': return 3;
            case 'secondary': return 2;
            case 'neutral': return 1;
            default: return 0;
        }
    };

    const primaryInteraction = group.reduce((prev, curr) => {
        return getSignificance(curr) > getSignificance(prev) ? curr : prev;
    }, group[0]);

    let label = "Interaction";

    if (primaryInteraction.elementInfo) {
        const info = primaryInteraction.elementInfo;

        if (info.text) {
            let text = info.text.trim();
            // Clean up text (remove excessive whitespace/newlines)
            text = text.replace(/\s+/g, ' ');
            if (text.length > 25) {
                label = text.substring(0, 25) + "...";
            } else {
                label = text;
            }
        } else if (info.tagName) {
            // "Click Button", "Click Input"
            // capitalize tag
            const tag = info.tagName.charAt(0).toUpperCase() + info.tagName.slice(1);
            label = `Click ${tag}`;
        }

        // Improve label based on semantic type
        if (info.semanticType === 'primary') {
            // keep text
        } else if (info.semanticType === 'danger') {
            label = `[!] ${label}`;
        }
    }

    return {
        timestamp: group[0].timestamp,
        label
    };
};
