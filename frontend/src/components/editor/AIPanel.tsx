import React, { useState, useEffect, useRef } from 'react';
import {
    Sparkles,
    Send,
    Zap,
    Palette,
    Type,
    Layout,
    MessageSquare,
    Wand2,
    CheckCircle2,
    AlertCircle,
    TrendingUp,
    RefreshCw,
    Gauge
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import '../../assets/css/editor/AIPanel.css';

interface Suggestion {
    id: string;
    type: 'design' | 'accessibility' | 'performance';
    title: string;
    description: string;
    icon: React.ElementType;
    action?: () => void;
    applied?: boolean;
}

interface ChatMessage {
    id: string;
    sender: 'user' | 'bot';
    text: string;
    timestamp: number;
}

const AIPanel: React.FC = () => {
    const { state, setCustomCss, toggleEffect } = useApp();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [scores, setScores] = useState({ design: 0, a11y: 0, perf: 0 });
    const [messages, setMessages] = useState<ChatMessage[]>([
        { id: '1', sender: 'bot', text: 'Hi! I\'m your AI Design Assistant. I can analyze this website and help you improve it. Try asking me to "Make it dark mode" or "Fix contrast".', timestamp: Date.now() }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom of chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Simulated Analysis Effect
    useEffect(() => {
        setIsAnalyzing(true);
        // Simulate processing time
        const timer = setTimeout(() => {
            setScores({
                design: 85,
                a11y: 72,
                perf: 94
            });

            setSuggestions([
                {
                    id: 's1',
                    type: 'design',
                    title: 'Color Harmony',
                    description: 'The primary color contrast is slightly low. Consider darkening the text color.',
                    icon: Palette,
                    action: () => handleApplyFix('contrast')
                },
                {
                    id: 's2',
                    type: 'accessibility',
                    title: 'Heading Hierarchy',
                    description: 'H1 and H2 sizes are too similar. Increase H1 size for better distinctive hierarchy.',
                    icon: Type,
                    action: () => handleApplyFix('typography')
                },
                {
                    id: 's3',
                    type: 'design',
                    title: 'Whitespace Check',
                    description: 'Section padding is inconsistent. Standardize to 40px vertical padding.',
                    icon: Layout,
                    action: () => handleApplyFix('spacing')
                }
            ]);
            setIsAnalyzing(false);
        }, 1500);

        return () => clearTimeout(timer);
    }, []);

    const handleSendMessage = () => {
        if (!inputValue.trim()) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            sender: 'user',
            text: inputValue,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        setInputValue('');

        // Simulate AI Response
        setTimeout(() => {
            processCommand(userMsg.text);
        }, 800);
    };

    const processCommand = (text: string) => {
        const lowerText = text.toLowerCase();
        let responseText = "I'm not sure how to do that yet, but I'm learning!";

        // Simple Keyword Matching (Heuristics)
        if (lowerText.includes('dark mode') || lowerText.includes('dark theme')) {
            responseText = "Converting to Dark Mode... I've inverted the background and text colors while preserving images.";
            // Inject Dark Mode CSS
            const darkModeCSS = `
        html, body { background-color: #121212 !important; color: #e0e0e0 !important; }
        h1, h2, h3, h4, h5, h6 { color: #ffffff !important; }
        p, span, div { color: #b0b0b0 !important; }
        img, video { opacity: 0.9; }
      `;
            setCustomCss((state.editor.customCss || '') + darkModeCSS);
        } else if (lowerText.includes('background') || lowerText.includes('bg color')) {
            responseText = "I can change the background. Let me try a modern gradient for you.";
            const gradientCSS = `
         body { background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%) !important; }
       `;
            setCustomCss((state.editor.customCss || '') + gradientCSS);
        } else if (lowerText.includes('font') || lowerText.includes('typography')) {
            responseText = "Updating typography to 'Inter' for a cleaner look.";
            const fontCSS = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        * { font-family: 'Inter', sans-serif !important; }
      `;
            setCustomCss((state.editor.customCss || '') + fontCSS);
        } else if (lowerText.includes('analyze') || lowerText.includes('scan')) {
            responseText = "Re-analyzing the page structure... Design score is looking good!";
            // Trigger re-analysis visual
            setIsAnalyzing(true);
            setTimeout(() => setIsAnalyzing(false), 1000);
        }

        const botMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            sender: 'bot',
            text: responseText,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, botMsg]);
    };

    const handleApplyFix = (type: string) => {
        // Optimistic UI update
        setSuggestions(prev => prev.map(s =>
            (s.action && s.action.name.includes(type)) ? { ...s, applied: true } : s
        ));

        let fixCSS = '';
        if (type === 'contrast') {
            fixCSS = `p, span { color: #333333 !important; }`;
        } else if (type === 'typography') {
            fixCSS = `h1 { font-size: 3rem !important; margin-bottom: 1.5rem !important; }`;
        } else if (type === 'spacing') {
            fixCSS = `section, .section { padding-top: 60px !important; padding-bottom: 60px !important; }`;
        }

        setCustomCss((state.editor.customCss || '') + fixCSS);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    };

    return (
        <div className="ai-panel">
            <div className="ai-header">
                <div className="ai-title">
                    <Sparkles className="ai-title-icon" size={18} />
                    <span>AI Architect</span>
                </div>
                {isAnalyzing && (
                    <div className="ai-title" style={{ fontSize: '11px', color: '#94a3b8' }}>
                        <RefreshCw className="animate-spin" size={12} />
                        <span style={{ marginLeft: 4 }}>Analyzing...</span>
                    </div>
                )}
            </div>

            <div className="ai-content">
                {/* Scores */}
                <div className="ai-dashboard">
                    <div className="ai-score-card">
                        <span className="ai-score-value score-high">{scores.design}</span>
                        <span className="ai-score-label">Design</span>
                    </div>
                    <div className="ai-score-card">
                        <span className="ai-score-value score-med">{scores.a11y}</span>
                        <span className="ai-score-label">Access.</span>
                    </div>
                    <div className="ai-score-card">
                        <span className="ai-score-value score-high">{scores.perf}</span>
                        <span className="ai-score-label">Perf.</span>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="ai-section">
                    <div className="ai-section-title">Smart Actions</div>
                    <div className="ai-actions-grid">
                        <button className="ai-action-btn" onClick={() => processCommand('analyze')}>
                            <Wand2 />
                            <span className="ai-action-label">Magic Fix</span>
                        </button>
                        <button className="ai-action-btn" onClick={() => processCommand('make it dark mode')}>
                            <Sparkles />
                            <span className="ai-action-label">Dark Mode</span>
                        </button>
                        <button className="ai-action-btn" onClick={() => processCommand('fix typography')}>
                            <Type />
                            <span className="ai-action-label">Fix Fonts</span>
                        </button>
                        <button className="ai-action-btn" onClick={() => processCommand('improve background')}>
                            <Palette />
                            <span className="ai-action-label">Remix Colors</span>
                        </button>
                    </div>
                </div>

                {/* Chat Interface */}
                <div className="ai-section" style={{ flex: 1, minHeight: 0 }}>
                    <div className="ai-section-title">Command Center</div>
                    <div className="ai-chat-container">
                        <div className="ai-chat-messages">
                            {messages.map(msg => (
                                <div key={msg.id} className={`ai-message ${msg.sender}`}>
                                    {msg.text}
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="ai-input-area">
                            <input
                                className="ai-input"
                                placeholder="Ask AI to change something..."
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />
                            <button
                                className="ai-send-btn"
                                onClick={handleSendMessage}
                                disabled={!inputValue.trim()}
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Suggestions */}
                <div className="ai-section">
                    <div className="ai-section-title">Suggestions</div>
                    <div className="ai-suggestion-list">
                        {suggestions.map(suggestion => (
                            <div key={suggestion.id} className="ai-suggestion-card" onClick={suggestion.action}>
                                <div className="ai-suggestion-icon">
                                    <suggestion.icon size={18} />
                                </div>
                                <div className="ai-suggestion-content">
                                    <div className="ai-suggestion-title">{suggestion.title}</div>
                                    <div className="ai-suggestion-desc">{suggestion.description}</div>
                                    {suggestion.applied ? (
                                        <div className="ai-suggestion-action" style={{ color: '#4ade80' }}>
                                            <CheckCircle2 size={12} /> Applied
                                        </div>
                                    ) : (
                                        <div className="ai-suggestion-action">
                                            Tap to apply fix
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AIPanel;
