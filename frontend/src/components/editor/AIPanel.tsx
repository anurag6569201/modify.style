import React, { useState, useEffect, useRef } from 'react';
import {
    Sparkles,
    Send,
    Zap,
    Palette,
    Type,
    Wand2,
    CheckCircle2,
    RefreshCw,
    Layout
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiService } from '../../services/api';
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
    const { state, setCustomCss } = useApp();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [scores, setScores] = useState({ design: 0, a11y: 0, perf: 0 });
    const [messages, setMessages] = useState<ChatMessage[]>([
        { id: '1', sender: 'bot', text: 'Hi! I\'m your CSS/HTML Assistant. I help with styling, layout, performance optimization, and best practices. Ask me to "optimize CSS for page speed", "fix responsive design", or "improve accessibility".', timestamp: Date.now() }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom of chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Real AI Analysis Effect
    useEffect(() => {
        const analyzePage = async () => {
            if (!state.view.htmlContent) return;

            setIsAnalyzing(true);
            try {
                // Get analysis from backend Gemini service
                const response = await apiService.analyzeWebsite(state.view.htmlContent);

                if (response.scores) {
                    setScores(response.scores);
                }

                if (response.suggestions) {
                    // Map API suggestions to UI format
                    const mappedSuggestions: Suggestion[] = response.suggestions.map((s: any, index: number) => ({
                        id: `s-${index}`,
                        type: s.type || 'design',
                        title: s.title,
                        description: s.description,
                        icon: s.type === 'accessibility' ? Type : (s.type === 'performance' ? Zap : Palette),
                        action: () => {
                            if (s.action_css) {
                                setCustomCss((state.editor.customCss || '') + '\n' + s.action_css);
                                // Mark as applied
                                setSuggestions(prev => prev.map(item =>
                                    item.id === `s-${index}` ? { ...item, applied: true } : item
                                ));
                            }
                        }
                    }));
                    setSuggestions(mappedSuggestions);
                }
            } catch (error) {
                console.error("AI Analysis Failed:", error);
            } finally {
                setIsAnalyzing(false);
            }
        };

        analyzePage();
    }, [state.view.htmlContent]); // Re-run when HTML content changes

    const handleSendMessage = async (textOverride?: string) => {
        const textToSend = textOverride || inputValue;
        if (!textToSend.trim()) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            sender: 'user',
            text: textToSend,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        setInputValue('');

        try {
            // Call Real Backend API
            const context = state.view.htmlContent || '';
            const response = await apiService.chatWithAI(textToSend, context);

            const botMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                sender: 'bot',
                text: response.text || "I processed that for you.",
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, botMsg]);

            if (response.css) {
                setCustomCss((state.editor.customCss || '') + '\n' + response.css);
            }
        } catch (error) {
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                sender: 'bot',
                text: "Sorry, I couldn't connect to the AI service. Please check if the backend is running and the API key is configured.",
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, errorMsg]);
        }
    };

    const processCommand = (text: string) => {
        handleSendMessage(text);
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
                    <Sparkles className="ai-title-icon" size={16} />
                    <span>CSS/HTML Assistant</span>
                </div>
                {isAnalyzing && (
                    <div className="ai-analyzing">
                        <RefreshCw className="animate-spin" size={12} />
                        <span>Analyzing...</span>
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
                    <div className="ai-section-title">Quick Actions</div>
                    <div className="ai-actions-grid">
                        <button className="ai-action-btn" onClick={() => processCommand('optimize CSS for page speed')}>
                            <Zap />
                            <span className="ai-action-label">Optimize Speed</span>
                        </button>
                        <button className="ai-action-btn" onClick={() => processCommand('improve responsive design and mobile layout')}>
                            <Layout />
                            <span className="ai-action-label">Responsive</span>
                        </button>
                        <button className="ai-action-btn" onClick={() => processCommand('fix CSS accessibility issues and contrast')}>
                            <Type />
                            <span className="ai-action-label">Accessibility</span>
                        </button>
                        <button className="ai-action-btn" onClick={() => processCommand('optimize CSS selectors and reduce specificity')}>
                            <Wand2 />
                            <span className="ai-action-label">Clean CSS</span>
                        </button>
                    </div>
                </div>

                {/* Chat Interface */}
                <div className="ai-section" style={{ flex: 1, minHeight: 0 }}>
                    <div className="ai-section-title">Chat</div>
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
                                placeholder="Ask about CSS, HTML, or page speed..."
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />
                            <button
                                className="ai-send-btn"
                                onClick={() => handleSendMessage()}
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
