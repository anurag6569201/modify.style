import React, { useRef, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Undo2, Redo2, Download, Copy, Check } from 'lucide-react';
import './CSSEditor.css';

export default function CSSEditor() {
  const { state, setCustomCss, undo, redo, canUndo, canRedo } = useApp();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [state.editor.customCss]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCustomCss(e.target.value);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(state.editor.customCss);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([state.editor.customCss], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'custom-styles.css';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab key support
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      
      if (e.shiftKey) {
        // Shift+Tab: Remove indentation
        const lines = value.substring(0, start).split('\n');
        const currentLine = lines[lines.length - 1];
        if (currentLine.startsWith('  ')) {
          const newValue = value.substring(0, start - 2) + value.substring(start);
          setCustomCss(newValue);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start - 2;
          }, 0);
        }
      } else {
        // Tab: Add indentation
        const newValue = value.substring(0, start) + '  ' + value.substring(end);
        setCustomCss(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }, 0);
      }
    }

    // Undo/Redo with Ctrl/Cmd
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (canUndo) undo();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      if (canRedo) redo();
    }
  };

  return (
    <div className="css-editor-container">
      <div className="css-editor-toolbar">
        <div className="toolbar-group">
          <button
            className="toolbar-btn"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            className="toolbar-btn"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={16} />
          </button>
        </div>
        <div className="toolbar-group">
          <button
            className="toolbar-btn"
            onClick={handleCopy}
            title="Copy CSS"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <button
            className="toolbar-btn"
            onClick={handleDownload}
            title="Download CSS"
          >
            <Download size={16} />
          </button>
        </div>
      </div>
      <div className="css-editor-wrapper">
        <textarea
          ref={textareaRef}
          value={state.editor.customCss}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="/* Enter custom CSS */"
          spellCheck={false}
          className="css-editor-textarea"
        />
        <div className="css-editor-line-numbers">
          {state.editor.customCss.split('\n').map((_, i) => (
            <div key={i} className="line-number">{i + 1}</div>
          ))}
        </div>
      </div>
      <div className="editor-footer">
        <span className="footer-info">
          {state.editor.customCss.split('\n').length} lines
        </span>
        <span className="footer-info">
          {state.editor.customCss.length} characters
        </span>
        <span className="footer-status">Live Preview Active</span>
      </div>
    </div>
  );
}
