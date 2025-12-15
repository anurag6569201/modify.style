import React, { useRef, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Undo2, Redo2, Download, Copy, Check, Code, AlertCircle, CheckCircle2 } from 'lucide-react';
import '../../assets/css/editor/CSSEditor.css';

export default function CSSEditor() {
  const { state, setCustomCss, undo, redo, canUndo, canRedo } = useApp();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const [cssErrors, setCssErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [state.editor.customCss]);

  // Basic CSS validation
  const validateCSS = (css: string): string[] => {
    const errors: string[] = [];
    const lines = css.split('\n');
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;
      
      // Check for unclosed braces
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      
      // Check for common syntax errors
      if (trimmed.includes(':') && !trimmed.includes(';') && !trimmed.endsWith('{') && !trimmed.endsWith('}')) {
        // Might be incomplete, but not necessarily an error
      }
      
      // Check for unmatched quotes
      const singleQuotes = (line.match(/'/g) || []).length;
      const doubleQuotes = (line.match(/"/g) || []).length;
      if (singleQuotes % 2 !== 0) {
        errors.push(`Line ${index + 1}: Unmatched single quote`);
      }
      if (doubleQuotes % 2 !== 0) {
        errors.push(`Line ${index + 1}: Unmatched double quote`);
      }
    });
    
    return errors;
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCss = e.target.value;
    setCustomCss(newCss);
    
    // Validate CSS with debounce
    setIsValidating(true);
    setTimeout(() => {
      const errors = validateCSS(newCss);
      setCssErrors(errors);
      setIsValidating(false);
    }, 500);
  };

  // Format CSS (basic formatting)
  const formatCSS = () => {
    let css = state.editor.customCss;
    
    // Remove extra whitespace
    css = css.replace(/\s+/g, ' ');
    
    // Add newlines after semicolons
    css = css.replace(/;/g, ';\n');
    
    // Add newlines after closing braces
    css = css.replace(/}/g, '}\n');
    
    // Add newlines before opening braces
    css = css.replace(/{/g, ' {\n');
    
    // Clean up multiple newlines
    css = css.replace(/\n\s*\n/g, '\n');
    
    // Basic indentation
    const lines = css.split('\n');
    let indent = 0;
    const formatted = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      
      if (trimmed.endsWith('}')) {
        indent = Math.max(0, indent - 1);
      }
      
      const indented = '  '.repeat(indent) + trimmed;
      
      if (trimmed.endsWith('{')) {
        indent++;
      }
      
      return indented;
    }).join('\n');
    
    setCustomCss(formatted);
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
            onClick={formatCSS}
            title="Format CSS"
          >
            <Code size={16} />
          </button>
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
      {cssErrors.length > 0 && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '4px',
          margin: '8px',
          fontSize: '12px',
          color: '#ef4444'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <AlertCircle size={14} />
            <strong>CSS Validation Issues:</strong>
          </div>
          {cssErrors.map((error, idx) => (
            <div key={idx} style={{ marginLeft: '20px' }}>• {error}</div>
          ))}
        </div>
      )}
      {!isValidating && cssErrors.length === 0 && state.editor.customCss.trim() && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '4px',
          margin: '8px',
          fontSize: '12px',
          color: '#22c55e',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <CheckCircle2 size={14} />
          <span>CSS looks good!</span>
        </div>
      )}
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
        <span className="footer-info">
          {state.editor.customCss.split(/\s+/).filter(w => w.length > 0).length} words
        </span>
        <span className="footer-status">
          {isValidating ? 'Validating...' : cssErrors.length > 0 ? `${cssErrors.length} issue(s)` : 'Live Preview Active'}
        </span>
      </div>
    </div>
  );
}
